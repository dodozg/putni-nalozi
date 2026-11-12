import fs from "node:fs";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      run: (...params: unknown[]) => { lastInsertRowid: number | bigint; changes: number };
      get: (...params: unknown[]) => Record<string, unknown> | undefined;
      all: (...params: unknown[]) => Record<string, unknown>[];
    };
  };
};

import type {
  CompanySettings,
  Employee,
  LocoTrip,
  TravelExpense,
  TravelOrder,
  Vehicle,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "putni_nalozi.db");

type SqliteDb = InstanceType<typeof DatabaseSync>;

function toPlain<T>(row: unknown): T {
  if (!row || typeof row !== "object") return row as T;
  return { ...(row as Record<string, unknown>) } as T;
}

function toPlainList<T>(rows: unknown[]): T[] {
  return rows.map((r) => toPlain<T>(r));
}

const globalForDb = globalThis as unknown as {
  __putniNaloziDb?: SqliteDb;
};

function getDb(): SqliteDb {
  if (globalForDb.__putniNaloziDb) {
    return globalForDb.__putniNaloziDb;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  initSchema(db);
  seedIfEmpty(db);

  globalForDb.__putniNaloziDb = db;
  return db;
}

function initSchema(db: SqliteDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
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
      full_name TEXT NOT NULL,
      oib TEXT NOT NULL,
      job_title TEXT NOT NULL,
      address TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      order_number TEXT NOT NULL UNIQUE,
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
}

function seedIfEmpty(db: SqliteDb) {
  const existing = db.prepare("SELECT COUNT(*) as cnt FROM company_settings").get() as {
    cnt: number;
  };
  if (existing.cnt > 0) return;

  db.prepare(`
    INSERT INTO company_settings (
      id, name, oib, address, city, iban, director_name, order_prefix,
      per_diem_full, per_diem_half, mileage_rate, min_distance_km,
      meal_deduction_one_pct, meal_deduction_two_pct
    ) VALUES (
      1, 'Adriatik Tehnologije d.o.o.', '12345678901', 'Radnička cesta 80', '10000 Zagreb',
      'HR1223400091100123456', 'Ivan Horvat', 'PN',
      30.0, 15.0, 0.5, 30, 30, 60
    )
  `).run();

  const emp1 = db.prepare(`
    INSERT INTO employees (full_name, oib, job_title, address)
    VALUES ('Marko Kovačević', '23456789012', 'Voditelj projekata', 'Ilica 142, Zagreb')
  `).run();

  const emp2 = db.prepare(`
    INSERT INTO employees (full_name, oib, job_title, address)
    VALUES ('Ana Babić', '34567890123', 'Konzultantica za prodaju', 'Vukovarska 45, Zagreb')
  `).run();

  const emp3 = db.prepare(`
    INSERT INTO employees (full_name, oib, job_title, address)
    VALUES ('Luka Novak', '45678901234', 'Terenski inženjer', 'Savska cesta 90, Zagreb')
  `).run();

  const veh1 = db.prepare(`
    INSERT INTO vehicles (ownership_type, make_model, license_plate, employee_id, current_odometer)
    VALUES ('PRIVATNO', 'Škoda Octavia 2.0 TDI', 'ZG-4582-HR', ?, 84250)
  `).run(Number(emp1.lastInsertRowid));

  const veh2 = db.prepare(`
    INSERT INTO vehicles (ownership_type, make_model, license_plate, employee_id, current_odometer)
    VALUES ('SLUZBENO', 'Volkswagen Golf 8', 'ZG-9012-AB', NULL, 41600)
  `).run();

  const veh3 = db.prepare(`
    INSERT INTO vehicles (ownership_type, make_model, license_plate, employee_id, current_odometer)
    VALUES ('PRIVATNO', 'Renault Clio 1.5 dCi', 'ZG-1129-CD', ?, 62140)
  `).run(Number(emp2.lastInsertRowid));

  // Seed 2 realistic Croatian travel orders
  const ord1 = db.prepare(`
    INSERT INTO travel_orders (
      order_number, year, seq_number, status, issue_date, employee_id,
      purpose, origin, destination, distance_km,
      departure_at, return_at, transport_type, vehicle_id,
      odometer_start, odometer_end, total_km,
      one_meal_days, two_meals_days, advance_payment_eur,
      trip_report, per_diem_total_eur, mileage_total_eur,
      expenses_total_eur, total_amount_eur, balance_due_eur, approved_by
    ) VALUES (
      'PN-2026-001', 2026, 1, 'OBRACUNAT', '2026-11-03', ?,
      'Implementacija ERP sustava i edukacija korisnika u luci Rijeka',
      'Zagreb', 'Rijeka', 165,
      '2026-11-04T07:30', '2026-11-05T18:00', 'PRIVATNO_VOZILO', ?,
      83920, 84250, 330,
      1, 0, 50.0,
      'Održana edukacija za 12 djelatnika i pušten modul skladišnog poslovanja u produkciju.',
      36.0, 165.0, 29.6, 230.6, 180.6, 'Ivan Horvat'
    )
  `).run(Number(emp1.lastInsertRowid), Number(veh1.lastInsertRowid));

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
      order_number, year, seq_number, status, issue_date, employee_id,
      purpose, origin, destination, distance_km,
      departure_at, return_at, transport_type, vehicle_id,
      odometer_start, odometer_end, total_km,
      one_meal_days, two_meals_days, advance_payment_eur,
      trip_report, per_diem_total_eur, mileage_total_eur,
      expenses_total_eur, total_amount_eur, balance_due_eur, approved_by
    ) VALUES (
      'PN-2026-002', 2026, 2, 'ODOBREN', '2026-11-10', ?,
      'Sastanak s klijentom Dalmacija Projekt d.o.o. oko godišnjeg ugovora',
      'Zagreb', 'Split', 410,
      '2026-11-12T06:00', '2026-11-12T21:30', 'SLUZBENO_VOZILO', ?,
      41600, 0, 0,
      0, 0, 0,
      '',
      30.0, 0, 0, 30.0, 30.0, 'Ivan Horvat'
    )
  `).run(Number(emp3.lastInsertRowid), Number(veh2.lastInsertRowid));

  // Seed 2 realistic loco trips
  db.prepare(`
    INSERT INTO loco_trips (
      trip_date, employee_id, vehicle_id, origin, destination, purpose,
      odometer_start, odometer_end, distance_km, rate_eur, amount_eur, status
    ) VALUES (
      '2026-11-08', ?, ?, 'Radnička cesta 80', 'Novi Zagreb - Buzin',
      'Dostava ugovora i potpisivanje kod javnog bilježnika',
      62110, 62128, 18, 0.5, 9.0, 'EVIDENTIRANO'
    )
  `).run(Number(emp2.lastInsertRowid), Number(veh3.lastInsertRowid));

  db.prepare(`
    INSERT INTO loco_trips (
      trip_date, employee_id, vehicle_id, origin, destination, purpose,
      odometer_start, odometer_end, distance_km, rate_eur, amount_eur, status
    ) VALUES (
      '2026-11-11', ?, ?, 'Radnička cesta 80', 'Jankomir poslovna zona',
      'Preuzimanje računalne opreme kod dobavljača',
      62128, 62140, 12, 0.5, 6.0, 'EVIDENTIRANO'
    )
  `).run(Number(emp2.lastInsertRowid), Number(veh3.lastInsertRowid));
}

// --- Settings ---
export function getCompanySettings(): CompanySettings {
  const db = getDb();
  return db
    .prepare("SELECT * FROM company_settings WHERE id = 1")
    .get() as unknown as CompanySettings;
}

export function updateCompanySettings(
  data: Omit<CompanySettings, "id">
): CompanySettings {
  const db = getDb();
  db.prepare(`
    UPDATE company_settings SET
      name = ?, oib = ?, address = ?, city = ?, iban = ?,
      director_name = ?, order_prefix = ?,
      per_diem_full = ?, per_diem_half = ?, mileage_rate = ?,
      min_distance_km = ?, meal_deduction_one_pct = ?, meal_deduction_two_pct = ?
    WHERE id = 1
  `).run(
    data.name,
    data.oib,
    data.address,
    data.city,
    data.iban,
    data.director_name,
    data.order_prefix,
    data.per_diem_full,
    data.per_diem_half,
    data.mileage_rate,
    data.min_distance_km,
    data.meal_deduction_one_pct,
    data.meal_deduction_two_pct
  );
  return getCompanySettings();
}

// --- Employees ---
export function listEmployees(onlyActive = false): Employee[] {
  const db = getDb();
  const sql = onlyActive
    ? "SELECT * FROM employees WHERE active = 1 ORDER BY full_name ASC"
    : "SELECT * FROM employees ORDER BY active DESC, full_name ASC";
  return db.prepare(sql).all() as unknown as Employee[];
}

export function createEmployee(data: {
  full_name: string;
  oib: string;
  job_title: string;
  address: string;
}): Employee {
  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO employees (full_name, oib, job_title, address) VALUES (?, ?, ?, ?)"
    )
    .run(data.full_name, data.oib, data.job_title, data.address);
  return db
    .prepare("SELECT * FROM employees WHERE id = ?")
    .get(Number(res.lastInsertRowid)) as unknown as Employee;
}

export function updateEmployee(
  id: number,
  data: {
    full_name: string;
    oib: string;
    job_title: string;
    address: string;
    active: number;
  }
): Employee | null {
  const db = getDb();
  db.prepare(
    "UPDATE employees SET full_name = ?, oib = ?, job_title = ?, address = ?, active = ? WHERE id = ?"
  ).run(data.full_name, data.oib, data.job_title, data.address, data.active, id);
  return (
    (db
      .prepare("SELECT * FROM employees WHERE id = ?")
      .get(id) as unknown as Employee) || null
  );
}

// --- Vehicles ---
export function listVehicles(onlyActive = false): Vehicle[] {
  const db = getDb();
  const where = onlyActive ? "WHERE v.active = 1" : "";
  return db
    .prepare(
      `SELECT v.*, e.full_name as employee_name
       FROM vehicles v
       LEFT JOIN employees e ON v.employee_id = e.id
       ${where}
       ORDER BY v.active DESC, v.ownership_type ASC, v.make_model ASC`
    )
    .all() as unknown as Vehicle[];
}

export function createVehicle(data: {
  ownership_type: string;
  make_model: string;
  license_plate: string;
  employee_id: number | null;
  current_odometer: number;
}): Vehicle {
  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO vehicles (ownership_type, make_model, license_plate, employee_id, current_odometer) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      data.ownership_type,
      data.make_model,
      data.license_plate.toUpperCase(),
      data.employee_id || null,
      data.current_odometer || 0
    );
  return db
    .prepare(
      `SELECT v.*, e.full_name as employee_name
       FROM vehicles v LEFT JOIN employees e ON v.employee_id = e.id
       WHERE v.id = ?`
    )
    .get(Number(res.lastInsertRowid)) as unknown as Vehicle;
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
  }
): Vehicle | null {
  const db = getDb();
  db.prepare(
    "UPDATE vehicles SET ownership_type = ?, make_model = ?, license_plate = ?, employee_id = ?, current_odometer = ?, active = ? WHERE id = ?"
  ).run(
    data.ownership_type,
    data.make_model,
    data.license_plate.toUpperCase(),
    data.employee_id || null,
    data.current_odometer || 0,
    data.active,
    id
  );
  return (
    (db
      .prepare(
        `SELECT v.*, e.full_name as employee_name
         FROM vehicles v LEFT JOIN employees e ON v.employee_id = e.id
         WHERE v.id = ?`
      )
      .get(id) as unknown as Vehicle) || null
  );
}

// --- Travel Orders ---
export function getNextOrderNumber(year: number, prefix: string): {
  order_number: string;
  seq_number: number;
} {
  const db = getDb();
  const row = db
    .prepare("SELECT COALESCE(MAX(seq_number), 0) as max_seq FROM travel_orders WHERE year = ?")
    .get(year) as { max_seq: number };
  const seq = (row?.max_seq || 0) + 1;
  const padded = String(seq).padStart(3, "0");
  return {
    seq_number: seq,
    order_number: `${prefix}-${year}-${padded}`,
  };
}

export function listTravelOrders(): TravelOrder[] {
  const db = getDb();
  return db
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
       ORDER BY t.year DESC, t.seq_number DESC`
    )
    .all() as unknown as TravelOrder[];
}

