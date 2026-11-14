import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const nodeRequire =
  typeof require === "function" ? require : createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      run: (
        ...params: unknown[]
      ) => { lastInsertRowid: number | bigint; changes: number };
      get: (...params: unknown[]) => Record<string, unknown> | undefined;
      all: (...params: unknown[]) => Record<string, unknown>[];
    };
  };
};

import type {
  AuthSession,
  BackupPayload,
  Company,
  CompanyBackupData,
  CompanySettings,
  Employee,
  LocoTrip,
  TravelExpense,
  TravelOrder,
  User,
  UserPermissions,
  UserRole,
  Vehicle,
} from "./types";

const SESSION_COOKIE_NAME = "pn_session";
const SESSION_MAX_AGE_MS = 604800 * 1000;
const ALLOWED_TOKEN_KEYS = new Set(["userId", "activeCompanyId", "iat"]);

const PROJECT_ROOT = fs.existsSync(
  path.join(process.cwd(), "putni-nalozi", "package.json")
)
  ? path.join(process.cwd(), "putni-nalozi")
  : process.cwd();
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "putni_nalozi.db");

const globalForSecret = globalThis as unknown as {
  __putniNaloziSessionSecret?: string;
};

function getSessionSecret(): string {
  const envSecret =
    process.env.AUTH_SECRET || process.env.PUTNI_NALOZI_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }
  if (globalForSecret.__putniNaloziSessionSecret) {
    return globalForSecret.__putniNaloziSessionSecret;
  }
  const secretFile = path.join(DATA_DIR, ".session_secret");
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, "utf8").trim();
      if (existing.length >= 32) {
        globalForSecret.__putniNaloziSessionSecret = existing;
        return existing;
      }
    }
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretFile, generated, { encoding: "utf8", mode: 0o600 });
    globalForSecret.__putniNaloziSessionSecret = generated;
    return generated;
  } catch {
    const fallback = crypto.randomBytes(32).toString("hex");
    globalForSecret.__putniNaloziSessionSecret = fallback;
    return fallback;
  }
}

const ALL_PERMISSIONS: UserPermissions = {
  canManageTravelOrders: true,
  canApproveTravelOrders: true,
  canManageLoco: true,
  canManageMasterData: true,
  canViewAnalytics: true,
  canManageJoppd: true,
  canBackupRestore: true,
};

const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  canManageTravelOrders: true,
  canApproveTravelOrders: false,
  canManageLoco: true,
  canManageMasterData: false,
  canViewAnalytics: true,
  canManageJoppd: false,
  canBackupRestore: false,
};

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
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

function verifySessionToken(
  token: string
): { userId: number; activeCompanyId: number; iat: number } | null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    if (!encoded || !signature) return null;
    if (
      !/^[A-Za-z0-9_-]+$/.test(encoded) ||
      !/^[A-Za-z0-9_-]+$/.test(signature)
    ) {
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
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    for (const key of Object.keys(parsed)) {
      if (!ALLOWED_TOKEN_KEYS.has(key)) return null;
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
    return { userId, activeCompanyId, iat };
  } catch {
    return null;
  }
}

function extractTokenFromRequest(request: Request): string | null {
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

function normalizePermissions(
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

type SqliteDb = InstanceType<typeof DatabaseSync>;

function toPlain<T>(row: unknown): T {
  if (!row || typeof row !== "object") return row as T;
  return { ...(row as Record<string, unknown>) } as T;
}

function toPlainList<T>(rows: unknown[]): T[] {
  return rows.map((r) => toPlain<T>(r));
}

const SCHEMA_VERSION = 3;

const globalForDb = globalThis as unknown as {
  __putniNaloziDb?: SqliteDb;
  __putniNaloziSchemaVersion?: number;
};

export function getDb(): SqliteDb {
  if (
    globalForDb.__putniNaloziDb &&
    globalForDb.__putniNaloziSchemaVersion === SCHEMA_VERSION
  ) {
    return globalForDb.__putniNaloziDb;
  }

  let db: SqliteDb | undefined = globalForDb.__putniNaloziDb;
  if (!db) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      db = new DatabaseSync(DB_PATH);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA foreign_keys = ON;");
    } catch {
      db = new DatabaseSync(":memory:");
      db.exec("PRAGMA foreign_keys = ON;");
    }
  }

  initSchema(db);
  seedIfEmpty(db);

  globalForDb.__putniNaloziDb = db;
  globalForDb.__putniNaloziSchemaVersion = SCHEMA_VERSION;
  return db;
}

function hasColumn(db: SqliteDb, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return cols.some((c) => c.name === column);
}

