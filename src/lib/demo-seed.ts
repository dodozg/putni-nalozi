import { calculateTravelOrder, round2 } from "./croatian-rules";
import type {
  CompanySettings,
  Employee,
  LocoTrip,
  TravelExpense,
  TravelOrder,
  Vehicle,
} from "./types";

export const INITIAL_DEMO_SETTINGS: CompanySettings = {
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
};

export const INITIAL_DEMO_EMPLOYEES: Employee[] = [
  {
    id: 1,
    full_name: "Marko Kovačević",
    oib: "23456789012",
    job_title: "Voditelj projekata",
    address: "Ilica 142, Zagreb",
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
  {
    id: 2,
    full_name: "Ana Babić",
    oib: "34567890123",
    job_title: "Konzultantica za prodaju",
    address: "Vukovarska 45, Zagreb",
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
  {
    id: 3,
    full_name: "Luka Novak",
    oib: "45678901234",
    job_title: "Terenski inženjer",
    address: "Savska cesta 90, Zagreb",
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
];

export const INITIAL_DEMO_VEHICLES: Vehicle[] = [
  {
    id: 1,
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
    ownership_type: "PRIVATNO",
    make_model: "Renault Clio 1.5 dCi",
    license_plate: "ZG-1129-CD",
    employee_id: 2,
    employee_name: "Ana Babić",
    current_odometer: 62140,
    active: 1,
    created_at: "2026-01-10T08:00:00Z",
  },
];

export const INITIAL_DEMO_ORDERS: TravelOrder[] = [
  {
    id: 1,
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
];

export const INITIAL_DEMO_LOCO_TRIPS: LocoTrip[] = [
  {
    id: 1,
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
];

// Client-side localStorage store for static/Cloudflare Workers demo mode
const STORAGE_KEY = "putni_nalozi_hr_demo_v1";

interface DemoStore {
  settings: CompanySettings;
  employees: Employee[];
  vehicles: Vehicle[];
  orders: TravelOrder[];
  locoTrips: LocoTrip[];
}

function loadStore(): DemoStore {
  if (typeof window === "undefined") {
    return {
      settings: INITIAL_DEMO_SETTINGS,
      employees: INITIAL_DEMO_EMPLOYEES,
      vehicles: INITIAL_DEMO_VEHICLES,
      orders: INITIAL_DEMO_ORDERS,
      locoTrips: INITIAL_DEMO_LOCO_TRIPS,
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as DemoStore;
    }
  } catch {
    // ignore storage errors
  }
  const initial: DemoStore = {
    settings: INITIAL_DEMO_SETTINGS,
    employees: INITIAL_DEMO_EMPLOYEES,
    vehicles: INITIAL_DEMO_VEHICLES,
    orders: INITIAL_DEMO_ORDERS,
    locoTrips: INITIAL_DEMO_LOCO_TRIPS,
  };
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

// Universal fetch wrapper: uses real Next.js API when available, falls back to localStorage store on static/Workers deployment
export async function apiFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get("content-type") || "";
    if (res.status !== 404 && res.status !== 405 && contentType.includes("application/json")) {
      return res;
    }
  } catch {
    // Fallback to client demo store
  }

  return handleDemoRequest(input, init);
}

function handleDemoRequest(url: string, init?: RequestInit): Response {
  const method = (init?.method || "GET").toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const store = loadStore();

  if (url === "/api/settings") {
    if (method === "GET") return jsonResponse(store.settings);
    if (method === "PUT") {
      store.settings = { ...store.settings, ...body, id: 1 };
      saveStore(store);
      return jsonResponse(store.settings);
    }
  }

  if (url === "/api/employees") {
    if (method === "GET") return jsonResponse(store.employees);
    if (method === "POST") {
      const nextId =
        store.employees.reduce((m, e) => Math.max(m, e.id), 0) + 1;
      const emp: Employee = {
        id: nextId,
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

  if (url === "/api/vehicles") {
    if (method === "GET") return jsonResponse(store.vehicles);
    if (method === "POST") {
      const nextId =
        store.vehicles.reduce((m, v) => Math.max(m, v.id), 0) + 1;
      const emp = store.employees.find(
        (e) => e.id === Number(body.employee_id)
      );
      const veh: Vehicle = {
        id: nextId,
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

  if (url === "/api/travel-orders") {
    if (method === "GET") return jsonResponse(store.orders);
    if (method === "POST") {
      const nextId = store.orders.reduce((m, o) => Math.max(m, o.id), 0) + 1;
      const year = Number((body.issue_date || "").slice(0, 4)) || 2026;
      const seq =
        store.orders
          .filter((o) => o.year === year)
          .reduce((m, o) => Math.max(m, o.seq_number), 0) + 1;
      const orderNumber = `${store.settings.order_prefix || "PN"}-${year}-${String(
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
        store.settings
      );

      const emp = store.employees.find(
        (e) => e.id === Number(body.employee_id)
      );
      const veh = store.vehicles.find((v) => v.id === Number(body.vehicle_id));

      const created: TravelOrder = {
        id: nextId,
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
        approved_by: body.approved_by || store.settings.director_name,
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
    if (method === "PUT") {
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
        store.settings
      );
      const emp = store.employees.find(
        (e) => e.id === Number(body.employee_id)
      );
      const veh = store.vehicles.find((v) => v.id === Number(body.vehicle_id));

      store.orders = store.orders.map((o) =>
        o.id === id
          ? {
              ...o,
              ...body,
              employee_id: Number(body.employee_id),
              employee_name: emp?.full_name || o.employee_name,
              employee_oib: emp?.oib || o.employee_oib,
              employee_job_title: emp?.job_title || o.employee_job_title,
              employee_address: emp?.address || o.employee_address,
              vehicle_id: body.vehicle_id ? Number(body.vehicle_id) : null,
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

  if (url === "/api/loco-trips") {
    if (method === "GET") return jsonResponse(store.locoTrips);
    if (method === "POST") {
      const nextId =
        store.locoTrips.reduce((m, l) => Math.max(m, l.id), 0) + 1;
      const odoStart = Number(body.odometer_start || 0);
      const odoEnd = Number(body.odometer_end || 0);
      const distanceKm =
        odoEnd > odoStart
          ? round2(odoEnd - odoStart)
          : round2(Number(body.distance_km || 0));
      const rate = store.settings.mileage_rate;
      const emp = store.employees.find(
        (e) => e.id === Number(body.employee_id)
      );
      const veh = store.vehicles.find((v) => v.id === Number(body.vehicle_id));

      const created: LocoTrip = {
        id: nextId,
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
