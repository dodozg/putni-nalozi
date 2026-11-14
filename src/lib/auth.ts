import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  AuthSession,
  OrderStatus,
  UserPermissions,
  UserRole,
} from "./types";

export const SESSION_COOKIE_NAME = "pn_session";
export const SESSION_MAX_AGE_SECONDS = 604800; // 7 days
export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

const globalForAuth = globalThis as unknown as {
  __putniNaloziSessionSecret?: string;
  __putniNaloziLoginAttempts?: Map<
    string,
    { count: number; firstAttemptAt: number; lockedUntil: number }
  >;
};

export function getSessionSecret(): string {
  const envSecret =
    process.env.AUTH_SECRET || process.env.PUTNI_NALOZI_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }

  if (globalForAuth.__putniNaloziSessionSecret) {
    return globalForAuth.__putniNaloziSessionSecret;
  }

  const projectRoot = fs.existsSync(
    path.join(process.cwd(), "putni-nalozi", "package.json")
  )
    ? path.join(process.cwd(), "putni-nalozi")
    : process.cwd();
  const dataDir = path.join(projectRoot, "data");
  const secretFile = path.join(dataDir, ".session_secret");

  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, "utf8").trim();
      if (existing.length >= 32) {
        globalForAuth.__putniNaloziSessionSecret = existing;
        return existing;
      }
    }
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretFile, generated, { encoding: "utf8", mode: 0o600 });
    globalForAuth.__putniNaloziSessionSecret = generated;
    return generated;
  } catch {
    const fallback = crypto.randomBytes(32).toString("hex");
    globalForAuth.__putniNaloziSessionSecret = fallback;
    return fallback;
  }
}

export const ALL_PERMISSIONS: UserPermissions = {
  canManageTravelOrders: true,
  canApproveTravelOrders: true,
  canManageLoco: true,
  canManageMasterData: true,
  canViewAnalytics: true,
  canManageJoppd: true,
  canBackupRestore: true,
};

export const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  canManageTravelOrders: true,
  canApproveTravelOrders: false,
  canManageLoco: true,
  canManageMasterData: false,
  canViewAnalytics: true,
  canManageJoppd: false,
  canBackupRestore: false,
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (typeof password !== "string" || typeof storedHash !== "string") {
      return false;
    }
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    if (!salt || !key || !/^[0-9a-f]+$/i.test(key)) return false;
    const hashBuffer = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, "hex");
    if (hashBuffer.length !== keyBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, keyBuffer);
  } catch {
    return false;
  }
}

export interface SessionTokenPayload {
  userId: number;
  activeCompanyId: number;
  iat: number;
}

const ALLOWED_TOKEN_KEYS = new Set(["userId", "activeCompanyId", "iat"]);

export function createSessionToken(payload: {
  userId: number;
  activeCompanyId: number;
  iat?: number;
}): string {
  const data: SessionTokenPayload = {
    userId: Number(payload.userId),
    activeCompanyId: Number(payload.activeCompanyId),
    iat: payload.iat ?? Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(data), "utf8").toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    if (!encoded || !signature) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(signature)) {
      return null;
    }

    const expectedSig = crypto
      .createHmac("sha256", getSessionSecret())
      .update(encoded)
      .digest("base64url");
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expectedSig, "utf8");
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const decodedStr = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(decodedStr) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    // Reject tokens that contain unexpected/injected keys (e.g. role, permissions)
    for (const key of Object.keys(parsed)) {
      if (!ALLOWED_TOKEN_KEYS.has(key)) {
        return null;
      }
    }

    const userId = parsed.userId;
    const activeCompanyId = parsed.activeCompanyId;
    const iat = parsed.iat;

    if (
      typeof userId !== "number" ||
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }
    if (
      typeof activeCompanyId !== "number" ||
      !Number.isInteger(activeCompanyId) ||
      activeCompanyId <= 0
    ) {
      return null;
    }
    if (typeof iat !== "number" || !Number.isFinite(iat)) {
      return null;
    }

    const ageMs = Date.now() - iat;
    if (ageMs < -60_000 || ageMs > SESSION_MAX_AGE_MS) {
      return null;
    }

    return {
      userId,
      activeCompanyId,
      iat,
    };
  } catch {
    return null;
  }
}