function ensureColumn(
  db: SqliteDb,
  table: string,
  column: string,
  definition: string
) {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initSchema(db: SqliteDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      oib TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      iban TEXT NOT NULL DEFAULT '',
      director_name TEXT NOT NULL DEFAULT '',
      order_prefix TEXT NOT NULL DEFAULT 'PN',
      per_diem_full REAL NOT NULL DEFAULT 30.0,
      per_diem_half REAL NOT NULL DEFAULT 15.0,
      mileage_rate REAL NOT NULL DEFAULT 0.5,
      min_distance_km REAL NOT NULL DEFAULT 30,
      meal_deduction_one_pct REAL NOT NULL DEFAULT 30,
      meal_deduction_two_pct REAL NOT NULL DEFAULT 60,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('global_admin', 'company_admin', 'user')),
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      permissions TEXT NOT NULL DEFAULT '{}',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL UNIQUE DEFAULT 1,
      name TEXT NOT NULL,
      oib TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      iban TEXT NOT NULL DEFAULT '',
      director_name TEXT NOT NULL,
      order_prefix TEXT NOT NULL DEFAULT 'PN',
      per_diem_full REAL NOT NULL DEFAULT 30.0,
      per_diem_half REAL NOT NULL DEFAULT 15.0,
      mileage_rate REAL NOT NULL DEFAULT 0.5,
      min_distance_km REAL NOT NULL DEFAULT 30,
      meal_deduction_one_pct REAL NOT NULL DEFAULT 30,
      meal_deduction_two_pct REAL NOT NULL DEFAULT 60
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      full_name TEXT NOT NULL,
      oib TEXT NOT NULL,
      job_title TEXT NOT NULL,
      address TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      ownership_type TEXT NOT NULL CHECK (ownership_type IN ('SLUZBENO', 'PRIVATNO')),
      make_model TEXT NOT NULL,
      license_plate TEXT NOT NULL,
      employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      current_odometer REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS travel_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      order_number TEXT NOT NULL,
      year INTEGER NOT NULL,
      seq_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'NACRT' CHECK (status IN ('NACRT', 'ODOBREN', 'OBRACUNAT', 'ISPLACEN')),
      issue_date TEXT NOT NULL,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      purpose TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      distance_km REAL NOT NULL DEFAULT 0,
      departure_at TEXT NOT NULL,
      return_at TEXT NOT NULL,
      transport_type TEXT NOT NULL CHECK (transport_type IN ('PRIVATNO_VOZILO', 'SLUZBENO_VOZILO', 'JAVNI_PRIJEVOZ')),
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      odometer_start REAL NOT NULL DEFAULT 0,
      odometer_end REAL NOT NULL DEFAULT 0,
      total_km REAL NOT NULL DEFAULT 0,
      one_meal_days INTEGER NOT NULL DEFAULT 0,
      two_meals_days INTEGER NOT NULL DEFAULT 0,
      advance_payment_eur REAL NOT NULL DEFAULT 0,
      trip_report TEXT NOT NULL DEFAULT '',
      per_diem_total_eur REAL NOT NULL DEFAULT 0,
      mileage_total_eur REAL NOT NULL DEFAULT 0,
      expenses_total_eur REAL NOT NULL DEFAULT 0,
      total_amount_eur REAL NOT NULL DEFAULT 0,
      balance_due_eur REAL NOT NULL DEFAULT 0,
      approved_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS travel_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      travel_order_id INTEGER NOT NULL REFERENCES travel_orders(id) ON DELETE CASCADE,
      category TEXT NOT NULL CHECK (category IN ('CESTARINA', 'PARKING', 'SMJESTAJ', 'JAVNI_PRIJEVOZ', 'GORIVO', 'OSTALO')),
      description TEXT NOT NULL DEFAULT '',
      receipt_number TEXT NOT NULL DEFAULT '',
      expense_date TEXT NOT NULL DEFAULT '',
      amount_eur REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS loco_trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL DEFAULT 1,
      trip_date TEXT NOT NULL,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      purpose TEXT NOT NULL,
      odometer_start REAL NOT NULL DEFAULT 0,
      odometer_end REAL NOT NULL DEFAULT 0,
      distance_km REAL NOT NULL DEFAULT 0,
      rate_eur REAL NOT NULL DEFAULT 0.5,
      amount_eur REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'EVIDENTIRANO' CHECK (status IN ('EVIDENTIRANO', 'ISPLACENO')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate existing tables if they were created before multi-tenancy
  const settingsTableSql = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='company_settings'"
    )
    .get() as { sql?: string } | undefined;

  if (
    settingsTableSql?.sql &&
    (settingsTableSql.sql.includes("CHECK (id = 1)") ||
      !hasColumn(db, "company_settings", "company_id"))
  ) {
    db.exec(`
      ALTER TABLE company_settings RENAME TO company_settings_old;
      CREATE TABLE company_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL UNIQUE DEFAULT 1,
        name TEXT NOT NULL,
        oib TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        iban TEXT NOT NULL DEFAULT '',
        director_name TEXT NOT NULL,
        order_prefix TEXT NOT NULL DEFAULT 'PN',
        per_diem_full REAL NOT NULL DEFAULT 30.0,
        per_diem_half REAL NOT NULL DEFAULT 15.0,
        mileage_rate REAL NOT NULL DEFAULT 0.5,
        min_distance_km REAL NOT NULL DEFAULT 30,
        meal_deduction_one_pct REAL NOT NULL DEFAULT 30,
        meal_deduction_two_pct REAL NOT NULL DEFAULT 60
      );
      INSERT INTO company_settings (
        id, company_id, name, oib, address, city, iban, director_name, order_prefix,
        per_diem_full, per_diem_half, mileage_rate, min_distance_km,
        meal_deduction_one_pct, meal_deduction_two_pct
      )
      SELECT
        id, 1, name, oib, address, city, iban, director_name, order_prefix,
        per_diem_full, per_diem_half, mileage_rate, min_distance_km,
        meal_deduction_one_pct, meal_deduction_two_pct
      FROM company_settings_old;
      DROP TABLE company_settings_old;
    `);
  }

  ensureColumn(db, "employees", "company_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "vehicles", "company_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "travel_orders", "company_id", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "travel_orders", "country_code", "TEXT NOT NULL DEFAULT 'HR'");
  ensureColumn(db, "loco_trips", "company_id", "INTEGER NOT NULL DEFAULT 1");

  // Migrate travel_orders if order_number had a global UNIQUE constraint instead of per-company
  const ordersTableSql = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='travel_orders'"
    )
    .get() as { sql?: string } | undefined;

  if (
    ordersTableSql?.sql &&
    ordersTableSql.sql.includes("order_number TEXT NOT NULL UNIQUE")
  ) {
    db.exec("PRAGMA foreign_keys = OFF;");
    db.exec(`
      ALTER TABLE travel_orders RENAME TO travel_orders_old;
      CREATE TABLE travel_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL DEFAULT 1,
        order_number TEXT NOT NULL,
        year INTEGER NOT NULL,
        seq_number INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'NACRT' CHECK (status IN ('NACRT', 'ODOBREN', 'OBRACUNAT', 'ISPLACEN')),
        issue_date TEXT NOT NULL,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        purpose TEXT NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        distance_km REAL NOT NULL DEFAULT 0,
        departure_at TEXT NOT NULL,
        return_at TEXT NOT NULL,
        transport_type TEXT NOT NULL CHECK (transport_type IN ('PRIVATNO_VOZILO', 'SLUZBENO_VOZILO', 'JAVNI_PRIJEVOZ')),
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
        odometer_start REAL NOT NULL DEFAULT 0,
        odometer_end REAL NOT NULL DEFAULT 0,
        total_km REAL NOT NULL DEFAULT 0,
        one_meal_days INTEGER NOT NULL DEFAULT 0,
        two_meals_days INTEGER NOT NULL DEFAULT 0,
        advance_payment_eur REAL NOT NULL DEFAULT 0,
        trip_report TEXT NOT NULL DEFAULT '',
        per_diem_total_eur REAL NOT NULL DEFAULT 0,
        mileage_total_eur REAL NOT NULL DEFAULT 0,
        expenses_total_eur REAL NOT NULL DEFAULT 0,
        total_amount_eur REAL NOT NULL DEFAULT 0,
        balance_due_eur REAL NOT NULL DEFAULT 0,
        approved_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO travel_orders (
        id, company_id, order_number, year, seq_number, status, issue_date, employee_id,
        purpose, origin, destination, distance_km, departure_at, return_at,
        transport_type, vehicle_id, odometer_start, odometer_end, total_km,
        one_meal_days, two_meals_days, advance_payment_eur, trip_report,
        per_diem_total_eur, mileage_total_eur, expenses_total_eur,
        total_amount_eur, balance_due_eur, approved_by, created_at, updated_at
      )
      SELECT
        id, company_id, order_number, year, seq_number, status, issue_date, employee_id,
        purpose, origin, destination, distance_km, departure_at, return_at,
        transport_type, vehicle_id, odometer_start, odometer_end, total_km,
        one_meal_days, two_meals_days, advance_payment_eur, trip_report,
        per_diem_total_eur, mileage_total_eur, expenses_total_eur,
        total_amount_eur, balance_due_eur, approved_by, created_at, updated_at
      FROM travel_orders_old;
      DROP TABLE travel_orders_old;
    `);
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function seedIfEmpty(db: SqliteDb) {
  // 1. Seed Company 1 settings and data if company_settings is empty
  const existingSettings = db
    .prepare("SELECT COUNT(*) as cnt FROM company_settings")
    .get() as { cnt: number };

  if (existingSettings.cnt === 0) {
    db.prepare(`
      INSERT INTO company_settings (
        id, company_id, name, oib, address, city, iban, director_name, order_prefix,
        per_diem_full, per_diem_half, mileage_rate, min_distance_km,
        meal_deduction_one_pct, meal_deduction_two_pct
      ) VALUES (
        1, 1, 'Adriatik Tehnologije d.o.o.', '12345678901', 'Radnička cesta 80', '10000 Zagreb',
        'HR1223400091100123456', 'Ivan Horvat', 'PN',
        30.0, 15.0, 0.5, 30, 30, 60
      )
    `).run();

    const emp1 = db
      .prepare(`
      INSERT INTO employees (company_id, full_name, oib, job_title, address)
      VALUES (1, 'Marko Kovačević', '23456789012', 'Voditelj projekata', 'Ilica 142, Zagreb')
    `)
      .run();

    const emp2 = db
      .prepare(`
      INSERT INTO employees (company_id, full_name, oib, job_title, address)
      VALUES (1, 'Ana Babić', '34567890123', 'Konzultantica za prodaju', 'Vukovarska 45, Zagreb')
    `)
      .run();

    const emp3 = db
      .prepare(`
      INSERT INTO employees (company_id, full_name, oib, job_title, address)
      VALUES (1, 'Luka Novak', '45678901234', 'Terenski inženjer', 'Savska cesta 90, Zagreb')
    `)
      .run();

    const veh1 = db
      .prepare(`
      INSERT INTO vehicles (company_id, ownership_type, make_model, license_plate, employee_id, current_odometer)
      VALUES (1, 'PRIVATNO', 'Škoda Octavia 2.0 TDI', 'ZG-4582-HR', ?, 84250)
    `)
      .run(Number(emp1.lastInsertRowid));

    const veh2 = db
      .prepare(`
      INSERT INTO vehicles (company_id, ownership_type, make_model, license_plate, employee_id, current_odometer)
      VALUES (1, 'SLUZBENO', 'Volkswagen Golf 8', 'ZG-9012-AB', NULL, 41600)
    `)
      .run();

    const veh3 = db
      .prepare(`
      INSERT INTO vehicles (company_id, ownership_type, make_model, license_plate, employee_id, current_odometer)
      VALUES (1, 'PRIVATNO', 'Renault Clio 1.5 dCi', 'ZG-1129-CD', ?, 62140)
    `)
      .run(Number(emp2.lastInsertRowid));

    const ord1 = db
      .prepare(`
      INSERT INTO travel_orders (
        company_id, order_number, year, seq_number, status, issue_date, employee_id,
        purpose, origin, destination, distance_km,
        departure_at, return_at, transport_type, vehicle_id,
        odometer_start, odometer_end, total_km,
        one_meal_days, two_meals_days, advance_payment_eur,
        trip_report, per_diem_total_eur, mileage_total_eur,
        expenses_total_eur, total_amount_eur, balance_due_eur, approved_by
      ) VALUES (
        1, 'PN-2026-001', 2026, 1, 'OBRACUNAT', '2026-11-03', ?,
        'Implementacija ERP sustava i edukacija korisnika u luci Rijeka',
        'Zagreb', 'Rijeka', 165,
        '2026-11-04T07:30', '2026-11-05T18:00', 'PRIVATNO_VOZILO', ?,
        83920, 84250, 330,
        1, 0, 50.0,
        'Održana edukacija za 12 djelatnika i pušten modul skladišnog poslovanja u produkciju.',
        36.0, 165.0, 29.6, 230.6, 180.6, 'Ivan Horvat'
      )
    `)
      .run(Number(emp1.lastInsertRowid), Number(veh1.lastInsertRowid));

    db.prepare(`
      INSERT INTO travel_expenses (travel_order_id, category, description, receipt_number, expense_date, amount_eur)
      VALUES (?, 'CESTARINA', 'Autocesta A1/A6 Zagreb - Rijeka (povratno)', 'HAC-88219', '2026-11-04', 18.60)
    `).run(Number(ord1.lastInsertRowid));

    db.prepare(`
      INSERT INTO travel_expenses (travel_order_id, category, description, receipt_number, expense_date, amount_eur)
      VALUES (?, 'PARKING', 'Parking Delta Rijeka (2 dana)', 'RI-PAR-441', '2026-11-05', 11.00)
    `).run(Number(ord1.lastInsertRowid));

    db.prepare(`
      INSERT INTO travel_orders (
        company_id, order_number, year, seq_number, status, issue_date, employee_id,
        purpose, origin, destination, distance_km,
        departure_at, return_at, transport_type, vehicle_id,
        odometer_start, odometer_end, total_km,
        one_meal_days, two_meals_days, advance_payment_eur,
        trip_report, per_diem_total_eur, mileage_total_eur,
        expenses_total_eur, total_amount_eur, balance_due_eur, approved_by
      ) VALUES (
        1, 'PN-2026-002', 2026, 2, 'ODOBREN', '2026-11-10', ?,
        'Sastanak s klijentom Dalmacija Projekt d.o.o. oko godišnjeg ugovora',
        'Zagreb', 'Split', 410,
        '2026-11-12T06:00', '2026-11-12T21:30', 'SLUZBENO_VOZILO', ?,
        41600, 0, 0,
        0, 0, 0,
        '',
        30.0, 0, 0, 30.0, 30.0, 'Ivan Horvat'
      )
    `).run(Number(emp3.lastInsertRowid), Number(veh2.lastInsertRowid));

    db.prepare(`
      INSERT INTO loco_trips (
        company_id, trip_date, employee_id, vehicle_id, origin, destination, purpose,
        odometer_start, odometer_end, distance_km, rate_eur, amount_eur, status
      ) VALUES (
        1, '2026-11-08', ?, ?, 'Radnička cesta 80', 'Novi Zagreb - Buzin',
        'Dostava ugovora i potpisivanje kod javnog bilježnika',
        62110, 62128, 18, 0.5, 9.0, 'EVIDENTIRANO'
      )
    `).run(Number(emp2.lastInsertRowid), Number(veh3.lastInsertRowid));

    db.prepare(`
      INSERT INTO loco_trips (
        company_id, trip_date, employee_id, vehicle_id, origin, destination, purpose,
        odometer_start, odometer_end, distance_km, rate_eur, amount_eur, status
      ) VALUES (
        1, '2026-11-11', ?, ?, 'Radnička cesta 80', 'Jankomir poslovna zona',
        'Preuzimanje računalne opreme kod dobavljača',
        62128, 62140, 12, 0.5, 6.0, 'EVIDENTIRANO'
      )
    `).run(Number(emp2.lastInsertRowid), Number(veh3.lastInsertRowid));
  }

  // 2. Ensure companies table has Company 1 & Company 2
  const companiesCount = db
    .prepare("SELECT COUNT(*) as cnt FROM companies")
    .get() as { cnt: number };

  if (companiesCount.cnt === 0) {
    const s1 = db
      .prepare("SELECT * FROM company_settings WHERE company_id = 1 OR id = 1")
      .get() as CompanySettings | undefined;

    db.prepare(`
      INSERT INTO companies (
        id, name, oib, address, city, iban, director_name, order_prefix,
        per_diem_full, per_diem_half, mileage_rate, min_distance_km,
        meal_deduction_one_pct, meal_deduction_two_pct, active
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
      )
    `).run(
      s1?.name || "Adriatik Tehnologije d.o.o.",
      s1?.oib || "12345678901",
      s1?.address || "Radnička cesta 80",
      s1?.city || "10000 Zagreb",
      s1?.iban || "HR1223400091100123456",
      s1?.director_name || "Ivan Horvat",
      s1?.order_prefix || "PN",
      s1?.per_diem_full ?? 30.0,
      s1?.per_diem_half ?? 15.0,
      s1?.mileage_rate ?? 0.5,
      s1?.min_distance_km ?? 30,
      s1?.meal_deduction_one_pct ?? 30,
      s1?.meal_deduction_two_pct ?? 60
    );

    // Seed Company 2 for multi-tenant isolation & testing
    db.prepare(`
      INSERT INTO companies (
        id, name, oib, address, city, iban, director_name, order_prefix,
        per_diem_full, per_diem_half, mileage_rate, min_distance_km,
        meal_deduction_one_pct, meal_deduction_two_pct, active
      ) VALUES (
        2, 'Slavonija Logistika d.o.o.', '98765432109', 'Europska avenija 24', '31000 Osijek',
        'HR9823600001102938475', 'Marija Jurić', 'SL',
        30.0, 15.0, 0.5, 30, 30, 60, 1
      )
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO company_settings (
        company_id, name, oib, address, city, iban, director_name, order_prefix,
        per_diem_full, per_diem_half, mileage_rate, min_distance_km,
        meal_deduction_one_pct, meal_deduction_two_pct
      ) VALUES (
        2, 'Slavonija Logistika d.o.o.', '98765432109', 'Europska avenija 24', '31000 Osijek',
        'HR9823600001102938475', 'Marija Jurić', 'SL',
        30.0, 15.0, 0.5, 30, 30, 60
      )
    `).run();

    // Seed sample data for Company 2 so Company 2 has isolated records immediately
    const c2Emp1 = db
      .prepare(`
      INSERT INTO employees (company_id, full_name, oib, job_title, address)
      VALUES (2, 'Josip Knežević', '56789012345', 'Voditelj distribucije', 'Strossmayerova 112, Osijek')
    `)
      .run();

    const c2Emp2 = db
      .prepare(`
      INSERT INTO employees (company_id, full_name, oib, job_title, address)
      VALUES (2, 'Ivana Radić', '67890123456', 'Referentica nabave', 'Vukovarska 18, Osijek')
    `)
      .run();

    const c2Veh1 = db
      .prepare(`
      INSERT INTO vehicles (company_id, ownership_type, make_model, license_plate, employee_id, current_odometer)
      VALUES (2, 'SLUZBENO', 'Škoda Superb 2.0 TDI', 'OS-7741-SL', ?, 51200)
    `)
      .run(Number(c2Emp1.lastInsertRowid));

    db.prepare(`
      INSERT INTO travel_orders (
        company_id, order_number, year, seq_number, status, issue_date, employee_id,
        purpose, origin, destination, distance_km,
        departure_at, return_at, transport_type, vehicle_id,
        odometer_start, odometer_end, total_km,
        one_meal_days, two_meals_days, advance_payment_eur,
        trip_report, per_diem_total_eur, mileage_total_eur,
        expenses_total_eur, total_amount_eur, balance_due_eur, approved_by
      ) VALUES (
        2, 'SL-2026-001', 2026, 1, 'OBRACUNAT', '2026-11-06', ?,
        'Pregovori s logističkim partnerom u Zagrebu',
        'Osijek', 'Zagreb', 280,
        '2026-11-07T06:30', '2026-11-07T20:00', 'SLUZBENO_VOZILO', ?,
        50640, 51200, 560,
        0, 0, 0,
        'Uspješno dogovoreni uvjeti skladištenja i distribucije za Q1.',
        30.0, 0, 0, 30.0, 30.0, 'Marija Jurić'
      )
    `).run(Number(c2Emp1.lastInsertRowid), Number(c2Veh1.lastInsertRowid));

    db.prepare(`
      INSERT INTO loco_trips (
        company_id, trip_date, employee_id, vehicle_id, origin, destination, purpose,
        odometer_start, odometer_end, distance_km, rate_eur, amount_eur, status
      ) VALUES (
        2, '2026-11-09', ?, ?, 'Europska avenija 24', 'Industrijska zona Nemetin',
        'Kontrola carinskog skladišta',
        51200, 51216, 16, 0.5, 8.0, 'EVIDENTIRANO'
      )
    `).run(Number(c2Emp2.lastInsertRowid), Number(c2Veh1.lastInsertRowid));
  }

  // 3. Seed default demo accounts if users table is empty
  const usersCount = db
    .prepare("SELECT COUNT(*) as cnt FROM users")
    .get() as { cnt: number };

  if (usersCount.cnt === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role, company_id, permissions, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    insertUser.run(
      "admin@sustav.hr",
      hashPassword("admin123"),
      "Globalni Administrator",
      "global_admin",
      null,
      JSON.stringify(ALL_PERMISSIONS)
    );

    insertUser.run(
      "direktor@firma1.hr",
      hashPassword("firma123"),
      "Ivan Horvat (Direktor)",
      "company_admin",
      1,
      JSON.stringify(ALL_PERMISSIONS)
    );

    insertUser.run(
      "korisnik@firma1.hr",
      hashPassword("korisnik123"),
      "Marko Kovačević (Djelatnik)",
      "user",
      1,
      JSON.stringify(DEFAULT_USER_PERMISSIONS)
    );

    insertUser.run(
      "direktor@firma2.hr",
      hashPassword("firma234"),
      "Marija Jurić (Direktorica)",
      "company_admin",
      2,
      JSON.stringify(ALL_PERMISSIONS)
    );
  }
}

// --- Companies ---
export function listCompanies(): Company[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id) as employee_count,
              (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) as user_count,
              (SELECT COUNT(*) FROM travel_orders t WHERE t.company_id = c.id) as order_count
       FROM companies c
       ORDER BY c.id ASC`
    )
    .all();
  return toPlainList<Company>(rows);
}

export function getCompanyById(id: number): Company | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM employees e WHERE e.company_id = c.id) as employee_count,
              (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) as user_count,
              (SELECT COUNT(*) FROM travel_orders t WHERE t.company_id = c.id) as order_count
       FROM companies c
       WHERE c.id = ?`
    )
    .get(id);
  return row ? toPlain<Company>(row) : null;
}

