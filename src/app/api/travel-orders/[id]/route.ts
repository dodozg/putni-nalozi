import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  normalizeOrderStatus,
  unauthorizedResponse,
} from "@/lib/auth";
import { calculateTravelOrder, round2 } from "@/lib/croatian-rules";
import {
  deleteTravelOrder,
  getCompanySettings,
  getSessionFromRequest,
  getTravelOrderById,
  updateTravelOrder,
} from "@/lib/db";
import { calculateForeignPerDiem } from "@/lib/foreign-per-diems";
import type { OrderStatus, TravelExpense } from "@/lib/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    const { id } = await context.params;
    const order = getTravelOrderById(Number(id), session.activeCompanyId);
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

async function handleUpdateTravelOrder(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    const canManage = hasPermission(session, "canManageTravelOrders");
    const canApprove = hasPermission(session, "canApproveTravelOrders");

    if (!canManage && !canApprove) {
      return forbiddenResponse(
        "Nemate ovlasti za uređivanje putnih naloga."
      );
    }

    const { id } = await context.params;
    const existing = getTravelOrderById(Number(id), session.activeCompanyId);
    if (!existing) {
      return NextResponse.json(
        { error: "Putni nalog nije pronađen." },
        { status: 404 }
      );
    }

    const body = await request.json();

    let nextStatus: OrderStatus = existing.status || "NACRT";
    if (body.status !== undefined && body.status !== null && body.status !== "") {
      const normalized = normalizeOrderStatus(body.status);
      if (!normalized) {
        return NextResponse.json(
          { error: "Neispravan status putnog naloga." },
          { status: 400 }
        );
      }
      nextStatus = normalized;
    }

    const isStatusChanged = nextStatus !== existing.status;

    if (!canApprove) {
      if (isStatusChanged || existing.status !== "NACRT") {
        return forbiddenResponse(
          "Nemate ovlasti za odobravanje i isplatu putnih naloga."
        );
      }
    }

    if (!canManage && canApprove) {
      const nonStatusFields = [
        "issue_date",
        "employee_id",
        "purpose",
        "origin",
        "destination",
        "country_code",
        "distance_km",
        "departure_at",
        "return_at",
        "transport_type",
        "vehicle_id",
        "odometer_start",
        "odometer_end",
        "one_meal_days",
        "two_meals_days",
        "advance_payment_eur",
        "trip_report",
        "expenses",
      ] as const;

      const hasNonStatusModification = nonStatusFields.some((key) => {
        if (body[key] === undefined) return false;
        if (key === "expenses") {
          return (
            JSON.stringify(body.expenses) !==
            JSON.stringify(existing.expenses || [])
          );
        }
        return String(body[key]) !== String(existing[key] ?? "");
      });

      if (hasNonStatusModification || body.status === undefined) {
        return forbiddenResponse(
          "Nemate ovlasti za uređivanje sadržaja putnog naloga (dopušteno je samo odobravanje statusa)."
        );
      }
    }

    const settings = getCompanySettings(session.activeCompanyId);

    const issueDate =
      body.issue_date !== undefined ? body.issue_date : existing.issue_date;
    const employeeId =
      body.employee_id !== undefined
        ? Number(body.employee_id)
        : existing.employee_id;
    const purpose =
      body.purpose !== undefined
        ? String(body.purpose).trim()
        : existing.purpose;
    const origin =
      body.origin !== undefined ? String(body.origin).trim() : existing.origin;
    const destination =
      body.destination !== undefined
        ? String(body.destination).trim()
        : existing.destination;
    const countryCode = String(
      body.country_code ?? existing.country_code ?? "HR"
    )
      .trim()
      .toUpperCase();
    const distanceKm =
      body.distance_km !== undefined
        ? Number(body.distance_km || 0)
        : existing.distance_km;
    const departureAt =
      body.departure_at !== undefined
        ? body.departure_at
        : existing.departure_at;
    const returnAt =
      body.return_at !== undefined ? body.return_at : existing.return_at;
    const transportType =
      body.transport_type !== undefined
        ? body.transport_type
        : existing.transport_type;
    const vehicleId =
      body.vehicle_id !== undefined
        ? body.vehicle_id
          ? Number(body.vehicle_id)
          : null
        : existing.vehicle_id;
    const odometerStart =
      body.odometer_start !== undefined
        ? Number(body.odometer_start || 0)
        : existing.odometer_start;
    const odometerEnd =
      body.odometer_end !== undefined
        ? Number(body.odometer_end || 0)
        : existing.odometer_end;
    const oneMealDays =
      body.one_meal_days !== undefined
        ? Number(body.one_meal_days || 0)
        : existing.one_meal_days;
    const twoMealsDays =
      body.two_meals_days !== undefined
        ? Number(body.two_meals_days || 0)
        : existing.two_meals_days;
    const advancePaymentEur =
      body.advance_payment_eur !== undefined
        ? Number(body.advance_payment_eur || 0)
        : existing.advance_payment_eur;
    const tripReport =
      body.trip_report !== undefined
        ? String(body.trip_report || "").trim()
        : existing.trip_report;
    const approvedBy =
      body.approved_by !== undefined
        ? String(body.approved_by || settings.director_name).trim()
        : existing.approved_by || settings.director_name;
    const expenses: TravelExpense[] = Array.isArray(body.expenses)
      ? body.expenses
      : existing.expenses || [];

    const calc = calculateTravelOrder(
      {
        issue_date: issueDate,
        purpose,
        distance_km: distanceKm,
        departure_at: departureAt,
        return_at: returnAt,
        transport_type: transportType || "PRIVATNO_VOZILO",
        odometer_start: odometerStart,
        odometer_end: odometerEnd,
        one_meal_days: oneMealDays,
        two_meals_days: twoMealsDays,
        advance_payment_eur: advancePaymentEur,
        expenses,
      },
      settings
    );

    let perDiemTotalEur = calc.perDiem.netPerDiemEur;
    if (countryCode && countryCode !== "HR") {
      const foreignCalc = calculateForeignPerDiem({
        countryCode,
        departureAt,
        borderExitAt: body.border_exit_at,
        borderReturnAt: body.border_return_at,
        returnAt,
        oneMealDays,
        twoMealsDays,
        domesticPerDiemEur: settings.per_diem_full,
      });
      perDiemTotalEur = foreignCalc.totalNetEur;
    }

    const totalAmountEur = round2(
      perDiemTotalEur + calc.mileageTotalEur + calc.expensesTotalEur
    );
    const balanceDueEur = round2(totalAmountEur - advancePaymentEur);

    const updated = updateTravelOrder(
      Number(id),
      {
        status: nextStatus,
        issue_date: issueDate,
        employee_id: employeeId,
        purpose,
        origin,
        destination,
        country_code: countryCode,
        distance_km: distanceKm,
        departure_at: departureAt,
        return_at: returnAt,
        transport_type: transportType || "PRIVATNO_VOZILO",
        vehicle_id: vehicleId,
        odometer_start: odometerStart,
        odometer_end: odometerEnd,
        total_km: calc.totalKm,
        one_meal_days: oneMealDays,
        two_meals_days: twoMealsDays,
        advance_payment_eur: advancePaymentEur,
        trip_report: tripReport,
        per_diem_total_eur: perDiemTotalEur,
        mileage_total_eur: calc.mileageTotalEur,
        expenses_total_eur: calc.expensesTotalEur,
        total_amount_eur: totalAmountEur,
        balance_due_eur: balanceDueEur,
        approved_by: approvedBy,
        expenses,
      },
      session.activeCompanyId
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Putni nalog nije pronađen." },
        { status: 404 }
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT/PATCH /api/travel-orders/[id] error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Greška pri ažuriranju putnog naloga.",
      },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateTravelOrder(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateTravelOrder(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageTravelOrders")) {
      return forbiddenResponse(
        "Nemate ovlasti za brisanje putnih naloga."
      );
    }

    const { id } = await context.params;
    const deleted = deleteTravelOrder(Number(id), session.activeCompanyId);
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
