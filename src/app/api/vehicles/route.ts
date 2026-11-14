import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  unauthorizedResponse,
} from "@/lib/auth";
import { createVehicle, getSessionFromRequest, listVehicles } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    return NextResponse.json(listVehicles(session.activeCompanyId));
  } catch (err) {
    console.error("GET /api/vehicles error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju vozila." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageMasterData")) {
      return forbiddenResponse(
        "Nemate ovlasti za upravljanje matičnim podacima (vozila)."
      );
    }

    const body = await request.json();
    if (!body.make_model || !body.license_plate || !body.ownership_type) {
      return NextResponse.json(
        { error: "Vrsta, marka/model i registracija vozila su obavezni." },
        { status: 400 }
      );
    }
    const vehicle = createVehicle(
      {
        ownership_type: body.ownership_type,
        make_model: String(body.make_model).trim(),
        license_plate: String(body.license_plate).trim(),
        employee_id: body.employee_id ? Number(body.employee_id) : null,
        current_odometer: Number(body.current_odometer || 0),
      },
      session.activeCompanyId
    );
    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    console.error("POST /api/vehicles error:", err);
    return NextResponse.json(
      { error: "Greška pri dodavanju vozila." },
      { status: 500 }
    );
  }
}