export function getTravelOrderById(id: number): TravelOrder | null {
  const db = getDb();
  const order = db
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
    .get(id) as unknown as TravelOrder | undefined;

  if (!order) return null;

  const expenses = db
    .prepare(
      "SELECT * FROM travel_expenses WHERE travel_order_id = ? ORDER BY id ASC"
    )
    .all(id) as unknown as TravelExpense[];

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
  >
): TravelOrder {
  const db = getDb();
  const settings = getCompanySettings();
  const year = payload.issue_date
    ? Number(payload.issue_date.slice(0, 4)) || new Date().getFullYear()
    : new Date().getFullYear();

  const { order_number, seq_number } = getNextOrderNumber(
    year,
    settings.order_prefix || "PN"
  );

  const res = db
    .prepare(
      `INSERT INTO travel_orders (
        order_number, year, seq_number, status, issue_date, employee_id,
        purpose, origin, destination, distance_km,
        departure_at, return_at, transport_type, vehicle_id,
        odometer_start, odometer_end, total_km,
        one_meal_days, two_meals_days, advance_payment_eur,
        trip_report, per_diem_total_eur, mileage_total_eur,
        expenses_total_eur, total_amount_eur, balance_due_eur, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      order_number,
      year,
      seq_number,
      payload.status || "NACRT",
      payload.issue_date,
      payload.employee_id,
      payload.purpose,
      payload.origin,
      payload.destination,
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

  // Update vehicle's latest odometer if odometer_end is higher
  if (payload.vehicle_id && payload.odometer_end > 0) {
    db.prepare(
      "UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?"
    ).run(payload.odometer_end, payload.vehicle_id);
  }

  return getTravelOrderById(orderId)!;
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
  >
): TravelOrder | null {
  const db = getDb();
  const existing = getTravelOrderById(id);
  if (!existing) return null;

  db.prepare(
    `UPDATE travel_orders SET
      status = ?, issue_date = ?, employee_id = ?,
      purpose = ?, origin = ?, destination = ?, distance_km = ?,
      departure_at = ?, return_at = ?, transport_type = ?, vehicle_id = ?,
      odometer_start = ?, odometer_end = ?, total_km = ?,
      one_meal_days = ?, two_meals_days = ?, advance_payment_eur = ?,
      trip_report = ?, per_diem_total_eur = ?, mileage_total_eur = ?,
      expenses_total_eur = ?, total_amount_eur = ?, balance_due_eur = ?,
      approved_by = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    payload.status,
    payload.issue_date,
    payload.employee_id,
    payload.purpose,
    payload.origin,
    payload.destination,
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
    id
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
      "UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?"
    ).run(payload.odometer_end, payload.vehicle_id);
  }

  return getTravelOrderById(id);
}