export function createCompany(data: {
  name: string;
  oib: string;
  address?: string;
  city?: string;
  iban?: string;
  director_name?: string;
  order_prefix?: string;
  per_diem_full?: number;
  per_diem_half?: number;
  mileage_rate?: number;
  min_distance_km?: number;
  meal_deduction_one_pct?: number;
  meal_deduction_two_pct?: number;
}): Company {
  const db = getDb();
  const prefix = (data.order_prefix || "PN").toUpperCase();
  const res = db
    .prepare(
      `INSERT INTO companies (
        name, oib, address, city, iban, director_name, order_prefix,
        per_diem_full, per_diem_half, mileage_rate, min_distance_km,
        meal_deduction_one_pct, meal_deduction_two_pct, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      data.name,
      data.oib,
      data.address || "",
      data.city || "",
      data.iban || "",
      data.director_name || "",
      prefix,
      data.per_diem_full ?? 30.0,
      data.per_diem_half ?? 15.0,
      data.mileage_rate ?? 0.5,
      data.min_distance_km ?? 30,
      data.meal_deduction_one_pct ?? 30,
      data.meal_deduction_two_pct ?? 60
    );

  const companyId = Number(res.lastInsertRowid);
  db.prepare(
    `INSERT OR REPLACE INTO company_settings (
      company_id, name, oib, address, city, iban, director_name, order_prefix,
      per_diem_full, per_diem_half, mileage_rate, min_distance_km,
      meal_deduction_one_pct, meal_deduction_two_pct
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    companyId,
    data.name,
    data.oib,
    data.address || "",
    data.city || "",
    data.iban || "",
    data.director_name || "",
    prefix,
    data.per_diem_full ?? 30.0,
    data.per_diem_half ?? 15.0,
    data.mileage_rate ?? 0.5,
    data.min_distance_km ?? 30,
    data.meal_deduction_one_pct ?? 30,
    data.meal_deduction_two_pct ?? 60
  );

  return getCompanyById(companyId)!;
}

export function updateCompany(
  id: number,
  data: Partial<Omit<Company, "id" | "created_at">>
): Company | null {
  const db = getDb();
  const existing = getCompanyById(id);
  if (!existing) return null;

  const updated = {
    name: data.name ?? existing.name,
    oib: data.oib ?? existing.oib,
    address: data.address ?? existing.address,
    city: data.city ?? existing.city,
    iban: data.iban ?? existing.iban,
    director_name: data.director_name ?? existing.director_name,
    order_prefix: (data.order_prefix ?? existing.order_prefix).toUpperCase(),
    per_diem_full: data.per_diem_full ?? existing.per_diem_full,
    per_diem_half: data.per_diem_half ?? existing.per_diem_half,
    mileage_rate: data.mileage_rate ?? existing.mileage_rate,
    min_distance_km: data.min_distance_km ?? existing.min_distance_km,
    meal_deduction_one_pct:
      data.meal_deduction_one_pct ?? existing.meal_deduction_one_pct,
    meal_deduction_two_pct:
      data.meal_deduction_two_pct ?? existing.meal_deduction_two_pct,
    active: data.active ?? existing.active,
  };

  db.prepare(
    `UPDATE companies SET
      name = ?, oib = ?, address = ?, city = ?, iban = ?,
      director_name = ?, order_prefix = ?,
      per_diem_full = ?, per_diem_half = ?, mileage_rate = ?,
      min_distance_km = ?, meal_deduction_one_pct = ?, meal_deduction_two_pct = ?,
      active = ?
     WHERE id = ?`
  ).run(
    updated.name,
    updated.oib,
    updated.address,
    updated.city,
    updated.iban,
    updated.director_name,
    updated.order_prefix,
    updated.per_diem_full,
    updated.per_diem_half,
    updated.mileage_rate,
    updated.min_distance_km,
    updated.meal_deduction_one_pct,
    updated.meal_deduction_two_pct,
    updated.active,
    id
  );

  db.prepare(
    `INSERT INTO company_settings (
      company_id, name, oib, address, city, iban, director_name, order_prefix,
      per_diem_full, per_diem_half, mileage_rate, min_distance_km,
      meal_deduction_one_pct, meal_deduction_two_pct
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id) DO UPDATE SET
      name = excluded.name,
      oib = excluded.oib,
      address = excluded.address,
      city = excluded.city,
      iban = excluded.iban,
      director_name = excluded.director_name,
      order_prefix = excluded.order_prefix,
      per_diem_full = excluded.per_diem_full,
      per_diem_half = excluded.per_diem_half,
      mileage_rate = excluded.mileage_rate,
      min_distance_km = excluded.min_distance_km,
      meal_deduction_one_pct = excluded.meal_deduction_one_pct,
      meal_deduction_two_pct = excluded.meal_deduction_two_pct`
  ).run(
    id,
    updated.name,
    updated.oib,
    updated.address,
    updated.city,
    updated.iban,
    updated.director_name,
    updated.order_prefix,
    updated.per_diem_full,
    updated.per_diem_half,
    updated.mileage_rate,
    updated.min_distance_km,
    updated.meal_deduction_one_pct,
    updated.meal_deduction_two_pct
  );

  return getCompanyById(id);
}

export function deleteCompany(id: number): boolean {
  const db = getDb();
  const countRow = db
    .prepare("SELECT COUNT(*) as cnt FROM companies")
    .get() as { cnt: number };
  if (countRow.cnt <= 1) {
    throw new Error("Nije moguće obrisati jedinu preostalu tvrtku u sustavu.");
  }

  db.prepare("DELETE FROM loco_trips WHERE company_id = ?").run(id);
  db.prepare("DELETE FROM travel_orders WHERE company_id = ?").run(id);
  db.prepare("DELETE FROM vehicles WHERE company_id = ?").run(id);
  db.prepare("DELETE FROM employees WHERE company_id = ?").run(id);
  db.prepare("DELETE FROM company_settings WHERE company_id = ?").run(id);
  db.prepare("DELETE FROM users WHERE company_id = ? AND role != 'global_admin'").run(id);
  const res = db.prepare("DELETE FROM companies WHERE id = ?").run(id);
  return res.changes > 0;
}

// --- Users ---
function mapUserRow(row: Record<string, unknown>): User {
  const role = (row.role as UserRole) || "user";
  return {
    id: Number(row.id),
    email: String(row.email),
    full_name: String(row.full_name),
    role,
    company_id: row.company_id != null ? Number(row.company_id) : null,
    company_name: row.company_name ? String(row.company_name) : null,
    permissions: normalizePermissions(
      role,
      row.permissions as string | Partial<UserPermissions>
    ),
    active: Number(row.active ?? 1),
    created_at: String(row.created_at || ""),
  };
}

export function listUsers(companyId?: number): User[] {
  const db = getDb();
  const rows =
    companyId != null
      ? db
          .prepare(
            `SELECT u.*, c.name as company_name
             FROM users u
             LEFT JOIN companies c ON u.company_id = c.id
             WHERE u.company_id = ?
             ORDER BY u.active DESC, u.role ASC, u.full_name ASC`
          )
          .all(companyId)
      : db
          .prepare(
            `SELECT u.*, c.name as company_name
             FROM users u
             LEFT JOIN companies c ON u.company_id = c.id
             ORDER BY u.active DESC, u.role ASC, u.full_name ASC`
          )
          .all();
  return rows.map((r) => mapUserRow(r));
}

export function getUserById(id: number): User | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.*, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = ?`
    )
    .get(id);
  return row ? mapUserRow(row) : null;
}

export function getUserByEmail(email: string): (User & { password_hash: string }) | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.*, c.name as company_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE lower(u.email) = lower(?)`
    )
    .get(email.trim());
  if (!row) return null;
  return {
    ...mapUserRow(row),
    password_hash: String(row.password_hash),
  };
}

