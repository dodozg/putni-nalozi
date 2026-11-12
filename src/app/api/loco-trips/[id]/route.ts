import { NextResponse } from "next/server";
import { deleteLocoTrip, updateLocoTripStatus } from "@/lib/db";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = body.status === "ISPLACENO" ? "ISPLACENO" : "EVIDENTIRANO";
    const ok = updateLocoTripStatus(Number(id), status);
    if (!ok) {
      return NextResponse.json(
        { error: "Loko vožnja nije pronađena." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("PATCH /api/loco-trips/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri ažuriranju loko vožnje." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const ok = deleteLocoTrip(Number(id));
    if (!ok) {
      return NextResponse.json(
        { error: "Loko vožnja nije pronađena." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/loco-trips/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri brisanju loko vožnje." },
      { status: 500 }
    );
  }
}