export function deleteTravelOrder(id: number): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM travel_orders WHERE id = ?").run(id);
  return res.changes > 0;
}

// --- Loco Trips ---
export function listLocoTrips(): LocoTrip[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT l.*,
              e.full_name as employee_name,
              e.oib as employee_oib,
              v.make_model as vehicle_make_model,
              v.license_plate as vehicle_license_plate
       FROM loco_trips l
       JOIN employees e ON l.employee_id = e.id
       LEFT JOIN vehicles v ON l.vehicle_id = v.id
       ORDER BY l.trip_date DESC, l.id DESC`
    )
    .all() as unknown as LocoTrip[];
}

export function createLocoTrip(data: {
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
}): LocoTrip {
  const db = getDb();
  const res = db
    .prepare(
      `INSERT INTO loco_trips (
        trip_date, employee_id, vehicle_id, origin, destination, purpose,
        odometer_start, odometer_end, distance_km, rate_eur, amount_eur, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
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
      "UPDATE vehicles SET current_odometer = MAX(current_odometer, ?) WHERE id = ?"
    ).run(data.odometer_end, data.vehicle_id);
  }

  return db
    .prepare(
      `SELECT l.*, e.full_name as employee_name, e.oib as employee_oib,
              v.make_model as vehicle_make_model, v.license_plate as vehicle_license_plate
       FROM loco_trips l
       JOIN employees e ON l.employee_id = e.id
       LEFT JOIN vehicles v ON l.vehicle_id = v.id
       WHERE l.id = ?`
    )
    .get(Number(res.lastInsertRowid)) as unknown as LocoTrip;
}

export function updateLocoTripStatus(id: number, status: string): boolean {
  const db = getDb();
  const res = db
    .prepare("UPDATE loco_trips SET status = ? WHERE id = ?")
    .run(status, id);
  return res.changes > 0;
}

export function deleteLocoTrip(id: number): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM loco_trips WHERE id = ?").run(id);
  return res.changes > 0;
}