export function authenticateUser(
  email: string,
  password: string
): User | null {
  const found = getUserByEmail(email);
  if (!found || !found.active) return null;
  if (!verifyPassword(password, found.password_hash)) return null;
  const { password_hash: _unused, ...user } = found;
  void _unused;
  return user;
}

export function createUser(data: {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  company_id: number | null;
  permissions?: Partial<UserPermissions>;
  active?: number;
}): User {
  const db = getDb();
  const perms = normalizePermissions(data.role, data.permissions);
  const res = db
    .prepare(
      `INSERT INTO users (email, password_hash, full_name, role, company_id, permissions, active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.email.trim().toLowerCase(),
      hashPassword(data.password),
      data.full_name.trim(),
      data.role,
      data.role === "global_admin" ? null : data.company_id,
      JSON.stringify(perms),
      data.active ?? 1
    );
  return getUserById(Number(res.lastInsertRowid))!;
}

export function updateUser(
  id: number,
  data: {
    email?: string;
    password?: string;
    full_name?: string;
    role?: UserRole;
    company_id?: number | null;
    permissions?: Partial<UserPermissions>;
    active?: number;
  }
): User | null {
  const db = getDb();
  const existing = getUserById(id);
  if (!existing) return null;

  const nextRole = data.role ?? existing.role;
  const nextCompanyId =
    nextRole === "global_admin"
      ? null
      : data.company_id !== undefined
      ? data.company_id
      : existing.company_id;
  const nextPerms = normalizePermissions(
    nextRole,
    data.permissions ?? existing.permissions
  );

  db.prepare(
    `UPDATE users SET
      email = ?,
      full_name = ?,
      role = ?,
      company_id = ?,
      permissions = ?,
      active = ?
     WHERE id = ?`
  ).run(
    (data.email ?? existing.email).trim().toLowerCase(),
    (data.full_name ?? existing.full_name).trim(),
    nextRole,
    nextCompanyId,
    JSON.stringify(nextPerms),
    data.active ?? existing.active,
    id
  );

  if (data.password && data.password.trim().length > 0) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(data.password.trim()),
      id
    );
  }

  return getUserById(id);
}

export function deleteUser(id: number): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return res.changes > 0;
}

// --- Auth Session Resolution ---
export function buildAuthSession(
  user: User,
  requestedCompanyId?: number | null
): AuthSession {
  const allCompanies = listCompanies();
  const defaultCompany =
    allCompanies.find((c) => c.id === 1) || allCompanies[0];

  let activeCompanyId: number;
  if (user.role === "global_admin") {
    const candidate = requestedCompanyId || user.company_id || defaultCompany?.id || 1;
    const found = allCompanies.find((c) => c.id === Number(candidate));
    activeCompanyId = found ? found.id : defaultCompany?.id || 1;
  } else {
    activeCompanyId = user.company_id || defaultCompany?.id || 1;
  }

  const activeCompany =
    getCompanyById(activeCompanyId) ||
    defaultCompany || {
      id: 1,
      name: "Adriatik Tehnologije d.o.o.",
      oib: "12345678901",
      address: "Radnička cesta 80",
      city: "10000 Zagreb",
      iban: "HR1223400091100123456",
      director_name: "Ivan Horvat",
      order_prefix: "PN",
      per_diem_full: 30,
      per_diem_half: 15,
      mileage_rate: 0.5,
      min_distance_km: 30,
      meal_deduction_one_pct: 30,
      meal_deduction_two_pct: 60,
      active: 1,
      created_at: new Date().toISOString(),
    };

  return {
    user,
    activeCompanyId,
    activeCompany,
    companies: user.role === "global_admin" ? allCompanies : [activeCompany],
  };
}

export function getSessionFromRequest(request: Request): AuthSession | null {
  const token = extractTokenFromRequest(request);
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = getUserById(payload.userId);
  if (!user || !user.active) return null;

  let requestedCompanyId = payload.activeCompanyId;
  if (user.role === "global_admin") {
    const headerCompanyId = request.headers.get("x-company-id");
    if (headerCompanyId && Number(headerCompanyId) > 0) {
      requestedCompanyId = Number(headerCompanyId);
    } else {
      try {
        const url = new URL(request.url);
        const queryCompanyId = url.searchParams.get("companyId");
        if (queryCompanyId && Number(queryCompanyId) > 0) {
          requestedCompanyId = Number(queryCompanyId);
        }
      } catch {
        // ignore invalid URL
      }
    }
  }

  return buildAuthSession(user, requestedCompanyId);
}

// --- Settings ---
export function getCompanySettings(companyId = 1): CompanySettings {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM company_settings WHERE company_id = ?")
    .get(companyId) as unknown as CompanySettings | undefined;

  if (row) return toPlain<CompanySettings>(row);

  const comp = getCompanyById(companyId);
  if (comp) {
    return {
      id: comp.id,
      company_id: comp.id,
      name: comp.name,
      oib: comp.oib,
      address: comp.address,
      city: comp.city,
      iban: comp.iban,
      director_name: comp.director_name,
      order_prefix: comp.order_prefix,
      per_diem_full: comp.per_diem_full,
      per_diem_half: comp.per_diem_half,
      mileage_rate: comp.mileage_rate,
      min_distance_km: comp.min_distance_km,
      meal_deduction_one_pct: comp.meal_deduction_one_pct,
      meal_deduction_two_pct: comp.meal_deduction_two_pct,
    };
  }

  const fallback = db
    .prepare("SELECT * FROM company_settings ORDER BY id ASC LIMIT 1")
    .get() as unknown as CompanySettings;
  return toPlain<CompanySettings>(fallback);
}

export function updateCompanySettings(
  data: Omit<CompanySettings, "id">,
  companyId = 1
): CompanySettings {
  updateCompany(companyId, {
    name: data.name,
    oib: data.oib,
    address: data.address,
    city: data.city,
    iban: data.iban,
    director_name: data.director_name,
    order_prefix: data.order_prefix,
    per_diem_full: data.per_diem_full,
    per_diem_half: data.per_diem_half,
    mileage_rate: data.mileage_rate,
    min_distance_km: data.min_distance_km,
    meal_deduction_one_pct: data.meal_deduction_one_pct,
    meal_deduction_two_pct: data.meal_deduction_two_pct,
  });
  return getCompanySettings(companyId);
}

// --- Employees ---
export function listEmployees(
  companyId = 1,
  onlyActive = false
): Employee[] {
  const db = getDb();
  const sql = onlyActive
    ? "SELECT * FROM employees WHERE company_id = ? AND active = 1 ORDER BY full_name ASC"
    : "SELECT * FROM employees WHERE company_id = ? ORDER BY active DESC, full_name ASC";
  return toPlainList<Employee>(db.prepare(sql).all(companyId));
}

export function getEmployeeById(
  id: number,
  companyId = 1
): Employee | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM employees WHERE id = ? AND company_id = ?")
    .get(id, companyId);
  return row ? toPlain<Employee>(row) : null;
}

export function createEmployee(
  data: {
    full_name: string;
    oib: string;
    job_title: string;
    address: string;
  },
  companyId = 1
): Employee {
  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO employees (company_id, full_name, oib, job_title, address) VALUES (?, ?, ?, ?, ?)"
    )
    .run(companyId, data.full_name, data.oib, data.job_title, data.address);
  return toPlain<Employee>(
    db
      .prepare("SELECT * FROM employees WHERE id = ?")
      .get(Number(res.lastInsertRowid))
  );
}

export function updateEmployee(
  id: number,
  data: {
    full_name: string;
    oib: string;
    job_title: string;
    address: string;
    active: number;
  },
  companyId = 1
): Employee | null {
  const db = getDb();
  const res = db
    .prepare(
      "UPDATE employees SET full_name = ?, oib = ?, job_title = ?, address = ?, active = ? WHERE id = ? AND company_id = ?"
    )
    .run(
      data.full_name,
      data.oib,
      data.job_title,
      data.address,
      data.active,
      id,
      companyId
    );
  if (res.changes === 0) return null;
  const row = db
    .prepare("SELECT * FROM employees WHERE id = ? AND company_id = ?")
    .get(id, companyId);
  return row ? toPlain<Employee>(row) : null;
}

export function deleteEmployee(id: number, companyId = 1): boolean {
  const db = getDb();
  const existing = getEmployeeById(id, companyId);
  if (!existing) return false;
  db.prepare("DELETE FROM loco_trips WHERE employee_id = ? AND company_id = ?").run(
    id,
    companyId
  );
  db.prepare(
    "DELETE FROM travel_orders WHERE employee_id = ? AND company_id = ?"
  ).run(id, companyId);
  db.prepare(
    "UPDATE vehicles SET employee_id = NULL WHERE employee_id = ? AND company_id = ?"
  ).run(id, companyId);
  const res = db
    .prepare("DELETE FROM employees WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  return res.changes > 0;
}

// --- Vehicles ---
export function listVehicles(companyId = 1, onlyActive = false): Vehicle[] {
  const db = getDb();
  const activeFilter = onlyActive ? "AND v.active = 1" : "";
  const rows = db
    .prepare(
      `SELECT v.*, e.full_name as employee_name
       FROM vehicles v
       LEFT JOIN employees e ON v.employee_id = e.id
       WHERE v.company_id = ? ${activeFilter}
       ORDER BY v.active DESC, v.ownership_type ASC, v.make_model ASC`
    )
    .all(companyId);
  return toPlainList<Vehicle>(rows);
}

export function getVehicleById(id: number, companyId = 1): Vehicle | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT v.*, e.full_name as employee_name
       FROM vehicles v LEFT JOIN employees e ON v.employee_id = e.id
       WHERE v.id = ? AND v.company_id = ?`
    )
    .get(id, companyId);
  return row ? toPlain<Vehicle>(row) : null;
}

