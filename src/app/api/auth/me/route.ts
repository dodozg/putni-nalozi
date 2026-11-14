import { NextResponse } from "next/server";
import {
  createSessionCookieHeader,
  createSessionToken,
  unauthorizedResponse,
} from "@/lib/auth";
import {
  buildAuthSession,
  getCompanyById,
  getSessionFromRequest,
  updateUser,
} from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedResponse();
    }
    return NextResponse.json(session);
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json(
      { error: "Greška pri provjeri prijave." },
      { status: 500 }
    );
  }
}

async function handleUpdateMe(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    let user = session.user;

    if (
      (body.role !== undefined && body.role !== user.role) ||
      body.permissions !== undefined ||
      (body.company_id !== undefined &&
        user.role !== "global_admin" &&
        Number(body.company_id) !== user.company_id)
    ) {
      return NextResponse.json(
        { error: "Nemate ovlasti za promjenu vlastite uloge ili dozvola." },
        { status: 403 }
      );
    }

    if (body.full_name || body.password) {
      const updated = updateUser(user.id, {
        full_name: body.full_name ? String(body.full_name).trim() : undefined,
        password: body.password ? String(body.password) : undefined,
      });
      if (updated) {
        user = updated;
      }
    }

    let nextCompanyId = session.activeCompanyId;
    const requestedCompanyId = Number(
      body.activeCompanyId ?? body.companyId ?? 0
    );

    if (requestedCompanyId > 0) {
      if (user.role !== "global_admin" && requestedCompanyId !== user.company_id) {
        return NextResponse.json(
          { error: "Samo globalni administrator može mijenjati aktivnu tvrtku." },
          { status: 403 }
        );
      }
      const targetCompany = getCompanyById(requestedCompanyId);
      if (!targetCompany) {
        return NextResponse.json(
          { error: "Odabrana tvrtka nije pronađena." },
          { status: 404 }
        );
      }
      nextCompanyId = targetCompany.id;
    }

    const newSession = buildAuthSession(user, nextCompanyId);
    const token = createSessionToken({
      userId: user.id,
      activeCompanyId: newSession.activeCompanyId,
    });

    const response = NextResponse.json({
      ...newSession,
      token,
    });
    response.headers.set("Set-Cookie", createSessionCookieHeader(token));
    return response;
  } catch (err) {
    console.error("POST/PATCH /api/auth/me error:", err);
    return NextResponse.json(
      { error: "Greška pri ažuriranju sesije." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return handleUpdateMe(request);
}

export async function PATCH(request: Request) {
  return handleUpdateMe(request);
}
