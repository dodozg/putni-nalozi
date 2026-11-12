import { NextResponse } from "next/server";
import { calculateTravelOrder } from "@/lib/croatian-rules";
import {
  deleteTravelOrder,
  getCompanySettings,
  getTravelOrderById,
  updateTravelOrder,
} from "@/lib/db";
import type { TravelExpense } from "@/lib/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const order = getTravelOrderById(Number(id));
    if (!order) {
      return NextResponse.json(
        { error: "Putni nalog nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json(order);
  } catch (err) {
    console.error("GET /api/travel-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju putnog naloga." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
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

    const updated = updateTravelOrder(Number(id), {
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

    if (!updated) {
      return NextResponse.json(
        { error: "Putni nalog nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/travel-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri ažuriranju putnog naloga." },
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
    const deleted = deleteTravelOrder(Number(id));
    if (!deleted) {
      return NextResponse.json(
        { error: "Putni nalog nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/travel-orders/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri brisanju putnog naloga." },
      { status: 500 }
    );
  }
}
