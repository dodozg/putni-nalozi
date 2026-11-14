import { NextResponse } from "next/server";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth";
import {
  deleteUser,
  getSessionFromRequest,
  getUserById,
  updateUser,
} from "@/lib/db";
import type { UserRole } from "@/lib/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (
      session.user.role !== "global_admin" &&
      session.user.role !== "company_admin"
    ) {
      return forbiddenResponse(
        "Samo administratori mogu pregledavati korisnike."
      );
    }

    const { id } = await context.params;
    const targetUser = getUserById(Number(id));
    if (!targetUser) {
      return NextResponse.json(
        { error: "Korisnik nije pronađen." },
        { status: 404 }
      );
    }

    if (
      session.user.role === "company_admin" &&
      (targetUser.company_id !== session.activeCompanyId ||
        targetUser.role === "global_admin")
    ) {
      return forbiddenResponse(
        "Nemate ovlasti za pregled korisnika druge tvrtke."
      );
    }

    return NextResponse.json(targetUser);
  } catch (err) {
    console.error("GET /api/users/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri dohvaćanju korisnika." },
      { status: 500 }
    );
  }
}

async function handleUpdateUser(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (
      session.user.role !== "global_admin" &&
      session.user.role !== "company_admin"
    ) {
      return forbiddenResponse(
        "Samo administratori mogu uređivati korisnike."
      );
    }

    const { id } = await context.params;
    const targetId = Number(id);
    const targetUser = getUserById(targetId);

    if (!targetUser) {
      return NextResponse.json(
        { error: "Korisnik nije pronađen." },
        { status: 404 }
      );
    }

    if (session.user.role === "company_admin") {
      if (
        targetUser.company_id !== session.activeCompanyId ||
        targetUser.role === "global_admin"
      ) {
        return forbiddenResponse(
          "Možete uređivati samo korisnike unutar vlastite tvrtke."
        );
      }
    }

    const body = await request.json();

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

    const nextRole: UserRole | undefined = body.role;
    let nextCompanyId: number | null | undefined =
      body.company_id !== undefined
        ? body.company_id != null
          ? Number(body.company_id)
          : null
        : undefined;

    if (session.user.role === "company_admin") {
      if (nextRole === "global_admin") {
        return forbiddenResponse(
          "Administrator tvrtke ne može dodijeliti ulogu globalnog administratora."
        );
      }
      if (
        nextCompanyId !== undefined &&
        nextCompanyId !== session.activeCompanyId
      ) {
        return forbiddenResponse(
          "Administrator tvrtke ne može prebaciti korisnika u drugu tvrtku."
        );
      }
      nextCompanyId = session.activeCompanyId;
    }

    const updated = updateUser(targetId, {
      email: body.email !== undefined ? String(body.email).trim() : undefined,
      full_name:
        body.full_name !== undefined
          ? String(body.full_name).trim()
          : undefined,
      password:
        body.password !== undefined ? String(body.password) : undefined,
      role: nextRole,
      company_id: nextCompanyId,
      permissions: body.permissions,
      active:
        body.active !== undefined ? (body.active ? 1 : 0) : undefined,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/users/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri ažuriranju korisnika." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateUser(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateUser(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return unauthorizedResponse();

    if (
      session.user.role !== "global_admin" &&
      session.user.role !== "company_admin"
    ) {
      return forbiddenResponse("Samo administratori mogu brisati korisnike.");
    }

    const { id } = await context.params;
    const targetId = Number(id);

    if (targetId === session.user.id) {
      return NextResponse.json(
        { error: "Ne možete obrisati vlastiti korisnički račun." },
        { status: 400 }
      );
    }

    const targetUser = getUserById(targetId);
    if (!targetUser) {
      return NextResponse.json(
        { error: "Korisnik nije pronađen." },
        { status: 404 }
      );
    }

    if (session.user.role === "company_admin") {
      if (
        targetUser.company_id !== session.activeCompanyId ||
        targetUser.role === "global_admin"
      ) {
        return forbiddenResponse(
          "Možete brisati samo korisnike unutar vlastite tvrtke."
        );
      }
    }

    const deleted = deleteUser(targetId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Korisnik nije pronađen." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/users/[id] error:", err);
    return NextResponse.json(
      { error: "Greška pri brisanju korisnika." },
      { status: 500 }
    );
  }
}