export function createVehicle(
  data: {
    ownership_type: string;
    make_model: string;
    license_plate: string;
    employee_id: number | null;
    current_odometer: number;
  },
  companyId = 1
): Vehicle {
  const db = getDb();
  if (data.employee_id) {
    const emp = getEmployeeById(Number(data.employee_id), companyId);
    if (!emp) {
      throw new Error("Odabrani djelatnik ne pripada aktivnoj tvrtki.");
    }
  }
  const res = db
    .prepare(
      "INSERT INTO vehicles (company_id, ownership_type, make_model, license_plate, employee_id, current_odometer) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      companyId,
      data.ownership_type,
      data.make_model,
      data.license_plate.toUpperCase(),
      data.employee_id || null,
      data.current_odometer || 0
    );
  return toPlain<Vehicle>(
    db
      .prepare(
        `SELECT v.*, e.full_name as employee_name
         FROM vehicles v LEFT JOIN employees e ON v.employee_id = e.id
         WHERE v.id = ?`
      )
      .get(Number(res.lastInsertRowid))
  );
}

export function updateVehicle(
  id: number,
  data: {
    ownership_type: string;
    make_model: string;
    license_plate: string;
    employee_id: number | null;
    current_odometer: number;
    active: number;
  },
  companyId = 1
): Vehicle | null {
  const db = getDb();
  if (data.employee_id) {
    const emp = getEmployeeById(Number(data.employee_id), companyId);
    if (!emp) {
      throw new Error("Odabrani djelatnik ne pripada aktivnoj tvrtki.");
    }
  }
  const res = db
    .prepare(
      "UPDATE vehicles SET ownership_type = ?, make_model = ?, license_plate = ?, employee_id = ?, current_odometer = ?, active = ? WHERE id = ? AND company_id = ?"
    )
    .run(
      data.ownership_type,
      data.make_model,
      data.license_plate.toUpperCase(),
      data.employee_id || null,
      data.current_odometer || 0,
      data.active,
      id,
      companyId
    );
  if (res.changes === 0) return null;
  const row = db
    .prepare(
      `SELECT v.*, e.full_name as employee_name
       FROM vehicles v LEFT JOIN employees e ON v.employee_id = e.id
       WHERE v.id = ? AND v.company_id = ?`
    )
    .get(id, companyId);
  return row ? toPlain<Vehicle>(row) : null;
}

