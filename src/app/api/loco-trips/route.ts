import { NextResponse } from "next/server";
import { round2 } from "@/lib/croatian-rules";
import {
  createLocoTrip,
  getCompanySettings,
  listLocoTrips,
} from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(listLocoTrips());
  } catch (err) {
    console.error("GET /api/loco-trips error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju loko vožnji." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (
      !body.trip_date ||
      !body.employee_id ||
      !body.origin ||
      !body.destination ||
      !body.purpose
    ) {
      return NextResponse.json(
        { error: "Datum, zaposlenik, relacija i svrha vožnje su obavezni." },
        { status: 400 }
      );
    }

    const settings = getCompanySettings();
    const odoStart = Number(body.odometer_start || 0);
    const odoEnd = Number(body.odometer_end || 0);
    const distanceKm =
      odoEnd > odoStart ? round2(odoEnd - odoStart) : round2(Number(body.distance_km || 0));

    if (distanceKm <= 0) {
      return NextResponse.json(
        { error: "Prijeđena kilometraža mora biti veća od 0 km." },
        { status: 400 }
      );
    }

    const rate = settings.mileage_rate;
    const amountEur = round2(distanceKm * rate);

    const created = createLocoTrip({
      trip_date: body.trip_date,
      employee_id: Number(body.employee_id),
      vehicle_id: body.vehicle_id ? Number(body.vehicle_id) : null,
      origin: String(body.origin).trim(),
      destination: String(body.destination).trim(),
      purpose: String(body.purpose).trim(),
      odometer_start: odoStart,
      odometer_end: odoEnd,
      distance_km: distanceKm,
      rate_eur: rate,
      amount_eur: amountEur,
      status: body.status || "EVIDENTIRANO",
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/loco-trips error:", err);
    return NextResponse.json(
      { error: "Greška pri spremanju loko vožnje." },
      { status: 500 }
    );
  }
}
