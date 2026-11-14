import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  deleteCompany,
  getCompanyById,
  getSessionFromRequest,
  updateCompany,
} from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    const { id } = await context.params;
    const companyId = Number(id);

    if (
      session.user.role !== "global_admin" &&
      companyId !== session.activeCompanyId
    ) {
      return forbiddenResponse("Nemate pristup podacima druge tvrtke.");
    }

    const company = getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: "Tvrtka nije pronađena." },
        { status: 404 }
      );
    }

    return NextResponse.json(company);
  } catch (err) {
    console.error("GET /api/companies/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju tvrtke." },
      { status: 500 }
    );
  }
}

async function handleUpdateCompany(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    const { id } = await context.params;
    const companyId = Number(id);

    if (
      session.user.role !== "global_admin" &&
      companyId !== session.activeCompanyId
    ) {
      return forbiddenResponse("Nemate ovlasti za uređivanje druge tvrtke.");
    }

    if (
      session.user.role !== "global_admin" &&
      session.user.role !== "company_admin" &&
      !hasPermission(session, "canManageMasterData")
    ) {
      return forbiddenResponse(
        "Nemate ovlasti za uređivanje podataka tvrtke."
      );
    }

    const body = await request.json();
    if (
      body.active !== undefined &&
      !body.active &&
      session.user.role !== "global_admin"
    ) {
      return forbiddenResponse(
        "Samo globalni administrator može deaktivirati tvrtku."
      );
    }

    const updated = updateCompany(companyId, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      oib: body.oib !== undefined ? String(body.oib).trim() : undefined,
      address:
        body.address !== undefined ? String(body.address).trim() : undefined,
      city: body.city !== undefined ? String(body.city).trim() : undefined,
      iban: body.iban !== undefined ? String(body.iban).trim() : undefined,
      director_name:
        body.director_name !== undefined
          ? String(body.director_name).trim()
          : undefined,
      order_prefix:
        body.order_prefix !== undefined
          ? String(body.order_prefix).trim().toUpperCase()
          : undefined,
      per_diem_full:
        body.per_diem_full !== undefined
          ? Number(body.per_diem_full)
          : undefined,
      per_diem_half:
        body.per_diem_half !== undefined
          ? Number(body.per_diem_half)
          : undefined,
      mileage_rate:
        body.mileage_rate !== undefined
          ? Number(body.mileage_rate)
          : undefined,
      min_distance_km:
        body.min_distance_km !== undefined
          ? Number(body.min_distance_km)
          : undefined,
      meal_deduction_one_pct:
        body.meal_deduction_one_pct !== undefined
          ? Number(body.meal_deduction_one_pct)
          : undefined,
      meal_deduction_two_pct:
        body.meal_deduction_two_pct !== undefined
          ? Number(body.meal_deduction_two_pct)
          : undefined,
      active: body.active !== undefined ? (body.active ? 1 : 0) : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Tvrtka nije pronađena." },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/companies/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri ažuriranju tvrtke." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateCompany(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateCompany(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (session.user.role !== "global_admin") {
      return forbiddenResponse(
        "Samo globalni administrator može brisati tvrtke."
      );
    }

    const { id } = await context.params;
    const deleted = deleteCompany(Number(id));
    if (!deleted) {
      return NextResponse.json(
        { error: "Tvrtka nije pronađena." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/companies/[id] error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Greška pri brisanju tvrtke.",
      },
      { status: 400 }
    );
  }
}
