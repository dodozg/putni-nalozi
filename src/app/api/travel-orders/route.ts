import { NextResponse } from "next/server";
import { calculateTravelOrder } from "@/lib/croatian-rules";
import {
  createTravelOrder,
  getCompanySettings,
  listTravelOrders,
} from "@/lib/db";
import type { TravelExpense } from "@/lib/types";

export async function GET() {
  try {
    return NextResponse.json(listTravelOrders());
  } catch (err) {
    console.error("GET /api/travel-orders error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju putnih naloga." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (
      !body.employee_id ||
      !body.issue_date ||
      !body.purpose ||
      !body.origin ||
      !body.destination ||
      !body.departure_at ||
      !body.return_at
    ) {
      return NextResponse.json(
        {
          error:
            "Zaposlenik, datum izdavanja, svrha, relacija te polazak i povratak su obavezni.",
        },
        { status: 400 }
      );
    }

    const settings = getCompanySettings();
    const expenses: TravelExpense[] = Array.isArray(body.expenses)
      ? body.expenses
      : [];

    const calc = calculateTravelOrder(
      {
        issue_date: body.issue_date,
        purpose: body.purpose,
        distance_km: Number(body.distance_km || 0),
        departure_at: body.departure_at,
        return_at: body.return_at,
        transport_type: body.transport_type || "PRIVATNO_VOZILO",
        odometer_start: Number(body.odometer_start || 0),
        odometer_end: Number(body.odometer_end || 0),
        one_meal_days: Number(body.one_meal_days || 0),
        two_meals_days: Number(body.two_meals_days || 0),
        advance_payment_eur: Number(body.advance_payment_eur || 0),
        expenses,
      },
      settings
    );

    const created = createTravelOrder({
      status: body.status || "NACRT",
      issue_date: body.issue_date,
      employee_id: Number(body.employee_id),
      purpose: String(body.purpose).trim(),
      origin: String(body.origin).trim(),
      destination: String(body.destination).trim(),
      distance_km: Number(body.distance_km || 0),
      departure_at: body.departure_at,
      return_at: body.return_at,
      transport_type: body.transport_type || "PRIVATNO_VOZILO",
      vehicle_id: body.vehicle_id ? Number(body.vehicle_id) : null,
      odometer_start: Number(body.odometer_start || 0),
      odometer_end: Number(body.odometer_end || 0),
      total_km: calc.totalKm,
      one_meal_days: Number(body.one_meal_days || 0),
      two_meals_days: Number(body.two_meals_days || 0),
      advance_payment_eur: Number(body.advance_payment_eur || 0),
      trip_report: String(body.trip_report || "").trim(),
      per_diem_total_eur: calc.perDiem.netPerDiemEur,
      mileage_total_eur: calc.mileageTotalEur,
      expenses_total_eur: calc.expensesTotalEur,
      total_amount_eur: calc.totalAmountEur,
      balance_due_eur: calc.balanceDueEur,
      approved_by: String(body.approved_by || settings.director_name).trim(),
      expenses,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/travel-orders error:", err);
    return NextResponse.json(
      { error: "Greška pri kreiranju putnog naloga." },
      { status: 500 }
    );
  }
}
