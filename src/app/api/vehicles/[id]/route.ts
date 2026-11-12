import { NextResponse } from "next/server";
import { updateVehicle } from "@/lib/db";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = updateVehicle(Number(id), {
      ownership_type: body.ownership_type,
      make_model: String(body.make_model).trim(),
      license_plate: String(body.license_plate).trim(),
      employee_id: body.employee_id ? Number(body.employee_id) : null,
      current_odometer: Number(body.current_odometer || 0),
      active: body.active === 0 ? 0 : 1,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Vozilo nije pronađeno." },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/vehicles/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri ažuriranju vozila." },
      { status: 500 }
    );
  }
}
