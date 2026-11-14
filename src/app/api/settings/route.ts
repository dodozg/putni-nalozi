import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  getCompanySettings,
  getSessionFromRequest,
  updateCompanySettings,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    const settings = getCompanySettings(session.activeCompanyId);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju postavki tvrtke." },
      { status: 500 }
    );
  }
}

async function handleSaveSettings(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageMasterData")) {
      return forbiddenResponse(
        "Nemate ovlasti za uređivanje matičnih podataka i postavki tvrtke."
      );
    }

    const existing = getCompanySettings(session.activeCompanyId);
    const body = await request.json();
    const nextName =
      body.name !== undefined ? String(body.name).trim() : existing.name;
    const nextOib =
      body.oib !== undefined ? String(body.oib).trim() : existing.oib;

    if (!nextName || !nextOib) {
      return NextResponse.json(
        { error: "Naziv tvrtke i OIB su obavezni." },
        { status: 400 }
      );
    }
    const updated = updateCompanySettings(
      {
        name: nextName,
        oib: nextOib,
        address:
          body.address !== undefined
            ? String(body.address || "")
            : existing.address,
        city:
          body.city !== undefined ? String(body.city || "") : existing.city,
        iban:
          body.iban !== undefined ? String(body.iban || "") : existing.iban,
        director_name:
          body.director_name !== undefined
            ? String(body.director_name || "")
            : existing.director_name,
        order_prefix:
          body.order_prefix !== undefined
            ? String(body.order_prefix || "PN").toUpperCase()
            : existing.order_prefix,
        per_diem_full: Number(body.per_diem_full ?? existing.per_diem_full ?? 30),
        per_diem_half: Number(body.per_diem_half ?? existing.per_diem_half ?? 15),
        mileage_rate: Number(body.mileage_rate ?? existing.mileage_rate ?? 0.5),
        min_distance_km: Number(
          body.min_distance_km ?? existing.min_distance_km ?? 30
        ),
        meal_deduction_one_pct: Number(
          body.meal_deduction_one_pct ?? existing.meal_deduction_one_pct ?? 30
        ),
        meal_deduction_two_pct: Number(
          body.meal_deduction_two_pct ?? existing.meal_deduction_two_pct ?? 60
        ),
      },
      session.activeCompanyId
    );
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT/PATCH /api/settings error:", err);
    return NextResponse.json(
      { error: "Greška pri spremanju postavki." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  return handleSaveSettings(request);
}

export async function PATCH(request: Request) {
  return handleSaveSettings(request);
}

export async function POST(request: Request) {
  return handleSaveSettings(request);
}

export async function DELETE(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return unauthorizedResponse();
  if (!hasPermission(session, "canManageMasterData")) {
    return forbiddenResponse(
      "Nemate ovlasti za uređivanje matičnih podataka i postavki tvrtke."
    );
  }
  return NextResponse.json(
    { error: "Postavke tvrtke nije moguće obrisati." },
    { status: 405 }
  );
}
