import { calculateTravelOrder, round2 } from "./croatian-rules";
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
import { ALL_PERMISSIONS, DEFAULT_USER_PERMISSIONS } from "./types";

export const INITIAL_DEMO_COMPANIES: Company[] = [
  {
    id: 1,
    name: "Adriatik Tehnologije d.o.o.",
    oib: "12345678901",
    address: "Radnička cesta 80",
    city: "10000 Zagreb",
    iban: "HR1223400091100123456",
    director_name: "Ivan Horvat",
    order_prefix: "PN",
    per_diem_full: 30.0,
    per_diem_half: 15.0,
    mileage_rate: 0.5,
    min_distance_km: 30,
    meal_deduction_one_pct: 30,
    meal_deduction_two_pct: 60,
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
    employee_count: 3,
    user_count: 2,
    order_count: 2,
  },
  {
    id: 2,
    name: "Slavonija Logistika d.o.o.",
    oib: "98765432109",
    address: "Europska avenija 24",
    city: "31000 Osijek",
    iban: "HR9823600001102938475",
    director_name: "Marija Jurić",
    order_prefix: "SL",
    per_diem_full: 30.0,
    per_diem_half: 15.0,
    mileage_rate: 0.5,
    min_distance_km: 30,
    meal_deduction_one_pct: 30,
    meal_deduction_two_pct: 60,
    active: 1,
    created_at: "2026-01-15T08:00:00Z",
    employee_count: 2,
    user_count: 1,
    order_count: 1,
  },
];

export const INITIAL_DEMO_USERS: Array<User & { password?: string }> = [
  {
    id: 1,
    email: "admin@sustav.hr",
    full_name: "Globalni Administrator",
    role: "global_admin",
    company_id: null,
    company_name: null,
    permissions: { ...ALL_PERMISSIONS },
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
    password: "admin123",
  },
  {
    id: 2,
    email: "direktor@firma1.hr",
    full_name: "Ivan Horvat (Direktor)",
    role: "company_admin",
    company_id: 1,
    company_name: "Adriatik Tehnologije d.o.o.",
    permissions: { ...ALL_PERMISSIONS },
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
    password: "firma123",
  },
  {
    id: 3,
    email: "korisnik@firma1.hr",
    full_name: "Marko Kovačević (Djelatnik)",
    role: "user",
    company_id: 1,
    company_name: "Adriatik Tehnologije d.o.o.",
    permissions: { ...DEFAULT_USER_PERMISSIONS },
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
    password: "korisnik123",
  },
  {
    id: 4,
    email: "direktor@firma2.hr",
    full_name: "Marija Jurić (Direktorica)",
    role: "company_admin",
    company_id: 2,
    company_name: "Slavonija Logistika d.o.o.",
    permissions: { ...ALL_PERMISSIONS },
    active: 1,
    created_at: "2026-01-15T08:00:00Z",
    password: "firma234",
  },
];

export const INITIAL_DEMO_SETTINGS: CompanySettings = {
  id: 1,
  company_id: 1,
  name: "Adriatik Tehnologije d.o.o.",
  oib: "12345678901",
  address: "Radnička cesta 80",
  city: "10000 Zagreb",
  iban: "HR1223400091100123456",
  director_name: "Ivan Horvat",
  order_prefix: "PN",
  per_diem_full: 30.0,
  per_diem_half: 15.0,
  mileage_rate: 0.5,
  min_distance_km: 30,
  meal_deduction_one_pct: 30,
  meal_deduction_two_pct: 60,
};

