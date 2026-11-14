import { NextResponse } from "next/server";
import {
  forbiddenResponse,
  hasPermission,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  createEmployee,
  getSessionFromRequest,
  listEmployees,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    return NextResponse.json(listEmployees(session.activeCompanyId));
  } catch (err) {
    console.error("GET /api/employees error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju zaposlenika." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (!hasPermission(session, "canManageMasterData")) {
      return forbiddenResponse(
        "Nemate ovlasti za upravljanje matičnim podacima (zaposlenici)."
      );
    }

    const body = await request.json();
    if (!body.full_name || !body.oib || !body.job_title) {
      return NextResponse.json(
        { error: "Ime i prezime, OIB i radno mjesto su obavezni." },
        { status: 400 }
      );
    }
    const employee = createEmployee(
      {
        full_name: String(body.full_name).trim(),
        oib: String(body.oib).trim(),
        job_title: String(body.job_title).trim(),
        address: String(body.address || "").trim(),
      },
      session.activeCompanyId
    );
    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    console.error("POST /api/employees error:", err);
    return NextResponse.json(
      { error: "Greška pri dodavanju zaposlenika." },
      { status: 500 }
    );
  }
}
