import { NextResponse } from "next/server";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth";
import {
  createUser,
  getSessionFromRequest,
  getUserByEmail,
  listUsers,
} from "@/lib/db";
import type { UserRole } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (
      session.user.role !== "global_admin" &&
      session.user.role !== "company_admin"
    ) {
      return forbiddenResponse(
        "Samo administratori mogu upravljati korisnicima."
      );
    }

    const url = new URL(request.url);
    const companyIdParam = url.searchParams.get("companyId");
    const headerCompanyId = request.headers.get("x-company-id");
    const requestedCompanyId = companyIdParam
      ? Number(companyIdParam)
      : headerCompanyId
      ? Number(headerCompanyId)
      : null;

    if (session.user.role === "global_admin") {
      if (requestedCompanyId && requestedCompanyId > 0) {
        return NextResponse.json(listUsers(requestedCompanyId));
      }
      return NextResponse.json(listUsers());
    }

    if (
      requestedCompanyId &&
      requestedCompanyId > 0 &&
      requestedCompanyId !== session.activeCompanyId
    ) {
      return forbiddenResponse(
        "Nemate ovlasti za pregled korisnika druge tvrtke."
      );
    }

    return NextResponse.json(listUsers(session.activeCompanyId));
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju korisnika." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (
      session.user.role !== "global_admin" &&
      session.user.role !== "company_admin"
    ) {
      return forbiddenResponse(
        "Samo administratori mogu dodavati nove korisnike."
      );
    }

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const password = String(body.password || "").trim();

    if (!email || !fullName || !password) {
      return NextResponse.json(
        { error: "Ime i prezime, e-mail i lozinka su obavezni." },
        { status: 400 }
      );
    }

    if (
      body.role !== undefined &&
      body.role !== "global_admin" &&
      body.role !== "company_admin" &&
      body.role !== "user"
    ) {
      return NextResponse.json(
        { error: "Neispravna korisnička uloga." },
        { status: 400 }
      );
    }

    const role: UserRole = body.role || "user";
    let companyId: number | null =
      body.company_id != null ? Number(body.company_id) : session.activeCompanyId;

    if (session.user.role === "company_admin") {
      if (role === "global_admin") {
        return forbiddenResponse(
          "Administrator tvrtke ne može kreirati globalnog administratora."
        );
      }
      if (
        body.company_id != null &&
        Number(body.company_id) !== session.activeCompanyId
      ) {
        return forbiddenResponse(
          "Administrator tvrtke može dodavati korisnike samo u vlastitu tvrtku."
        );
      }
      companyId = session.activeCompanyId;
    }

    const existing = getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Korisnik s tom e-mail adresom već postoji." },
        { status: 409 }
      );
    }

    const created = createUser({
      email,
      password,
      full_name: fullName,
      role,
      company_id: role === "global_admin" ? null : companyId,
      permissions: body.permissions,
      active: body.active === 0 ? 0 : 1,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return NextResponse.json(
      { error: "Greška pri kreiranju korisnika." },
      { status: 500 }
    );
  }
}
