import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  exportCompanyBackup,
  exportFullSystemBackup,
  getSessionFromRequest,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canBackupRestore")) {
      return forbiddenResponse(
        "Nemate ovlasti za izradu sigurnosne kopije (Backup)."
      );
    }

    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") || "company";
    const companyIdParam = url.searchParams.get("companyId");

    if (scope === "all") {
      if (session.user.role !== "global_admin") {
        return forbiddenResponse(
          "Samo globalni administrator može izvesti sigurnosnu kopiju cijelog sustava."
        );
      }
      const backup = exportFullSystemBackup(session.user.email);
      return NextResponse.json(backup);
    }

    if (
      companyIdParam &&
      session.user.role !== "global_admin" &&
      Number(companyIdParam) !== session.activeCompanyId
    ) {
      return forbiddenResponse(
        "Nemate ovlasti za izvoz sigurnosne kopije druge tvrtke."
      );
    }

    const targetCompanyId =
      session.user.role === "global_admin" && companyIdParam
        ? Number(companyIdParam)
        : session.activeCompanyId;

    const backup = exportCompanyBackup(targetCompanyId, session.user.email);
    return NextResponse.json(backup);
  } catch (err) {
    console.error("GET /api/backup error:", err);
    return NextResponse.json(
      { error: "Greška pri izradi sigurnosne kopije." },
      { status: 500 }
    );
  }
}
