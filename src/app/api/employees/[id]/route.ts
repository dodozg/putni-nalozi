import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  deleteEmployee,
  getEmployeeById,
  getSessionFromRequest,
  updateEmployee,
} from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    const { id } = await context.params;
    const employee = getEmployeeById(Number(id), session.activeCompanyId);
    if (!employee) {
      return NextResponse.json(
        { error: "Zaposlenik nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json(employee);
  } catch (err) {
    console.error("GET /api/employees/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju zaposlenika." },
      { status: 500 }
    );
  }
}

async function handleUpdateEmployee(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageMasterData")) {
      return forbiddenResponse(
        "Nemate ovlasti za uređivanje podataka zaposlenika."
      );
    }

    const { id } = await context.params;
    const targetId = Number(id);
    const existing = getEmployeeById(targetId, session.activeCompanyId);
    if (!existing) {
      return NextResponse.json(
        { error: "Zaposlenik nije pronađen." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updated = updateEmployee(
      targetId,
      {
        full_name:
          body.full_name !== undefined
            ? String(body.full_name).trim()
            : existing.full_name,
        oib: body.oib !== undefined ? String(body.oib).trim() : existing.oib,
        job_title:
          body.job_title !== undefined
            ? String(body.job_title).trim()
            : existing.job_title,
        address:
          body.address !== undefined
            ? String(body.address || "").trim()
            : existing.address,
        active:
          body.active !== undefined
            ? body.active === 0 || body.active === false
              ? 0
              : 1
            : existing.active,
      },
      session.activeCompanyId
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Zaposlenik nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT/PATCH /api/employees/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri ažuriranju zaposlenika." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateEmployee(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateEmployee(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageMasterData")) {
      return forbiddenResponse(
        "Nemate ovlasti za brisanje zaposlenika."
      );
    }

    const { id } = await context.params;
    const deleted = deleteEmployee(Number(id), session.activeCompanyId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Zaposlenik nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/employees/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri brisanju zaposlenika." },
      { status: 500 }
    );
  }
}