export function deleteVehicle(id: number, companyId = 1): boolean {
  const db = getDb();
  const res = db
    .prepare("DELETE FROM vehicles WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  return res.changes > 0;
}

// --- Travel Orders ---
export function getNextOrderNumber(
  year: number,
  prefix: string,
  companyId = 1
): {
  order_number: string;
  seq_number: number;
} {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(seq_number), 0) as max_seq FROM travel_orders WHERE company_id = ? AND year = ?"
    )
    .get(companyId, year) as { max_seq: number };
  const seq = (row?.max_seq || 0) + 1;
  const padded = String(seq).padStart(3, "0");
  return {
    seq_number: seq,
    order_number: `${prefix}-${year}-${padded}`,
  };
}

export function listTravelOrders(companyId = 1): TravelOrder[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.*,
              e.full_name as employee_name,
              e.oib as employee_oib,
              e.job_title as employee_job_title,
              e.address as employee_address,
              v.make_model as vehicle_make_model,
              v.license_plate as vehicle_license_plate
       FROM travel_orders t
       JOIN employees e ON t.employee_id = e.id
       LEFT JOIN vehicles v ON t.vehicle_id = v.id
       WHERE t.company_id = ?
       ORDER BY t.year DESC, t.seq_number DESC`
    )
    .all(companyId);

  const orders = toPlainList<TravelOrder>(rows);
  const expStmt = db.prepare(
    "SELECT * FROM travel_expenses WHERE travel_order_id = ? ORDER BY id ASC"
  );
  return orders.map((o) => ({
    ...o,
    expenses: toPlainList<TravelExpense>(expStmt.all(o.id)),
  }));
}

export function getTravelOrderById(
  id: number,
  companyId?: number
): TravelOrder | null {
  const db = getDb();
  const row =
    companyId != null
      ? db
          .prepare(
            `SELECT t.*,
                    e.full_name as employee_name,
                    e.oib as employee_oib,
                    e.job_title as employee_job_title,
                    e.address as employee_address,
                    v.make_model as vehicle_make_model,
                    v.license_plate as vehicle_license_plate
             FROM travel_orders t
             JOIN employees e ON t.employee_id = e.id
             LEFT JOIN vehicles v ON t.vehicle_id = v.id
             WHERE t.id = ? AND t.company_id = ?`
          )
          .get(id, companyId)
      : db
          .prepare(
            `SELECT t.*,
                    e.full_name as employee_name,
                    e.oib as employee_oib,
                    e.job_title as employee_job_title,
                    e.address as employee_address,
                    v.make_model as vehicle_make_model,
                    v.license_plate as vehicle_license_plate
             FROM travel_orders t
             JOIN employees e ON t.employee_id = e.id
             LEFT JOIN vehicles v ON t.vehicle_id = v.id
             WHERE t.id = ?`
          )
          .get(id);

  if (!row) return null;
  const order = toPlain<TravelOrder>(row);

  const expenses = toPlainList<TravelExpense>(
    db
      .prepare(
        "SELECT * FROM travel_expenses WHERE travel_order_id = ? ORDER BY id ASC"
      )
      .all(id)
  );

  return { ...order, expenses };
}

export function createTravelOrder(
  payload: Omit<
    TravelOrder,
    | "id"
    | "order_number"
    | "year"
    | "seq_number"
    | "created_at"
    | "updated_at"
    | "employee_name"
    | "employee_oib"
    | "employee_job_title"
    | "employee_address"
    | "vehicle_make_model"
    | "vehicle_license_plate"
  >,
  companyId = 1
): TravelOrder {
  const db = getDb();
  const emp = getEmployeeById(Number(payload.employee_id), companyId);
  if (!emp) {
    throw new Error("Odabrani djelatnik ne pripada aktivnoj tvrtki.");
  }
  if (payload.vehicle_id) {
    const veh = getVehicleById(Number(payload.vehicle_id), companyId);
    if (!veh) {
      throw new Error("Odabrano vozilo ne pripada aktivnoj tvrtki.");
    }
  }

  const settings = getCompanySettings(companyId);
  const year = payload.issue_date
    ? Number(payload.issue_date.slice(0, 4)) || new Date().getFullYear()
    : new Date().getFullYear();

  const { order_number, seq_number } = getNextOrderNumber(
    year,
    settings.order_prefix || "PN",
    companyId
  );

  const countryCode = (payload.country_code || "HR").toUpperCase();

  const res = db
    .prepare(
      `INSERT INTO travel_orders (
        company_id, order_number, year, seq_number, status, issue_date, employee_id,
        purpose, origin, destination, country_code, distance_km,
        departure_at, return_at, transport_type, vehicle_id,
        odometer_start, odometer_end, total_km,
        one_meal_days, two_meals_days, advance_payment_eur,
        trip_report, per_diem_total_eur, mileage_total_eur,
        expenses_total_eur, total_amount_eur, balance_due_eur, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      order_number,
      year,
      seq_number,
      payload.status || "NACRT",
      payload.issue_date,
      payload.employee_id,
      payload.purpose,
      payload.origin,
      payload.destination,
      countryCode,
      payload.distance_km || 0,
      payload.departure_at,
      payload.return_at,
      payload.transport_type,
      payload.vehicle_id || null,
      payload.odometer_start || 0,
      payload.odometer_end || 0,
      payload.total_km || 0,
      payload.one_meal_days || 0,
      payload.two_meals_days || 0,
      payload.advance_payment_eur || 0,
      payload.trip_report || "",
      payload.per_diem_total_eur || 0,
      payload.mileage_total_eur || 0,
      payload.expenses_total_eur || 0,
      payload.total_amount_eur || 0,
      payload.balance_due_eur || 0,
      payload.approved_by || settings.director_name
    );

  const orderId = Number(res.lastInsertRowid);

  if (payload.expenses && payload.expenses.length > 0) {
    const insertExp = db.prepare(
      "INSERT INTO travel_expenses (travel_order_id, category, description, receipt_number, expense_date, amount_eur) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const exp of payload.expenses) {
      insertExp.run(
        orderId,
        exp.category,
        exp.description || "",
        exp.receipt_number || "",
        exp.expense_date || "",
        Number(exp.amount_eur) || 0
      );
    }
  }

  if (payload.vehicle_id && payload.odometer_end > 0) {
    db.prepare(
      "UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ? AND company_id = ?"
    ).run(payload.odometer_end, payload.vehicle_id, companyId);
  }

  return getTravelOrderById(orderId, companyId)!;
}

export function updateTravelOrder(
  id: number,
  payload: Omit<
    TravelOrder,
    | "id"
    | "order_number"
    | "year"
    | "seq_number"
    | "created_at"
    | "updated_at"
    | "employee_name"
    | "employee_oib"
    | "employee_job_title"
    | "employee_address"
    | "vehicle_make_model"
    | "vehicle_license_plate"
  >,
  companyId = 1
): TravelOrder | null {
  const db = getDb();
  const existing = getTravelOrderById(id, companyId);
  if (!existing) return null;

  const emp = getEmployeeById(Number(payload.employee_id), companyId);
  if (!emp) {
    throw new Error("Odabrani djelatnik ne pripada aktivnoj tvrtki.");
  }
  if (payload.vehicle_id) {
    const veh = getVehicleById(Number(payload.vehicle_id), companyId);
    if (!veh) {
      throw new Error("Odabrano vozilo ne pripada aktivnoj tvrtki.");
    }
  }

  const countryCode = (
    payload.country_code ||
    existing.country_code ||
    "HR"
  ).toUpperCase();

  db.prepare(
    `UPDATE travel_orders SET
      status = ?, issue_date = ?, employee_id = ?,
      purpose = ?, origin = ?, destination = ?, country_code = ?, distance_km = ?,
      departure_at = ?, return_at = ?, transport_type = ?, vehicle_id = ?,
      odometer_start = ?, odometer_end = ?, total_km = ?,
      one_meal_days = ?, two_meals_days = ?, advance_payment_eur = ?,
      trip_report = ?, per_diem_total_eur = ?, mileage_total_eur = ?,
      expenses_total_eur = ?, total_amount_eur = ?, balance_due_eur = ?,
      approved_by = ?, updated_at = datetime('now')
     WHERE id = ? AND company_id = ?`
  ).run(
    payload.status,
    payload.issue_date,
    payload.employee_id,
    payload.purpose,
    payload.origin,
    payload.destination,
    countryCode,
    payload.distance_km || 0,
    payload.departure_at,
    payload.return_at,
    payload.transport_type,
    payload.vehicle_id || null,
    payload.odometer_start || 0,
    payload.odometer_end || 0,
    payload.total_km || 0,
    payload.one_meal_days || 0,
    payload.two_meals_days || 0,
    payload.advance_payment_eur || 0,
    payload.trip_report || "",
    payload.per_diem_total_eur || 0,
    payload.mileage_total_eur || 0,
    payload.expenses_total_eur || 0,
    payload.total_amount_eur || 0,
    payload.balance_due_eur || 0,
    payload.approved_by || "",
    id,
    companyId
  );

  db.prepare("DELETE FROM travel_expenses WHERE travel_order_id = ?").run(id);
  if (payload.expenses && payload.expenses.length > 0) {
    const insertExp = db.prepare(
      "INSERT INTO travel_expenses (travel_order_id, category, description, receipt_number, expense_date, amount_eur) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const exp of payload.expenses) {
      insertExp.run(
        id,
        exp.category,
        exp.description || "",
        exp.receipt_number || "",
        exp.expense_date || "",
        Number(exp.amount_eur) || 0
      );
    }
  }

  if (payload.vehicle_id && payload.odometer_end > 0) {
    db.prepare(
      "UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ? AND company_id = ?"
    ).run(payload.odometer_end, payload.vehicle_id, companyId);
  }

  return getTravelOrderById(id, companyId);
}

