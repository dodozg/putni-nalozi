import { NextResponse } from "next/server";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth";
import {
  createCompany,
  getCompanyById,
  getSessionFromRequest,
  listCompanies,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (session.user.role === "global_admin") {
      return NextResponse.json(listCompanies());
    }

    const ownCompany = getCompanyById(session.activeCompanyId);
    return NextResponse.json(ownCompany ? [ownCompany] : []);
  } catch (err) {
    console.error("GET /api/companies error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju tvrtki." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (session.user.role !== "global_admin") {
      return forbiddenResponse(
        "Samo globalni administrator može dodavati nove tvrtke."
      );
    }

    const body = await request.json();
    if (!body.name || !body.oib) {
      return NextResponse.json(
        { error: "Naziv tvrtke i OIB su obavezni." },
        { status: 400 }
      );
    }

    const company = createCompany({
      name: String(body.name).trim(),
      oib: String(body.oib).trim(),
      address: String(body.address || "").trim(),
      city: String(body.city || "").trim(),
      iban: String(body.iban || "").trim(),
      director_name: String(body.director_name || "").trim(),
      order_prefix: String(body.order_prefix || "PN").trim().toUpperCase(),
      per_diem_full: Number(body.per_diem_full ?? 30),
      per_diem_half: Number(body.per_diem_half ?? 15),
      mileage_rate: Number(body.mileage_rate ?? 0.5),
      min_distance_km: Number(body.min_distance_km ?? 30),
      meal_deduction_one_pct: Number(body.meal_deduction_one_pct ?? 30),
      meal_deduction_two_pct: Number(body.meal_deduction_two_pct ?? 60),
    });

    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    console.error("POST /api/companies error:", err);
    return NextResponse.json(
      { error: "Greška pri kreiranju tvrtke." },
      { status: 500 }
    );
  }
}
