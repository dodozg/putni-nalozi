import { NextResponse } from "next/server";
import { updateEmployee } from "@/lib/db";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = updateEmployee(Number(id), {
      full_name: String(body.full_name).trim(),
      oib: String(body.oib).trim(),
      job_title: String(body.job_title).trim(),
      address: String(body.address || "").trim(),
      active: body.active === 0 ? 0 : 1,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Zaposlenik nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/employees/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri ažuriranju zaposlenika." },
      { status: 500 }
    );
  }
}