export const INITIAL_DEMO_EMPLOYEES: Employee[] = [
  {
    id: 1,
    company_id: 1,
    full_name: "Marko Kovačević",
    oib: "23456789012",
    job_title: "Voditelj projekata",
    address: "Ilica 142, Zagreb",
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
  {
    id: 2,
    company_id: 1,
    full_name: "Ana Babić",
    oib: "34567890123",
    job_title: "Konzultantica za prodaju",
    address: "Vukovarska 45, Zagreb",
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
  {
    id: 3,
    company_id: 1,
    full_name: "Luka Novak",
    oib: "45678901234",
    job_title: "Terenski inženjer",
    address: "Savska cesta 90, Zagreb",
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
  {
    id: 4,
    company_id: 2,
    full_name: "Josip Knežević",
    oib: "56789012345",
    job_title: "Voditelj distribucije",
    address: "Strossmayerova 112, Osijek",
    active: 1,
    created_at: "2026-01-15T08:00:00Z",
  },
  {
    id: 5,
    company_id: 2,
    full_name: "Ivana Radić",
    oib: "67890123456",
    job_title: "Referentica nabave",
    address: "Vukovarska 18, Osijek",
    active: 1,
    created_at: "2026-01-15T08:00:00Z",
  },
];

export const INITIAL_DEMO_VEHICLES: Vehicle[] = [
  {
    id: 1,
    company_id: 1,
    ownership_type: "PRIVATNO",
    make_model: "Škoda Octavia 2.0 TDI",
    license_plate: "ZG-4582-HR",
    employee_id: 1,
    employee_name: "Marko Kovačević",
    current_odometer: 84250,
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
  {
    id: 2,
    company_id: 1,
    ownership_type: "SLUZBENO",
    make_model: "Volkswagen Golf 8",
    license_plate: "ZG-9012-AB",
    employee_id: null,
    employee_name: null,
    current_odometer: 41600,
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
  {
    id: 3,
    company_id: 1,
    ownership_type: "PRIVATNO",
    make_model: "Renault Clio 1.5 dCi",
    license_plate: "ZG-1129-CD",
    employee_id: 2,
    employee_name: "Ana Babić",
    current_odometer: 62140,
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
  {
    id: 4,
    company_id: 2,
    ownership_type: "SLUZBENO",
    make_model: "Škoda Superb 2.0 TDI",
    license_plate: "OS-7741-SL",
    employee_id: 4,
    employee_name: "Josip Knežević",
    current_odometer: 51200,
    active: 1,
    created_at: "2026-01-15T08:00:00Z",
  },
];

export const INITIAL_DEMO_ORDERS: TravelOrder[] = [
  {
    id: 1,
    company_id: 1,
    order_number: "PN-2026-001",
    year: 2026,
    seq_number: 1,
    status: "OBRACUNAT",
    issue_date: "2026-11-03",
    employee_id: 1,
    employee_name: "Marko Kovačević",
    employee_oib: "23456789012",
    employee_job_title: "Voditelj projekata",
    employee_address: "Ilica 142, Zagreb",
    purpose: "Implementacija ERP sustava i edukacija korisnika u luci Rijeka",
    origin: "Zagreb",
    destination: "Rijeka",
    distance_km: 165,
    departure_at: "2026-11-04T07:30",
    return_at: "2026-11-05T18:00",
    transport_type: "PRIVATNO_VOZILO",
    vehicle_id: 1,
    vehicle_make_model: "Škoda Octavia 2.0 TDI",
    vehicle_license_plate: "ZG-4582-HR",
    odometer_start: 83920,
    odometer_end: 84250,
    total_km: 330,
    one_meal_days: 1,
    two_meals_days: 0,
    advance_payment_eur: 50.0,
    trip_report:
      "Održana edukacija za 12 djelatnika i pušten modul skladišnog poslovanja u produkciju.",
    per_diem_total_eur: 36.0,
    mileage_total_eur: 165.0,
    expenses_total_eur: 29.6,
    total_amount_eur: 230.6,
    balance_due_eur: 180.6,
    approved_by: "Ivan Horvat",
    created_at: "2026-11-03T09:00:00Z",
    updated_at: "2026-11-05T19:00:00Z",
    expenses: [
      {
        id: 1,
        travel_order_id: 1,
        category: "CESTARINA",
        description: "Autocesta A1/A6 Zagreb - Rijeka (povratno)",
        receipt_number: "HAC-88219",
        expense_date: "2026-11-04",
        amount_eur: 18.6,
      },
      {
        id: 2,
        travel_order_id: 1,
        category: "PARKING",
        description: "Parking Delta Rijeka (2 dana)",
        receipt_number: "RI-PAR-441",
        expense_date: "2026-11-05",
        amount_eur: 11.0,
      },
    ],
  },
  {
    id: 2,
    company_id: 1,
    order_number: "PN-2026-002",
    year: 2026,
    seq_number: 2,
    status: "ODOBREN",
    issue_date: "2026-11-10",
    employee_id: 3,
    employee_name: "Luka Novak",
    employee_oib: "45678901234",
    employee_job_title: "Terenski inženjer",
    employee_address: "Savska cesta 90, Zagreb",
    purpose: "Sastanak s klijentom Dalmacija Projekt d.o.o. oko godišnjeg ugovora",
    origin: "Zagreb",
    destination: "Split",
    distance_km: 410,
    departure_at: "2026-11-12T06:00",
    return_at: "2026-11-12T21:30",
    transport_type: "SLUZBENO_VOZILO",
    vehicle_id: 2,
    vehicle_make_model: "Volkswagen Golf 8",
    vehicle_license_plate: "ZG-9012-AB",
    odometer_start: 41600,
    odometer_end: 0,
    total_km: 0,
    one_meal_days: 0,
    two_meals_days: 0,
    advance_payment_eur: 0,
    trip_report: "",
    per_diem_total_eur: 30.0,
    mileage_total_eur: 0,
    expenses_total_eur: 0,
    total_amount_eur: 30.0,
    balance_due_eur: 30.0,
    approved_by: "Ivan Horvat",
    created_at: "2026-11-10T10:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
    expenses: [],
  },
  {
    id: 3,
    company_id: 2,
    order_number: "SL-2026-001",
    year: 2026,
    seq_number: 1,
    status: "OBRACUNAT",
    issue_date: "2026-11-06",
    employee_id: 4,
    employee_name: "Josip Knežević",
    employee_oib: "56789012345",
    employee_job_title: "Voditelj distribucije",
    employee_address: "Strossmayerova 112, Osijek",
    purpose: "Pregovori s logističkim partnerom u Zagrebu",
    origin: "Osijek",
    destination: "Zagreb",
    distance_km: 280,
    departure_at: "2026-11-07T06:30",
    return_at: "2026-11-07T20:00",
    transport_type: "SLUZBENO_VOZILO",
    vehicle_id: 4,
    vehicle_make_model: "Škoda Superb 2.0 TDI",
    vehicle_license_plate: "OS-7741-SL",
    odometer_start: 50640,
    odometer_end: 51200,
    total_km: 560,
    one_meal_days: 0,
    two_meals_days: 0,
    advance_payment_eur: 0,
    trip_report: "Uspješno dogovoreni uvjeti skladištenja i distribucije za Q1.",
    per_diem_total_eur: 30.0,
    mileage_total_eur: 0,
    expenses_total_eur: 0,
    total_amount_eur: 30.0,
    balance_due_eur: 30.0,
    approved_by: "Marija Jurić",
    created_at: "2026-11-06T09:00:00Z",
    updated_at: "2026-11-07T21:00:00Z",
    expenses: [],
  },
];

export const INITIAL_DEMO_LOCO_TRIPS: LocoTrip[] = [
  {
    id: 1,
    company_id: 1,
    trip_date: "2026-11-08",
    employee_id: 2,
    employee_name: "Ana Babić",
    employee_oib: "34567890123",
    vehicle_id: 3,
    vehicle_make_model: "Renault Clio 1.5 dCi",
    vehicle_license_plate: "ZG-1129-CD",
    origin: "Radnička cesta 80",
    destination: "Novi Zagreb - Buzin",
    purpose: "Dostava ugovora i potpisivanje kod javnog bilježnika",
    odometer_start: 62110,
    odometer_end: 62128,
    distance_km: 18,
    rate_eur: 0.5,
    amount_eur: 9.0,
    status: "EVIDENTIRANO",
    created_at: "2026-11-08T14:00:00Z",
  },
  {
    id: 2,
    company_id: 1,
    trip_date: "2026-11-11",
    employee_id: 2,
    employee_name: "Ana Babić",
    employee_oib: "34567890123",
    vehicle_id: 3,
    vehicle_make_model: "Renault Clio 1.5 dCi",
    vehicle_license_plate: "ZG-1129-CD",
    origin: "Radnička cesta 80",
    destination: "Jankomir poslovna zona",
    purpose: "Preuzimanje računalne opreme kod dobavljača",
    odometer_start: 62128,
    odometer_end: 62140,
    distance_km: 12,
    rate_eur: 0.5,
    amount_eur: 6.0,
    status: "EVIDENTIRANO",
    created_at: "2026-11-11T15:00:00Z",
  },
  {
    id: 3,
    company_id: 2,
    trip_date: "2026-11-09",
    employee_id: 5,
    employee_name: "Ivana Radić",
    employee_oib: "67890123456",
    vehicle_id: 4,
    vehicle_make_model: "Škoda Superb 2.0 TDI",
    vehicle_license_plate: "OS-7741-SL",
    origin: "Europska avenija 24",
    destination: "Industrijska zona Nemetin",
    purpose: "Kontrola carinskog skladišta",
    odometer_start: 51200,
    odometer_end: 51216,
    distance_km: 16,
    rate_eur: 0.5,
    amount_eur: 8.0,
    status: "EVIDENTIRANO",
    created_at: "2026-11-09T11:00:00Z",
  },
];

// Client-side localStorage store for static/Cloudflare Workers demo mode
const STORAGE_KEY = "putni_nalozi_hr_demo_v2";

interface DemoStore {
  companies: Company[];
  users: Array<User & { password?: string }>;
  currentUserId: number | null;
  activeCompanyId: number;
  settings: CompanySettings;
  employees: Employee[];
  vehicles: Vehicle[];
  orders: TravelOrder[];
  locoTrips: LocoTrip[];
}

function getInitialStore(): DemoStore {
  return {
    companies: INITIAL_DEMO_COMPANIES,
    users: INITIAL_DEMO_USERS,
    currentUserId: null,
    activeCompanyId: 1,
    settings: INITIAL_DEMO_SETTINGS,
    employees: INITIAL_DEMO_EMPLOYEES,
    vehicles: INITIAL_DEMO_VEHICLES,
    orders: INITIAL_DEMO_ORDERS,
    locoTrips: INITIAL_DEMO_LOCO_TRIPS,
  };
}

function loadStore(): DemoStore {
  if (typeof window === "undefined") {
    return getInitialStore();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DemoStore>;
      if (parsed.companies && parsed.users) {
        return {
          ...getInitialStore(),
          ...parsed,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  const initial = getInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(store: DemoStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeDemoPerms(
  role: UserRole,
  perms?: Partial<UserPermissions>
): UserPermissions {
  if (role === "global_admin" || role === "company_admin") {
    return { ...ALL_PERMISSIONS };
  }
  return {
    ...DEFAULT_USER_PERMISSIONS,
    ...(perms || {}),
  };
}

function buildDemoSession(store: DemoStore): AuthSession | null {
  if (!store.currentUserId) return null;
  const user = store.users.find(
    (u) => u.id === store.currentUserId && u.active !== 0
  );
  if (!user) return null;

  const activeCompanyId =
    user.role === "global_admin"
      ? store.activeCompanyId || 1
      : user.company_id || 1;
  const activeCompany =
    store.companies.find((c) => c.id === activeCompanyId) ||
    store.companies[0];

  const cleanUser: User = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    company_id: user.company_id,
    company_name:
      store.companies.find((c) => c.id === user.company_id)?.name || null,
    permissions: normalizeDemoPerms(user.role, user.permissions),
    active: user.active,
    created_at: user.created_at,
  };

  return {
    user: cleanUser,
    activeCompanyId: activeCompany.id,
    activeCompany,
    companies:
      user.role === "global_admin" ? store.companies : [activeCompany],
  };
}

function getDemoCompanySettings(
  store: DemoStore,
  companyId: number
): CompanySettings {
  const c =
    store.companies.find((comp) => comp.id === companyId) ||
    store.companies[0];
  return {
    id: c.id,
    company_id: c.id,
    name: c.name,
    oib: c.oib,
    address: c.address,
    city: c.city,
    iban: c.iban,
    director_name: c.director_name,
    order_prefix: c.order_prefix,
    per_diem_full: c.per_diem_full,
    per_diem_half: c.per_diem_half,
    mileage_rate: c.mileage_rate,
    min_distance_km: c.min_distance_km,
    meal_deduction_one_pct: c.meal_deduction_one_pct,
    meal_deduction_two_pct: c.meal_deduction_two_pct,
  };
}

// Universal fetch wrapper: uses real Next.js API when available, falls back to localStorage store on static/Workers deployment
export async function apiFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  try {
    const res = await fetch(input, {
      credentials: "include",
      ...init,
    });
    const contentType = res.headers.get("content-type") || "";
    if (
      res.status !== 404 &&
      res.status !== 405 &&
      contentType.includes("application/json")
    ) {
      return res;
    }
  } catch {
    // Fallback to client demo store
  }

  return handleDemoRequest(input, init);
}

function handleDemoRequest(rawUrl: string, init?: RequestInit): Response {
  const [url, queryString] = rawUrl.split("?");
  const params = new URLSearchParams(queryString || "");
  const method = (init?.method || "GET").toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const store = loadStore();

  // --- Auth endpoints ---
  if (url === "/api/auth/login" && method === "POST") {
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const user = store.users.find(
      (u) =>
        u.email.toLowerCase() === email &&
        (u.password === password || !u.password) &&
        u.active !== 0
    );
    if (!user) {
      return jsonResponse(
        { error: "Neispravna e-mail adresa ili lozinka." },
        401
      );
    }
    store.currentUserId = user.id;
    store.activeCompanyId =
      user.role === "global_admin"
        ? store.activeCompanyId || 1
        : user.company_id || 1;
    saveStore(store);
    return jsonResponse(buildDemoSession(store));
  }

  if (url === "/api/auth/logout" && method === "POST") {
    store.currentUserId = null;
    saveStore(store);
    return jsonResponse({ ok: true });
  }

  if (url === "/api/auth/me") {
    const session = buildDemoSession(store);
    if (!session) {
      return jsonResponse({ error: "Niste prijavljeni." }, 401);
    }
    if (method === "GET") {
      return jsonResponse(session);
    }
    if (method === "POST" || method === "PATCH") {
      const nextCompId = Number(body.activeCompanyId ?? body.companyId ?? 0);
      if (nextCompId > 0 && session.user.role === "global_admin") {
        store.activeCompanyId = nextCompId;
      }
      if (body.full_name || body.password) {
        store.users = store.users.map((u) =>
          u.id === session.user.id
            ? {
                ...u,
                full_name: body.full_name || u.full_name,
                password: body.password || u.password,
              }
            : u
        );
      }
      saveStore(store);
      return jsonResponse(buildDemoSession(store));
    }
  }

  const session = buildDemoSession(store);
  const companyId = session?.activeCompanyId || store.activeCompanyId || 1;
  const activeSettings = getDemoCompanySettings(store, companyId);

  // --- Companies ---
  if (url === "/api/companies") {
    if (method === "GET") {
      const enriched = store.companies.map((c) => ({
        ...c,
        employee_count: store.employees.filter(
          (e) => (e.company_id || 1) === c.id
        ).length,
        user_count: store.users.filter((u) => u.company_id === c.id).length,
        order_count: store.orders.filter((o) => (o.company_id || 1) === c.id)
          .length,
      }));
      return jsonResponse(enriched);
    }
    if (method === "POST") {
      const nextId =
        store.companies.reduce((m, c) => Math.max(m, c.id), 0) + 1;
      const created: Company = {
        id: nextId,
        name: body.name,
        oib: body.oib,
        address: body.address || "",
        city: body.city || "",
        iban: body.iban || "",
        director_name: body.director_name || "",
        order_prefix: String(body.order_prefix || "PN").toUpperCase(),
        per_diem_full: Number(body.per_diem_full ?? 30),
        per_diem_half: Number(body.per_diem_half ?? 15),
        mileage_rate: Number(body.mileage_rate ?? 0.5),
        min_distance_km: Number(body.min_distance_km ?? 30),
        meal_deduction_one_pct: Number(body.meal_deduction_one_pct ?? 30),
        meal_deduction_two_pct: Number(body.meal_deduction_two_pct ?? 60),
        active: 1,
        created_at: new Date().toISOString(),
      };
      store.companies.push(created);
      saveStore(store);
      return jsonResponse(created, 201);
    }
  }

  const compMatch = url.match(/^\/api\/companies\/(\d+)$/);
  if (compMatch) {
    const id = Number(compMatch[1]);
    if (method === "PATCH" || method === "PUT") {
      store.companies = store.companies.map((c) =>
        c.id === id ? { ...c, ...body, id } : c
      );
      saveStore(store);
      return jsonResponse(store.companies.find((c) => c.id === id));
    }
    if (method === "DELETE") {
      store.companies = store.companies.filter((c) => c.id !== id);
      saveStore(store);
      return jsonResponse({ ok: true });
    }
  }

  // --- Users ---
  if (url === "/api/users") {
    if (method === "GET") {
      const filterCompanyId =
        session?.user.role === "global_admin"
          ? params.get("companyId")
            ? Number(params.get("companyId"))
            : null
          : companyId;
      const list = store.users
        .filter((u) =>
          filterCompanyId ? u.company_id === filterCompanyId : true
        )
        .map((u) => ({
          ...u,
          company_name:
            store.companies.find((c) => c.id === u.company_id)?.name || null,
          permissions: normalizeDemoPerms(u.role, u.permissions),
        }));
      return jsonResponse(list);
    }
    if (method === "POST") {
      const nextId = store.users.reduce((m, u) => Math.max(m, u.id), 0) + 1;
      const role: UserRole = body.role || "user";
      const targetCompId =
        role === "global_admin"
          ? null
          : session?.user.role === "company_admin"
          ? companyId
          : Number(body.company_id || companyId);
      const created: User & { password?: string } = {
        id: nextId,
        email: String(body.email).toLowerCase(),
        full_name: body.full_name,
        role,
        company_id: targetCompId,
        company_name:
          store.companies.find((c) => c.id === targetCompId)?.name || null,
        permissions: normalizeDemoPerms(role, body.permissions),
        active: body.active === 0 ? 0 : 1,
        created_at: new Date().toISOString(),
        password: body.password || "lozinka123",
      };
      store.users.push(created);
      saveStore(store);
      return jsonResponse(created, 201);
    }
  }

  const userMatch = url.match(/^\/api\/users\/(\d+)$/);
  if (userMatch) {
    const id = Number(userMatch[1]);
    if (method === "PATCH" || method === "PUT") {
      store.users = store.users.map((u) => {
        if (u.id !== id) return u;
        const nextRole: UserRole = body.role || u.role;
        return {
          ...u,
          ...body,
          id,
          role: nextRole,
          permissions: normalizeDemoPerms(
            nextRole,
            body.permissions ?? u.permissions
          ),
        };
      });
      saveStore(store);
      return jsonResponse(store.users.find((u) => u.id === id));
    }
    if (method === "DELETE") {
      store.users = store.users.filter((u) => u.id !== id);
      saveStore(store);
      return jsonResponse({ ok: true });
    }
  }

  // --- Backup & Restore ---
  if (url === "/api/backup" && method === "GET") {
    const scope = params.get("scope") === "all" ? "all" : "company";
    const buildCompanyData = (cid: number): CompanyBackupData => {
      const comp =
        store.companies.find((c) => c.id === cid) || store.companies[0];
      return {
        company: comp,
        settings: getDemoCompanySettings(store, cid),
        employees: store.employees.filter((e) => (e.company_id || 1) === cid),
        vehicles: store.vehicles.filter((v) => (v.company_id || 1) === cid),
        travelOrders: store.orders.filter((o) => (o.company_id || 1) === cid),
        locoTrips: store.locoTrips.filter((l) => (l.company_id || 1) === cid),
      };
    };
    const payload: BackupPayload = {
      version: "2.0.0",
      exportedAt: new Date().toISOString(),
      exportedBy: session?.user.email || "demo@sustav.hr",
      scope,
      companyData: buildCompanyData(companyId),
      allCompaniesData:
        scope === "all"
          ? store.companies.map((c) => buildCompanyData(c.id))
          : undefined,
    };
    return jsonResponse(payload);
  }

  if (url === "/api/restore" && method === "POST") {
    const backup: BackupPayload = body.backup || body;
    const mode: "merge" | "replace" =
      body.mode === "replace" ? "replace" : "merge";
    const data = backup.companyData || backup.allCompaniesData?.[0];
    if (!data) {
      return jsonResponse({ error: "Neispravan backup format." }, 400);
    }
    if (mode === "replace") {
      store.employees = store.employees.filter(
        (e) => (e.company_id || 1) !== companyId
      );
      store.vehicles = store.vehicles.filter(
        (v) => (v.company_id || 1) !== companyId
      );
      store.orders = store.orders.filter(
        (o) => (o.company_id || 1) !== companyId
      );
      store.locoTrips = store.locoTrips.filter(
        (l) => (l.company_id || 1) !== companyId
      );
    }
    for (const emp of data.employees || []) {
      store.employees.push({ ...emp, company_id: companyId });
    }
    for (const veh of data.vehicles || []) {
      store.vehicles.push({ ...veh, company_id: companyId });
    }
    for (const ord of data.travelOrders || []) {
      store.orders.push({ ...ord, company_id: companyId });
    }
    for (const loco of data.locoTrips || []) {
      store.locoTrips.push({ ...loco, company_id: companyId });
    }
    saveStore(store);
    return jsonResponse({
      ok: true,
      mode,
      targetCompanyId: companyId,
      summary: {
        employeesRestored: (data.employees || []).length,
        vehiclesRestored: (data.vehicles || []).length,
        ordersRestored: (data.travelOrders || []).length,
        locoTripsRestored: (data.locoTrips || []).length,
        companiesRestored: 1,
      },
    });
  }

  // --- Settings ---
  if (url === "/api/settings") {
    if (method === "GET") return jsonResponse(activeSettings);
    if (method === "PUT") {
      store.companies = store.companies.map((c) =>
        c.id === companyId ? { ...c, ...body, id: companyId } : c
      );
      saveStore(store);
      return jsonResponse(getDemoCompanySettings(store, companyId));
    }
  }

  // --- Employees ---
  if (url === "/api/employees") {
    if (method === "GET") {
      return jsonResponse(
        store.employees.filter((e) => (e.company_id || 1) === companyId)
      );
    }
    if (method === "POST") {
      const nextId =
        store.employees.reduce((m, e) => Math.max(m, e.id), 0) + 1;
      const emp: Employee = {
        id: nextId,
        company_id: companyId,
        full_name: body.full_name,
        oib: body.oib,
        job_title: body.job_title,
        address: body.address || "",
        active: 1,
        created_at: new Date().toISOString(),
      };
      store.employees.push(emp);
      saveStore(store);
      return jsonResponse(emp, 201);
    }
  }

  const empMatch = url.match(/^\/api\/employees\/(\d+)$/);
  if (empMatch && method === "PUT") {
    const id = Number(empMatch[1]);
    store.employees = store.employees.map((e) =>
      e.id === id ? { ...e, ...body, id } : e
    );
    saveStore(store);
    return jsonResponse(store.employees.find((e) => e.id === id));
  }

  // --- Vehicles ---
  if (url === "/api/vehicles") {
    if (method === "GET") {
      return jsonResponse(
        store.vehicles.filter((v) => (v.company_id || 1) === companyId)
      );
    }
    if (method === "POST") {
      const nextId =
        store.vehicles.reduce((m, v) => Math.max(m, v.id), 0) + 1;
      const emp = store.employees.find(
        (e) => e.id === Number(body.employee_id)
      );
      const veh: Vehicle = {
        id: nextId,
        company_id: companyId,
        ownership_type: body.ownership_type,
        make_model: body.make_model,
        license_plate: String(body.license_plate || "").toUpperCase(),
        employee_id: body.employee_id ? Number(body.employee_id) : null,
        employee_name: emp?.full_name || null,
        current_odometer: Number(body.current_odometer || 0),
        active: 1,
        created_at: new Date().toISOString(),
      };
      store.vehicles.push(veh);
      saveStore(store);
      return jsonResponse(veh, 201);
    }
  }

  const vehMatch = url.match(/^\/api\/vehicles\/(\d+)$/);
  if (vehMatch && method === "PUT") {
    const id = Number(vehMatch[1]);
    store.vehicles = store.vehicles.map((v) =>
      v.id === id ? { ...v, ...body, id } : v
    );
    saveStore(store);
    return jsonResponse(store.vehicles.find((v) => v.id === id));
  }

  // --- Travel Orders ---
  if (url === "/api/travel-orders") {
    if (method === "GET") {
      return jsonResponse(
        store.orders.filter((o) => (o.company_id || 1) === companyId)
      );
    }
    if (method === "POST") {
      const nextId = store.orders.reduce((m, o) => Math.max(m, o.id), 0) + 1;
      const year = Number((body.issue_date || "").slice(0, 4)) || 2026;
      const seq =
        store.orders
          .filter(
            (o) => (o.company_id || 1) === companyId && o.year === year
          )
          .reduce((m, o) => Math.max(m, o.seq_number), 0) + 1;
      const orderNumber = `${activeSettings.order_prefix || "PN"}-${year}-${String(
        seq
      ).padStart(3, "0")}`;

      const expenses: TravelExpense[] = Array.isArray(body.expenses)
        ? body.expenses
        : [];
      const calc = calculateTravelOrder(
        {
          issue_date: body.issue_date,
          purpose: body.purpose,
          distance_km: Number(body.distance_km || 0),
          departure_at: body.departure_at,
          return_at: body.return_at,
          transport_type: body.transport_type || "PRIVATNO_VOZILO",
          odometer_start: Number(body.odometer_start || 0),
          odometer_end: Number(body.odometer_end || 0),
          one_meal_days: Number(body.one_meal_days || 0),
          two_meals_days: Number(body.two_meals_days || 0),
          advance_payment_eur: Number(body.advance_payment_eur || 0),
          expenses,
        },
        activeSettings
      );

      const emp = store.employees.find(
        (e) => e.id === Number(body.employee_id)
      );
      const veh = store.vehicles.find((v) => v.id === Number(body.vehicle_id));

      const created: TravelOrder = {
        id: nextId,
        company_id: companyId,
        order_number: orderNumber,
        year,
        seq_number: seq,
        status: body.status || "NACRT",
        issue_date: body.issue_date,
        employee_id: Number(body.employee_id),
        employee_name: emp?.full_name || "",
        employee_oib: emp?.oib || "",
        employee_job_title: emp?.job_title || "",
        employee_address: emp?.address || "",
        purpose: body.purpose,
        origin: body.origin,
        destination: body.destination,
        distance_km: Number(body.distance_km || 0),
        departure_at: body.departure_at,
        return_at: body.return_at,
        transport_type: body.transport_type || "PRIVATNO_VOZILO",
        vehicle_id: body.vehicle_id ? Number(body.vehicle_id) : null,
        vehicle_make_model: veh?.make_model || null,
        vehicle_license_plate: veh?.license_plate || null,
        odometer_start: Number(body.odometer_start || 0),
        odometer_end: Number(body.odometer_end || 0),
        total_km: calc.totalKm,
        one_meal_days: Number(body.one_meal_days || 0),
        two_meals_days: Number(body.two_meals_days || 0),
        advance_payment_eur: Number(body.advance_payment_eur || 0),
        trip_report: body.trip_report || "",
        per_diem_total_eur: calc.perDiem.netPerDiemEur,
        mileage_total_eur: calc.mileageTotalEur,
        expenses_total_eur: calc.expensesTotalEur,
        total_amount_eur: calc.totalAmountEur,
        balance_due_eur: calc.balanceDueEur,
        approved_by: body.approved_by || activeSettings.director_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expenses,
      };

      store.orders.unshift(created);
      saveStore(store);
      return jsonResponse(created, 201);
    }
  }

  const ordMatch = url.match(/^\/api\/travel-orders\/(\d+)$/);
  if (ordMatch) {
    const id = Number(ordMatch[1]);
    if (method === "GET") {
      const found = store.orders.find((o) => o.id === id);
      return found
        ? jsonResponse(found)
        : jsonResponse({ error: "Not found" }, 404);
    }
    if (method === "PUT" || method === "PATCH") {
      const existingOrder = store.orders.find((o) => o.id === id);
      if (!existingOrder) {
        return jsonResponse({ error: "Not found" }, 404);
      }
      const merged = { ...existingOrder, ...body };
      const expenses: TravelExpense[] = Array.isArray(merged.expenses)
        ? merged.expenses
        : existingOrder.expenses || [];
      const calc = calculateTravelOrder(
        {
          issue_date: merged.issue_date,
          purpose: merged.purpose,
          distance_km: Number(merged.distance_km || 0),
          departure_at: merged.departure_at,
          return_at: merged.return_at,
          transport_type: merged.transport_type || "PRIVATNO_VOZILO",
          odometer_start: Number(merged.odometer_start || 0),
          odometer_end: Number(merged.odometer_end || 0),
          one_meal_days: Number(merged.one_meal_days || 0),
          two_meals_days: Number(merged.two_meals_days || 0),
          advance_payment_eur: Number(merged.advance_payment_eur || 0),
          expenses,
        },
        activeSettings
      );
      const emp = store.employees.find(
        (e) => e.id === Number(merged.employee_id)
      );
      const veh = store.vehicles.find(
        (v) => v.id === Number(merged.vehicle_id)
      );

      store.orders = store.orders.map((o) =>
        o.id === id
          ? {
              ...o,
              ...merged,
              employee_id: Number(merged.employee_id),
              employee_name: emp?.full_name || o.employee_name,
              employee_oib: emp?.oib || o.employee_oib,
              employee_job_title: emp?.job_title || o.employee_job_title,
              employee_address: emp?.address || o.employee_address,
              vehicle_id: merged.vehicle_id ? Number(merged.vehicle_id) : null,
              vehicle_make_model: veh?.make_model || null,
              vehicle_license_plate: veh?.license_plate || null,
              total_km: calc.totalKm,
              per_diem_total_eur: calc.perDiem.netPerDiemEur,
              mileage_total_eur: calc.mileageTotalEur,
              expenses_total_eur: calc.expensesTotalEur,
              total_amount_eur: calc.totalAmountEur,
              balance_due_eur: calc.balanceDueEur,
              expenses,
              updated_at: new Date().toISOString(),
            }
          : o
      );
      saveStore(store);
      return jsonResponse(store.orders.find((o) => o.id === id));
    }
    if (method === "DELETE") {
      store.orders = store.orders.filter((o) => o.id !== id);
      saveStore(store);
      return jsonResponse({ ok: true });
    }
  }

  // --- Loco Trips ---
  if (url === "/api/loco-trips") {
    if (method === "GET") {
      return jsonResponse(
        store.locoTrips.filter((l) => (l.company_id || 1) === companyId)
      );
    }
    if (method === "POST") {
      const nextId =
        store.locoTrips.reduce((m, l) => Math.max(m, l.id), 0) + 1;
      const odoStart = Number(body.odometer_start || 0);
      const odoEnd = Number(body.odometer_end || 0);
      const distanceKm =
        odoEnd > odoStart
          ? round2(odoEnd - odoStart)
          : round2(Number(body.distance_km || 0));
      const rate = activeSettings.mileage_rate;
      const emp = store.employees.find(
        (e) => e.id === Number(body.employee_id)
      );
      const veh = store.vehicles.find((v) => v.id === Number(body.vehicle_id));

      const created: LocoTrip = {
        id: nextId,
        company_id: companyId,
        trip_date: body.trip_date,
        employee_id: Number(body.employee_id),
        employee_name: emp?.full_name || "",
        employee_oib: emp?.oib || "",
        vehicle_id: body.vehicle_id ? Number(body.vehicle_id) : null,
        vehicle_make_model: veh?.make_model || null,
        vehicle_license_plate: veh?.license_plate || null,
        origin: body.origin,
        destination: body.destination,
        purpose: body.purpose,
        odometer_start: odoStart,
        odometer_end: odoEnd,
        distance_km: distanceKm,
        rate_eur: rate,
        amount_eur: round2(distanceKm * rate),
        status: "EVIDENTIRANO",
        created_at: new Date().toISOString(),
      };
      store.locoTrips.unshift(created);
      saveStore(store);
      return jsonResponse(created, 201);
    }
  }

  const locoMatch = url.match(/^\/api\/loco-trips\/(\d+)$/);
  if (locoMatch) {
    const id = Number(locoMatch[1]);
    if (method === "PATCH") {
      store.locoTrips = store.locoTrips.map((l) =>
        l.id === id ? { ...l, status: body.status } : l
      );
      saveStore(store);
      return jsonResponse({ ok: true });
    }
    if (method === "DELETE") {
      store.locoTrips = store.locoTrips.filter((l) => l.id !== id);
      saveStore(store);
      return jsonResponse({ ok: true });
    }
  }

  return jsonResponse({ error: "Not implemented" }, 404);
}
