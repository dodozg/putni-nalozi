import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  deleteVehicle,
  getSessionFromRequest,
  getVehicleById,
  updateVehicle,
} from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    const { id } = await context.params;
    const vehicle = getVehicleById(Number(id), session.activeCompanyId);
    if (!vehicle) {
      return NextResponse.json(
        { error: "Vozilo nije pronađeno." },
        { status: 404 }
      );
    }
    return NextResponse.json(vehicle);
  } catch (err) {
    console.error("GET /api/vehicles/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju vozila." },
      { status: 500 }
    );
  }
}

async function handleUpdateVehicle(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageMasterData")) {
      return forbiddenResponse(
        "Nemate ovlasti za uređivanje podataka vozila."
      );
    }

    const { id } = await context.params;
    const targetId = Number(id);
    const existing = getVehicleById(targetId, session.activeCompanyId);
    if (!existing) {
      return NextResponse.json(
        { error: "Vozilo nije pronađeno." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updated = updateVehicle(
      targetId,
      {
        ownership_type: body.ownership_type ?? existing.ownership_type,
        make_model:
          body.make_model !== undefined
            ? String(body.make_model).trim()
            : existing.make_model,
        license_plate:
          body.license_plate !== undefined
            ? String(body.license_plate).trim()
            : existing.license_plate,
        employee_id:
          body.employee_id !== undefined
            ? body.employee_id
              ? Number(body.employee_id)
              : null
            : existing.employee_id,
        current_odometer:
          body.current_odometer !== undefined
            ? Number(body.current_odometer || 0)
            : existing.current_odometer,
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
        { error: "Vozilo nije pronađeno." },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT/PATCH /api/vehicles/[id] error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Greška pri ažuriranju vozila.",
      },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateVehicle(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateVehicle(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageMasterData")) {
      return forbiddenResponse("Nemate ovlasti za brisanje vozila.");
    }

    const { id } = await context.params;
    const deleted = deleteVehicle(Number(id), session.activeCompanyId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Vozilo nije pronađeno." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/vehicles/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri brisanju vozila." },
      { status: 500 }
    );
  }
}