export function deleteTravelOrder(id: number, companyId = 1): boolean {
  const db = getDb();
  const res = db
    .prepare("DELETE FROM travel_orders WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  return res.changes > 0;
}

// --- Loco Trips ---
export function listLocoTrips(companyId = 1): LocoTrip[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT l.*,
              e.full_name as employee_name,
              e.oib as employee_oib,
              v.make_model as vehicle_make_model,
              v.license_plate as vehicle_license_plate
       FROM loco_trips l
       JOIN employees e ON l.employee_id = e.id
       LEFT JOIN vehicles v ON l.vehicle_id = v.id
       WHERE l.company_id = ?
       ORDER BY l.trip_date DESC, l.id DESC`
    )
    .all(companyId);
  return toPlainList<LocoTrip>(rows);
}

export function getLocoTripById(
  id: number,
  companyId = 1
): LocoTrip | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT l.*,
              e.full_name as employee_name,
              e.oib as employee_oib,
              v.make_model as vehicle_make_model,
              v.license_plate as vehicle_license_plate
       FROM loco_trips l
       JOIN employees e ON l.employee_id = e.id
       LEFT JOIN vehicles v ON l.vehicle_id = v.id
       WHERE l.id = ? AND l.company_id = ?`
    )
    .get(id, companyId);
  return row ? toPlain<LocoTrip>(row) : null;
}

export function createLocoTrip(
  data: {
    trip_date: string;
    employee_id: number;
    vehicle_id: number | null;
    origin: string;
    destination: string;
    purpose: string;
    odometer_start: number;
    odometer_end: number;
    distance_km: number;
    rate_eur: number;
    amount_eur: number;
    status?: string;
  },
  companyId = 1
): LocoTrip {
  const db = getDb();
  const emp = getEmployeeById(Number(data.employee_id), companyId);
  if (!emp) {
    throw new Error("Odabrani djelatnik ne pripada aktivnoj tvrtki.");
  }
  if (data.vehicle_id) {
    const veh = getVehicleById(Number(data.vehicle_id), companyId);
    if (!veh) {
      throw new Error("Odabrano vozilo ne pripada aktivnoj tvrtki.");
    }
  }

  const res = db
    .prepare(
      `INSERT INTO loco_trips (
        company_id, trip_date, employee_id, vehicle_id, origin, destination, purpose,
        odometer_start, odometer_end, distance_km, rate_eur, amount_eur, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyId,
      data.trip_date,
      data.employee_id,
      data.vehicle_id || null,
      data.origin,
      data.destination,
      data.purpose,
      data.odometer_start || 0,
      data.odometer_end || 0,
      data.distance_km || 0,
      data.rate_eur,
      data.amount_eur,
      data.status || "EVIDENTIRANO"
    );

  if (data.vehicle_id && data.odometer_end > 0) {
    db.prepare(
      "UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ? AND company_id = ?"
    ).run(data.odometer_end, data.vehicle_id, companyId);
  }

  return toPlain<LocoTrip>(
    db
      .prepare(
        `SELECT l.*, e.full_name as employee_name, e.oib as employee_oib,
                v.make_model as vehicle_make_model, v.license_plate as vehicle_license_plate
         FROM loco_trips l
         JOIN employees e ON l.employee_id = e.id
         LEFT JOIN vehicles v ON l.vehicle_id = v.id
         WHERE l.id = ?`
      )
      .get(Number(res.lastInsertRowid))
  );
}

export function updateLocoTripStatus(
  id: number,
  status: string,
  companyId = 1
): boolean {
  const db = getDb();
  const res = db
    .prepare("UPDATE loco_trips SET status = ? WHERE id = ? AND company_id = ?")
    .run(status, id, companyId);
  return res.changes > 0;
}

export function deleteLocoTrip(id: number, companyId = 1): boolean {
  const db = getDb();
  const res = db
    .prepare("DELETE FROM loco_trips WHERE id = ? AND company_id = ?")
    .run(id, companyId);
  return res.changes > 0;
}

// --- Backup & Restore ---
function buildSingleCompanyBackupData(companyId: number): CompanyBackupData {
  const company = getCompanyById(companyId)!;
  const settings = getCompanySettings(companyId);
  const employees = listEmployees(companyId, false);
  const vehicles = listVehicles(companyId, false);
  const travelOrders = listTravelOrders(companyId);
  const locoTrips = listLocoTrips(companyId);
  const users = listUsers(companyId);

  return {
    company,
    settings,
    employees,
    vehicles,
    travelOrders,
    locoTrips,
    users,
  };
}

export function exportCompanyBackup(
  companyId: number,
  exportedBy: string
): BackupPayload {
  return {
    version: "2.0.0",
    exportedAt: new Date().toISOString(),
    exportedBy,
    scope: "company",
    companyData: buildSingleCompanyBackupData(companyId),
  };
}

export function exportFullSystemBackup(exportedBy: string): BackupPayload {
  const companies = listCompanies();
  const allCompaniesData = companies.map((c) =>
    buildSingleCompanyBackupData(c.id)
  );
  const globalUsers = listUsers().filter((u) => u.role === "global_admin");

  return {
    version: "2.0.0",
    exportedAt: new Date().toISOString(),
    exportedBy,
    scope: "all",
    companyData: allCompaniesData[0],
    allCompaniesData,
    globalUsers,
  };
}

function restoreSingleCompanyData(
  targetCompanyId: number,
  data: CompanyBackupData,
  mode: "merge" | "replace"
) {
  const db = getDb();

  if (data.settings) {
    updateCompanySettings(
      {
        name: data.settings.name || data.company?.name || "Tvrtka",
        oib: data.settings.oib || data.company?.oib || "",
        address: data.settings.address ?? data.company?.address ?? "",
        city: data.settings.city ?? data.company?.city ?? "",
        iban: data.settings.iban ?? data.company?.iban ?? "",
        director_name:
          data.settings.director_name ?? data.company?.director_name ?? "",
        order_prefix:
          data.settings.order_prefix ?? data.company?.order_prefix ?? "PN",
        per_diem_full: Number(data.settings.per_diem_full ?? 30),
        per_diem_half: Number(data.settings.per_diem_half ?? 15),
        mileage_rate: Number(data.settings.mileage_rate ?? 0.5),
        min_distance_km: Number(data.settings.min_distance_km ?? 30),
        meal_deduction_one_pct: Number(
          data.settings.meal_deduction_one_pct ?? 30
        ),
        meal_deduction_two_pct: Number(
          data.settings.meal_deduction_two_pct ?? 60
        ),
      },
      targetCompanyId
    );
  }

  if (mode === "replace") {
    db.prepare("DELETE FROM loco_trips WHERE company_id = ?").run(
      targetCompanyId
    );
    db.prepare("DELETE FROM travel_orders WHERE company_id = ?").run(
      targetCompanyId
    );
    db.prepare("DELETE FROM vehicles WHERE company_id = ?").run(
      targetCompanyId
    );
    db.prepare("DELETE FROM employees WHERE company_id = ?").run(
      targetCompanyId
    );
  }

  const empIdMap = new Map<number, number>();
  const vehIdMap = new Map<number, number>();

  let employeesRestored = 0;
  let vehiclesRestored = 0;
  let ordersRestored = 0;
  let locoTripsRestored = 0;

  for (const emp of data.employees || []) {
    const existing =
      mode === "merge"
        ? (db
            .prepare(
              "SELECT id FROM employees WHERE company_id = ? AND (oib = ? OR lower(full_name) = lower(?))"
            )
            .get(targetCompanyId, emp.oib, emp.full_name) as
            | { id: number }
            | undefined)
        : undefined;

    if (existing) {
      db.prepare(
        "UPDATE employees SET full_name = ?, oib = ?, job_title = ?, address = ?, active = ? WHERE id = ?"
      ).run(
        emp.full_name,
        emp.oib,
        emp.job_title,
        emp.address || "",
        emp.active ?? 1,
        existing.id
      );
      if (emp.id != null) empIdMap.set(Number(emp.id), existing.id);
      employeesRestored++;
    } else {
      const res = db
        .prepare(
          "INSERT INTO employees (company_id, full_name, oib, job_title, address, active) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(
          targetCompanyId,
          emp.full_name,
          emp.oib,
          emp.job_title,
          emp.address || "",
          emp.active ?? 1
        );
      const newId = Number(res.lastInsertRowid);
      if (emp.id != null) empIdMap.set(Number(emp.id), newId);
      employeesRestored++;
    }
  }

  for (const veh of data.vehicles || []) {
    const mappedEmpId =
      veh.employee_id != null
        ? empIdMap.get(Number(veh.employee_id)) ?? null
        : null;

    const existing =
      mode === "merge"
        ? (db
            .prepare(
              "SELECT id FROM vehicles WHERE company_id = ? AND upper(license_plate) = upper(?)"
            )
            .get(targetCompanyId, veh.license_plate) as
            | { id: number }
            | undefined)
        : undefined;

    if (existing) {
      db.prepare(
        "UPDATE vehicles SET ownership_type = ?, make_model = ?, license_plate = ?, employee_id = ?, current_odometer = ?, active = ? WHERE id = ?"
      ).run(
        veh.ownership_type,
        veh.make_model,
        veh.license_plate.toUpperCase(),
        mappedEmpId,
        veh.current_odometer || 0,
        veh.active ?? 1,
        existing.id
      );
      if (veh.id != null) vehIdMap.set(Number(veh.id), existing.id);
      vehiclesRestored++;
    } else {
      const res = db
        .prepare(
          "INSERT INTO vehicles (company_id, ownership_type, make_model, license_plate, employee_id, current_odometer, active) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          targetCompanyId,
          veh.ownership_type,
          veh.make_model,
          veh.license_plate.toUpperCase(),
          mappedEmpId,
          veh.current_odometer || 0,
          veh.active ?? 1
        );
      const newId = Number(res.lastInsertRowid);
      if (veh.id != null) vehIdMap.set(Number(veh.id), newId);
      vehiclesRestored++;
    }
  }

  const fallbackEmp = db
    .prepare(
      "SELECT id FROM employees WHERE company_id = ? ORDER BY id ASC LIMIT 1"
    )
    .get(targetCompanyId) as { id: number } | undefined;

  for (const ord of data.travelOrders || []) {
    const mappedEmpId =
      empIdMap.get(Number(ord.employee_id)) ?? fallbackEmp?.id;
    if (!mappedEmpId) continue;

    const mappedVehId =
      ord.vehicle_id != null
        ? vehIdMap.get(Number(ord.vehicle_id)) ?? null
        : null;

    const existing =
      mode === "merge"
        ? (db
            .prepare(
              "SELECT id FROM travel_orders WHERE company_id = ? AND order_number = ?"
            )
            .get(targetCompanyId, ord.order_number) as
            | { id: number }
            | undefined)
        : undefined;

    let orderId: number;
    if (existing) {
      db.prepare(
        `UPDATE travel_orders SET
          year = ?, seq_number = ?, status = ?, issue_date = ?, employee_id = ?,
          purpose = ?, origin = ?, destination = ?, distance_km = ?,
          departure_at = ?, return_at = ?, transport_type = ?, vehicle_id = ?,
          odometer_start = ?, odometer_end = ?, total_km = ?,
          one_meal_days = ?, two_meals_days = ?, advance_payment_eur = ?,
          trip_report = ?, per_diem_total_eur = ?, mileage_total_eur = ?,
          expenses_total_eur = ?, total_amount_eur = ?, balance_due_eur = ?,
          approved_by = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        ord.year,
        ord.seq_number,
        ord.status,
        ord.issue_date,
        mappedEmpId,
        ord.purpose,
        ord.origin,
        ord.destination,
        ord.distance_km || 0,
        ord.departure_at,
        ord.return_at,
        ord.transport_type,
        mappedVehId,
        ord.odometer_start || 0,
        ord.odometer_end || 0,
        ord.total_km || 0,
        ord.one_meal_days || 0,
        ord.two_meals_days || 0,
        ord.advance_payment_eur || 0,
        ord.trip_report || "",
        ord.per_diem_total_eur || 0,
        ord.mileage_total_eur || 0,
        ord.expenses_total_eur || 0,
        ord.total_amount_eur || 0,
        ord.balance_due_eur || 0,
        ord.approved_by || "",
        existing.id
      );
      orderId = existing.id;
      db.prepare("DELETE FROM travel_expenses WHERE travel_order_id = ?").run(
        orderId
      );
    } else {
      const res = db
        .prepare(
          `INSERT INTO travel_orders (
            company_id, order_number, year, seq_number, status, issue_date, employee_id,
            purpose, origin, destination, distance_km,
            departure_at, return_at, transport_type, vehicle_id,
            odometer_start, odometer_end, total_km,
            one_meal_days, two_meals_days, advance_payment_eur,
            trip_report, per_diem_total_eur, mileage_total_eur,
            expenses_total_eur, total_amount_eur, balance_due_eur, approved_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          targetCompanyId,
          ord.order_number,
          ord.year,
          ord.seq_number,
          ord.status || "NACRT",
          ord.issue_date,
          mappedEmpId,
          ord.purpose,
          ord.origin,
          ord.destination,
          ord.distance_km || 0,
          ord.departure_at,
          ord.return_at,
          ord.transport_type || "PRIVATNO_VOZILO",
          mappedVehId,
          ord.odometer_start || 0,
          ord.odometer_end || 0,
          ord.total_km || 0,
          ord.one_meal_days || 0,
          ord.two_meals_days || 0,
          ord.advance_payment_eur || 0,
          ord.trip_report || "",
          ord.per_diem_total_eur || 0,
          ord.mileage_total_eur || 0,
          ord.expenses_total_eur || 0,
          ord.total_amount_eur || 0,
          ord.balance_due_eur || 0,
          ord.approved_by || ""
        );
      orderId = Number(res.lastInsertRowid);
    }

    if (ord.expenses && ord.expenses.length > 0) {
      const insertExp = db.prepare(
        "INSERT INTO travel_expenses (travel_order_id, category, description, receipt_number, expense_date, amount_eur) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const exp of ord.expenses) {
        insertExp.run(
          orderId,
          exp.category,
          exp.description || "",
          exp.receipt_number || "",
          exp.expense_date || "",
          Number(exp.amount_eur) || 0
        );
      }
    }
    ordersRestored++;
  }

  for (const loco of data.locoTrips || []) {
    const mappedEmpId =
      empIdMap.get(Number(loco.employee_id)) ?? fallbackEmp?.id;
    if (!mappedEmpId) continue;

    const mappedVehId =
      loco.vehicle_id != null
        ? vehIdMap.get(Number(loco.vehicle_id)) ?? null
        : null;

    if (mode === "merge") {
      const dup = db
        .prepare(
          "SELECT id FROM loco_trips WHERE company_id = ? AND trip_date = ? AND origin = ? AND destination = ? AND purpose = ?"
        )
        .get(
          targetCompanyId,
          loco.trip_date,
          loco.origin,
          loco.destination,
          loco.purpose
        );
      if (dup) {
        locoTripsRestored++;
        continue;
      }
    }

    db.prepare(
      `INSERT INTO loco_trips (
        company_id, trip_date, employee_id, vehicle_id, origin, destination, purpose,
        odometer_start, odometer_end, distance_km, rate_eur, amount_eur, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      targetCompanyId,
      loco.trip_date,
      mappedEmpId,
      mappedVehId,
      loco.origin,
      loco.destination,
      loco.purpose,
      loco.odometer_start || 0,
      loco.odometer_end || 0,
      loco.distance_km || 0,
      loco.rate_eur || 0.5,
      loco.amount_eur || 0,
      loco.status || "EVIDENTIRANO"
    );
    locoTripsRestored++;
  }

  return {
    employeesRestored,
    vehiclesRestored,
    ordersRestored,
    locoTripsRestored,
  };
}