export function createSessionCookieHeader(token: string): string {
  // Compatible with local HTTP deployment; only add Secure when explicitly enabled for HTTPS
  const secureFlag = process.env.FORCE_HTTPS_COOKIE === "1" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureFlag}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function extractTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";");
  for (const part of cookies) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === SESSION_COOKIE_NAME) {
      const value = rest.join("=").trim();
      if (value) {
        try {
          return decodeURIComponent(value);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function normalizePermissions(
  role: UserRole,
  rawPermissions?: Partial<UserPermissions> | string | null
): UserPermissions {
  if (role === "global_admin" || role === "company_admin") {
    return { ...ALL_PERMISSIONS };
  }
  let parsed: Partial<UserPermissions> = {};
  if (typeof rawPermissions === "string" && rawPermissions.trim()) {
    try {
      parsed = JSON.parse(rawPermissions) as Partial<UserPermissions>;
    } catch {
      parsed = {};
    }
  } else if (rawPermissions && typeof rawPermissions === "object") {
    parsed = rawPermissions;
  }

  return {
    canManageTravelOrders: Boolean(
      parsed.canManageTravelOrders ??
        DEFAULT_USER_PERMISSIONS.canManageTravelOrders
    ),
    canApproveTravelOrders: Boolean(
      parsed.canApproveTravelOrders ??
        DEFAULT_USER_PERMISSIONS.canApproveTravelOrders
    ),
    canManageLoco: Boolean(
      parsed.canManageLoco ?? DEFAULT_USER_PERMISSIONS.canManageLoco
    ),
    canManageMasterData: Boolean(
      parsed.canManageMasterData ?? DEFAULT_USER_PERMISSIONS.canManageMasterData
    ),
    canViewAnalytics: Boolean(
      parsed.canViewAnalytics ?? DEFAULT_USER_PERMISSIONS.canViewAnalytics
    ),
    canManageJoppd: Boolean(
      parsed.canManageJoppd ?? DEFAULT_USER_PERMISSIONS.canManageJoppd
    ),
    canBackupRestore: Boolean(
      parsed.canBackupRestore ?? DEFAULT_USER_PERMISSIONS.canBackupRestore
    ),
  };
}

export function normalizeOrderStatus(
  raw?: string | null
): OrderStatus | null {
  if (!raw || typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  if (upper === "NACRT" || upper === "DRAFT") return "NACRT";
  if (upper === "ODOBREN" || upper === "APPROVED") return "ODOBREN";
  if (upper === "OBRACUNAT" || upper === "LIQUIDATED") return "OBRACUNAT";
  if (upper === "ISPLACEN" || upper === "PAID") return "ISPLACEN";
  return null;
}

export function unauthorizedResponse(message = "Niste prijavljeni."): Response {
  return Response.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(
  message = "Nemate ovlasti za izvršavanje ove akcije."
): Response {
  return Response.json({ error: message }, { status: 403 });
}

export function hasPermission(
  session: AuthSession,
  permission: keyof UserPermissions
): boolean {
  if (
    session.user.role === "global_admin" ||
    session.user.role === "company_admin"
  ) {
    return true;
  }
  return Boolean(session.user.permissions?.[permission]);
}

// --- Brute-Force Login Protection (In-Memory Rate Limiter) ---
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_MAX_FAILED_ATTEMPTS = 10;

function getRateLimitMap() {
  if (!globalForAuth.__putniNaloziLoginAttempts) {
    globalForAuth.__putniNaloziLoginAttempts = new Map();
  }
  return globalForAuth.__putniNaloziLoginAttempts;
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "127.0.0.1";
}

export function checkLoginRateLimit(
  ip: string,
  email: string
): { allowed: boolean; remainingAttempts: number; retryAfterSeconds: number } {
  const map = getRateLimitMap();
  const now = Date.now();
  const normalizedEmail = (email || "").trim().toLowerCase();
  const key = `${ip || "127.0.0.1"}:${normalizedEmail}`;

  const entry = map.get(key);
  if (!entry) {
    return {
      allowed: true,
      remainingAttempts: LOGIN_MAX_FAILED_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  if (now - entry.firstAttemptAt > LOGIN_WINDOW_MS && now >= entry.lockedUntil) {
    map.delete(key);
    return {
      allowed: true,
      remainingAttempts: LOGIN_MAX_FAILED_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  if (entry.count >= LOGIN_MAX_FAILED_ATTEMPTS && now < entry.lockedUntil) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.lockedUntil - now) / 1000)
    );
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, LOGIN_MAX_FAILED_ATTEMPTS - entry.count),
    retryAfterSeconds: 0,
  };
}

export function recordFailedLogin(ip: string, email: string): void {
  const map = getRateLimitMap();
  const now = Date.now();
  const normalizedEmail = (email || "").trim().toLowerCase();
  const key = `${ip || "127.0.0.1"}:${normalizedEmail}`;

  const existing = map.get(key);
  if (!existing || now - existing.firstAttemptAt > LOGIN_WINDOW_MS) {
    map.set(key, {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: 0,
    });
    return;
  }

  const nextCount = existing.count + 1;
  const lockedUntil =
    nextCount >= LOGIN_MAX_FAILED_ATTEMPTS ? now + LOGIN_WINDOW_MS : 0;

  map.set(key, {
    count: nextCount,
    firstAttemptAt: existing.firstAttemptAt,
    lockedUntil,
  });
}

export function resetLoginRateLimit(ip: string, email: string): void {
  const map = getRateLimitMap();
  const normalizedEmail = (email || "").trim().toLowerCase();
  const key = `${ip || "127.0.0.1"}:${normalizedEmail}`;
  map.delete(key);
}

export function clearAllLoginRateLimits(): void {
  getRateLimitMap().clear();
}
