import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  deleteLocoTrip,
  getLocoTripById,
  getSessionFromRequest,
  updateLocoTripStatus,
} from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    const { id } = await context.params;
    const trip = getLocoTripById(Number(id), session.activeCompanyId);
    if (!trip) {
      return NextResponse.json(
        { error: "Loko vožnja nije pronađena." },
        { status: 404 }
      );
    }
    return NextResponse.json(trip);
  } catch (err) {
    console.error("GET /api/loco-trips/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju loko vožnje." },
      { status: 500 }
    );
  }
}

async function handleUpdateLocoTrip(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageLoco")) {
      return forbiddenResponse(
        "Nemate ovlasti za uređivanje loko vožnji."
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const status =
      body.status === "ISPLACENO" || body.status === "PAID"
        ? "ISPLACENO"
        : "EVIDENTIRANO";
    const ok = updateLocoTripStatus(
      Number(id),
      status,
      session.activeCompanyId
    );
    if (!ok) {
      return NextResponse.json(
        { error: "Loko vožnja nije pronađena." },
        { status: 404 }
      );
    }
    const updated = getLocoTripById(Number(id), session.activeCompanyId);
    return NextResponse.json(updated || { ok: true, status });
  } catch (err) {
    console.error("PATCH/PUT /api/loco-trips/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri ažuriranju loko vožnje." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateLocoTrip(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateLocoTrip(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageLoco")) {
      return forbiddenResponse(
        "Nemate ovlasti za brisanje loko vožnji."
      );
    }

    const { id } = await context.params;
    const ok = deleteLocoTrip(Number(id), session.activeCompanyId);
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