export function restoreBackup(
  payload: BackupPayload,
  options: {
    mode: "merge" | "replace";
    targetCompanyId: number;
    isGlobalAdmin: boolean;
  }
) {
  const db = getDb();

  if (!options.isGlobalAdmin) {
    if (
      payload.scope === "all" ||
      (Array.isArray(payload.globalUsers) && payload.globalUsers.length > 0) ||
      (Array.isArray(payload.allCompaniesData) &&
        payload.allCompaniesData.length > 0)
    ) {
      throw new Error(
        "FORBIDDEN: Samo globalni administrator može vratiti sigurnosnu kopiju cijelog sustava."
      );
    }
  }

  if (
    options.isGlobalAdmin &&
    payload.scope === "all" &&
    Array.isArray(payload.allCompaniesData) &&
    payload.allCompaniesData.length > 0
  ) {
    let totalEmp = 0;
    let totalVeh = 0;
    let totalOrd = 0;
    let totalLoco = 0;
    let companiesRestored = 0;

    for (const compData of payload.allCompaniesData) {
      const existingComp = db
        .prepare("SELECT id FROM companies WHERE oib = ? OR id = ?")
        .get(compData.company?.oib || "", compData.company?.id || 0) as
        | { id: number }
        | undefined;

      let compId: number;
      if (existingComp) {
        compId = existingComp.id;
      } else {
        const created = createCompany({
          name: compData.company?.name || "Nova tvrtka",
          oib: compData.company?.oib || "00000000000",
          address: compData.company?.address || "",
          city: compData.company?.city || "",
          iban: compData.company?.iban || "",
          director_name: compData.company?.director_name || "",
          order_prefix: compData.company?.order_prefix || "PN",
        });
        compId = created.id;
      }

      const res = restoreSingleCompanyData(compId, compData, options.mode);
      totalEmp += res.employeesRestored;
      totalVeh += res.vehiclesRestored;
      totalOrd += res.ordersRestored;
      totalLoco += res.locoTripsRestored;
      companiesRestored++;
    }

    return {
      employeesRestored: totalEmp,
      vehiclesRestored: totalVeh,
      ordersRestored: totalOrd,
      locoTripsRestored: totalLoco,
      companiesRestored,
    };
  }

  const singleData =
    payload.companyData ||
    (options.isGlobalAdmin && Array.isArray(payload.allCompaniesData)
      ? payload.allCompaniesData[0]
      : undefined);

  if (!singleData) {
    throw new Error("Neispravan format sigurnosne kopije (nedostaje companyData).");
  }

  const res = restoreSingleCompanyData(
    options.targetCompanyId,
    singleData,
    options.mode
  );
  return {
    ...res,
    companiesRestored: 1,
  };
}
