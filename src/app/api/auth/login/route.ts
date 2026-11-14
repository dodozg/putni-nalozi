import { NextResponse } from "next/server";
import {
  checkLoginRateLimit,
  createSessionCookieHeader,
  createSessionToken,
  extractClientIp,
  recordFailedLogin,
  resetLoginRateLimit,
} from "@/lib/auth";
import { authenticateUser, buildAuthSession } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail adresa i lozinka su obavezni." },
        { status: 400 }
      );
    }

    const clientIp = extractClientIp(request);
    const rateStatus = checkLoginRateLimit(clientIp, email);
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error: `Previše neuspješnih pokušaja prijave. Pokušajte ponovno za ${Math.ceil(
            rateStatus.retryAfterSeconds / 60
          )} min.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateStatus.retryAfterSeconds),
          },
        }
      );
    }

    const user = authenticateUser(email, password);
    if (!user) {
      recordFailedLogin(clientIp, email);
      const afterFail = checkLoginRateLimit(clientIp, email);
      if (!afterFail.allowed) {
        return NextResponse.json(
          {
            error: `Previše neuspješnih pokušaja prijave. Pokušajte ponovno za ${Math.ceil(
              afterFail.retryAfterSeconds / 60
            )} min.`,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(afterFail.retryAfterSeconds),
            },
          }
        );
      }
      return NextResponse.json(
        { error: "Neispravna e-mail adresa ili lozinka." },
        { status: 401 }
      );
    }

    resetLoginRateLimit(clientIp, email);

    const session = buildAuthSession(user, body.companyId);
    const token = createSessionToken({
      userId: user.id,
      activeCompanyId: session.activeCompanyId,
    });

    const response = NextResponse.json({
      ...session,
      token,
    });
    response.headers.set("Set-Cookie", createSessionCookieHeader(token));
    return response;
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json(
      { error: "Greška pri prijavi u sustav." },
      { status: 500 }
    );
  }
}
