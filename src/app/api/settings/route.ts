import { NextResponse } from "next/server";
import { getCompanySettings, updateCompanySettings } from "@/lib/db";

export async function GET() {
  try {
    const settings = getCompanySettings();
    return NextResponse.json(settings);
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju postavki tvrtke." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.oib) {
      return NextResponse.json(
        { error: "Naziv tvrtke i OIB su obavezni." },
        { status: 400 }
      );
    }
    const updated = updateCompanySettings({
      name: String(body.name),
      oib: String(body.oib),
      address: String(body.address || ""),
      city: String(body.city || ""),
      iban: String(body.iban || ""),
      director_name: String(body.director_name || ""),
      order_prefix: String(body.order_prefix || "PN").toUpperCase(),
      per_diem_full: Number(body.per_diem_full ?? 30),
      per_diem_half: Number(body.per_diem_half ?? 15),
      mileage_rate: Number(body.mileage_rate ?? 0.5),
      min_distance_km: Number(body.min_distance_km ?? 30),
      meal_deduction_one_pct: Number(body.meal_deduction_one_pct ?? 30),
      meal_deduction_two_pct: Number(body.meal_deduction_two_pct ?? 60),
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json(
      { error: "Greška pri spremanju postavki." },
      { status: 500 }
    );
  }
}
