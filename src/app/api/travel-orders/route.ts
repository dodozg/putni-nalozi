import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  normalizeOrderStatus,
  unauthorizedResponse,
} from "@/lib/auth";
import { calculateTravelOrder, round2 } from "@/lib/croatian-rules";
import {
  createTravelOrder,
  getCompanySettings,
  getSessionFromRequest,
  listTravelOrders,
} from "@/lib/db";
import { calculateForeignPerDiem } from "@/lib/foreign-per-diems";
import type { OrderStatus, TravelExpense } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    return NextResponse.json(listTravelOrders(session.activeCompanyId));
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
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageTravelOrders")) {
      return forbiddenResponse(
        "Nemate ovlasti za kreiranje putnih naloga."
      );
    }

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

    let status: OrderStatus = "NACRT";
    if (body.status !== undefined && body.status !== null && body.status !== "") {
      const normalized = normalizeOrderStatus(body.status);
      if (!normalized) {
        return NextResponse.json(
          { error: "Neispravan status putnog naloga." },
          { status: 400 }
        );
      }
      status = normalized;
    }

    if (
      status !== "NACRT" &&
      !hasPermission(session, "canApproveTravelOrders")
    ) {
      return forbiddenResponse(
        "Nemate ovlasti za odobravanje i isplatu putnih naloga."
      );
    }

    const settings = getCompanySettings(session.activeCompanyId);
    const expenses: TravelExpense[] = Array.isArray(body.expenses)
      ? body.expenses
      : [];

    const countryCode = String(body.country_code || "HR")
      .trim()
      .toUpperCase();

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

    let perDiemTotalEur = calc.perDiem.netPerDiemEur;
    if (countryCode && countryCode !== "HR") {
      const foreignCalc = calculateForeignPerDiem({
        countryCode,
        departureAt: body.departure_at,
        borderExitAt: body.border_exit_at,
        borderReturnAt: body.border_return_at,
        returnAt: body.return_at,
        oneMealDays: Number(body.one_meal_days || 0),
        twoMealsDays: Number(body.two_meals_days || 0),
        domesticPerDiemEur: settings.per_diem_full,
      });
      perDiemTotalEur = foreignCalc.totalNetEur;
    }

    const totalAmountEur = round2(
      perDiemTotalEur + calc.mileageTotalEur + calc.expensesTotalEur
    );
    const balanceDueEur = round2(
      totalAmountEur - Number(body.advance_payment_eur || 0)
    );

    const created = createTravelOrder(
      {
        status,
        issue_date: body.issue_date,
        employee_id: Number(body.employee_id),
        purpose: String(body.purpose).trim(),
        origin: String(body.origin).trim(),
        destination: String(body.destination).trim(),
        country_code: countryCode,
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
        per_diem_total_eur: perDiemTotalEur,
        mileage_total_eur: calc.mileageTotalEur,
        expenses_total_eur: calc.expensesTotalEur,
        total_amount_eur: totalAmountEur,
        balance_due_eur: balanceDueEur,
        approved_by: String(
          body.approved_by || settings.director_name
        ).trim(),
        expenses,
      },
      session.activeCompanyId
    );

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/travel-orders error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Greška pri kreiranju putnog naloga.",
      },
      { status: 400 }
    );
  }
}
