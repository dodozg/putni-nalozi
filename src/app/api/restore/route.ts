import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  unauthorizedResponse,
} from "@/lib/auth";
import { getSessionFromRequest, restoreBackup } from "@/lib/db";
import type { BackupPayload } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canBackupRestore")) {
      return forbiddenResponse(
        "Nemate ovlasti za vraćanje sigurnosne kopije (Restore)."
      );
    }

    const body = await request.json();
    const backupPayload: BackupPayload = body.backup || body;
    const mode: "merge" | "replace" =
      body.mode === "replace" ? "replace" : "merge";

    if (session.user.role !== "global_admin") {
      if (
        (body.targetCompanyId &&
          Number(body.targetCompanyId) !== session.activeCompanyId) ||
        backupPayload.scope === "all" ||
        (Array.isArray(backupPayload.globalUsers) &&
          backupPayload.globalUsers.length > 0) ||
        (Array.isArray(backupPayload.allCompaniesData) &&
          backupPayload.allCompaniesData.length > 0)
      ) {
        return forbiddenResponse(
          "Nemate ovlasti za vraćanje sigurnosne kopije cijelog sustava ili druge tvrtke."
        );
      }
    }

    const targetCompanyId =
      session.user.role === "global_admin" && body.targetCompanyId
        ? Number(body.targetCompanyId)
        : session.activeCompanyId;

    const summary = restoreBackup(backupPayload, {
      mode,
      targetCompanyId,
      isGlobalAdmin:
        session.user.role === "global_admin" && !body.targetCompanyId,
    });

    return NextResponse.json({
      ok: true,
      mode,
      targetCompanyId,
      summary,
    });
  } catch (err) {
    console.error("POST /api/restore error:", err);
    const msg =
      err instanceof Error
        ? err.message
        : "Greška pri vraćanju sigurnosne kopije.";
    if (msg.startsWith("FORBIDDEN:")) {
      return forbiddenResponse(msg.replace("FORBIDDEN:", "").trim());
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
