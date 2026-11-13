import {
  formatDateHr,
  formatDateTimeHr,
  ORDER_STATUS_LABELS,
  round2,
  TRANSPORT_TYPE_LABELS,
} from "./croatian-rules";
import type {
  Employee,
  LocoTrip,
  TravelOrder,
  Vehicle,
  VehicleOwnership,
} from "./types";

export interface MonthlyStat {
  monthKey: string;
  monthLabel: string;
  ordersCount: number;
  locoCount: number;
  totalKm: number;
  perDiemEur: number;
  mileageEur: number;
  expensesEur: number;
  locoEur: number;
  totalEur: number;
}

export interface EmployeeStat {
  employeeId: number;
  employeeName: string;
  oib: string;
  jobTitle: string;
  ordersCount: number;
  locoCount: number;
  totalKm: number;
  perDiemEur: number;
  mileageEur: number;
  expensesEur: number;
  totalEur: number;
}

export interface VehicleStat {
  vehicleId: number;
  makeModel: string;
  licensePlate: string;
  ownershipType: VehicleOwnership;
  ordersCount: number;
  locoCount: number;
  totalKm: number;
  mileageEur: number;
  expensesEur: number;
  totalEur: number;
}

export interface CostStructureSummary {
  perDiemEur: number;
  ordersMileageEur: number;
  locoMileageEur: number;
  mileageEur: number;
  expensesEur: number;
  totalEur: number;
  perDiemPct: number;
  mileagePct: number;
  expensesPct: number;
}

export interface AnalyticsKpis {
  totalOrdersCount: number;
  totalLocoCount: number;
  totalTripsCount: number;
  ordersKm: number;
  locoKm: number;
  totalKm: number;
  totalOrdersAmountEur: number;
  totalLocoAmountEur: number;
  totalCombinedAmountEur: number;
  averageOrderCostEur: number;
}

export interface AnalyticsSummary {
  kpis: AnalyticsKpis;
  costStructure: CostStructureSummary;
  monthlyStats: MonthlyStat[];
  employeeStats: EmployeeStat[];
  vehicleStats: VehicleStat[];
}

const HR_MONTH_NAMES = [
  "sij",
  "velj",
  "ožu",
  "tra",
  "svi",
  "lip",
  "srp",
  "kol",
  "ruj",
  "lis",
  "stu",
  "pro",
];

function formatMonthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const name = HR_MONTH_NAMES[monthIdx] ?? match[2];
  return `${name} ${year}`;
}

function escapeCsvCell(value: string): string {
  if (
    value.includes(";") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsvNumber(value: number): string {
  return round2(Number(value) || 0)
    .toFixed(2)
    .replace(".", ",");
}

/**
 * Generates a UTF-8 CSV (with BOM, semicolon-delimited) suitable for Croatian Excel.
 */
export function exportOrdersToCsv(orders: TravelOrder[]): string {
  const headers = [
    "Broj naloga",
    "Datum izdavanja",
    "Radnik",
    "OIB",
    "Relacija",
    "Polazak",
    "Povratak",
    "Prijevoz",
    "Prijeđeni km",
    "Dnevnice (EUR)",
    "Kilometraža (EUR)",
    "Računi (EUR)",
    "Ukupno (EUR)",
    "Status",
  ];

  const rows = orders.map((order) => {
    const km = order.total_km > 0 ? order.total_km : order.distance_km || 0;
    const route = `${order.origin || ""} - ${order.destination || ""}`.trim();
    const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
    const transportLabel =
      TRANSPORT_TYPE_LABELS[order.transport_type] || order.transport_type;

    const cells = [
      order.order_number || "",
      formatDateHr(order.issue_date),
      order.employee_name || "",
      order.employee_oib || "",
      route,
      formatDateTimeHr(order.departure_at),
      formatDateTimeHr(order.return_at),
      transportLabel,
      formatCsvNumber(km),
      formatCsvNumber(order.per_diem_total_eur),
      formatCsvNumber(order.mileage_total_eur),
      formatCsvNumber(order.expenses_total_eur),
      formatCsvNumber(order.total_amount_eur),
      statusLabel,
    ];

    return cells.map((cell) => escapeCsvCell(String(cell))).join(";");
  });

  const headerLine = headers.map(escapeCsvCell).join(";");
  return "\uFEFF" + [headerLine, ...rows].join("\r\n");
}

function extractMonthKey(dateStr?: string): string {
  if (!dateStr || dateStr.length < 7) return "Nepoznato";
  const prefix = dateStr.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(prefix) ? prefix : "Nepoznato";
}

/**
 * Computes monthly statistics, employee spending, vehicle spending, and cost structure
 * across travel orders and loco trips.
 */
export function computeAnalyticsSummary(
  orders: TravelOrder[],
  locoTrips: LocoTrip[],
  employees: Employee[],
  vehicles: Vehicle[]
): AnalyticsSummary {
  const employeeMap = new Map<number, Employee>();
  for (const emp of employees) {
    employeeMap.set(emp.id, emp);
  }

  const vehicleMap = new Map<number, Vehicle>();
  for (const veh of vehicles) {
    vehicleMap.set(veh.id, veh);
  }

  let ordersKm = 0;
  let locoKm = 0;
  let perDiemEur = 0;
  let ordersMileageEur = 0;
  let locoMileageEur = 0;
  let expensesEur = 0;
  let totalOrdersAmountEur = 0;
  let totalLocoAmountEur = 0;

  const monthlyMap = new Map<string, MonthlyStat>();
  const empStatsMap = new Map<number, EmployeeStat>();
  const vehStatsMap = new Map<number, VehicleStat>();

  const getOrCreateMonth = (monthKey: string): MonthlyStat => {
    let entry = monthlyMap.get(monthKey);
    if (!entry) {
      entry = {
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        ordersCount: 0,
        locoCount: 0,
        totalKm: 0,
        perDiemEur: 0,
        mileageEur: 0,
        expensesEur: 0,
        locoEur: 0,
        totalEur: 0,
      };
      monthlyMap.set(monthKey, entry);
    }
    return entry;
  };

  const getOrCreateEmployee = (
    employeeId: number,
    fallbackName?: string,
    fallbackOib?: string,
    fallbackTitle?: string
  ): EmployeeStat => {
    let entry = empStatsMap.get(employeeId);
    if (!entry) {
      const emp = employeeMap.get(employeeId);
      entry = {
        employeeId,
        employeeName: emp?.full_name || fallbackName || `Radnik #${employeeId}`,
        oib: emp?.oib || fallbackOib || "",
        jobTitle: emp?.job_title || fallbackTitle || "",
        ordersCount: 0,
        locoCount: 0,
        totalKm: 0,
        perDiemEur: 0,
        mileageEur: 0,
        expensesEur: 0,
        totalEur: 0,
      };
      empStatsMap.set(employeeId, entry);
    }
    return entry;
  };

  const getOrCreateVehicle = (
    vehicleId: number,
    fallbackMakeModel?: string | null,
    fallbackPlate?: string | null
  ): VehicleStat => {
    let entry = vehStatsMap.get(vehicleId);
    if (!entry) {
      const veh = vehicleMap.get(vehicleId);
      entry = {
        vehicleId,
        makeModel:
          veh?.make_model || fallbackMakeModel || `Vozilo #${vehicleId}`,
        licensePlate: veh?.license_plate || fallbackPlate || "—",
        ownershipType: veh?.ownership_type || "SLUZBENO",
        ordersCount: 0,
        locoCount: 0,
        totalKm: 0,
        mileageEur: 0,
        expensesEur: 0,
        totalEur: 0,
      };
      vehStatsMap.set(vehicleId, entry);
    }
    return entry;
  };

  for (const order of orders) {
    const km = Number(order.total_km > 0 ? order.total_km : order.distance_km) || 0;
    const perDiem = Number(order.per_diem_total_eur) || 0;
    const mileage = Number(order.mileage_total_eur) || 0;
    const expenses = Number(order.expenses_total_eur) || 0;
    const total = Number(order.total_amount_eur) || 0;

    ordersKm += km;
    perDiemEur += perDiem;
    ordersMileageEur += mileage;
    expensesEur += expenses;
    totalOrdersAmountEur += total;

    const monthKey = extractMonthKey(
      order.departure_at || order.issue_date || order.created_at
    );
    const mStat = getOrCreateMonth(monthKey);
    mStat.ordersCount += 1;
    mStat.totalKm = round2(mStat.totalKm + km);
    mStat.perDiemEur = round2(mStat.perDiemEur + perDiem);
    mStat.mileageEur = round2(mStat.mileageEur + mileage);
    mStat.expensesEur = round2(mStat.expensesEur + expenses);
    mStat.totalEur = round2(mStat.totalEur + total);

    const eStat = getOrCreateEmployee(
      order.employee_id,
      order.employee_name,
      order.employee_oib,
      order.employee_job_title
    );
    eStat.ordersCount += 1;
    eStat.totalKm = round2(eStat.totalKm + km);
    eStat.perDiemEur = round2(eStat.perDiemEur + perDiem);
    eStat.mileageEur = round2(eStat.mileageEur + mileage);
    eStat.expensesEur = round2(eStat.expensesEur + expenses);
    eStat.totalEur = round2(eStat.totalEur + total);

    if (order.vehicle_id) {
      const vStat = getOrCreateVehicle(
        order.vehicle_id,
        order.vehicle_make_model,
        order.vehicle_license_plate
      );
      vStat.ordersCount += 1;
      vStat.totalKm = round2(vStat.totalKm + km);
      vStat.mileageEur = round2(vStat.mileageEur + mileage);
      vStat.expensesEur = round2(vStat.expensesEur + expenses);
      vStat.totalEur = round2(vStat.totalEur + mileage + expenses);
    }
  }

  for (const trip of locoTrips) {
    const km = Number(trip.distance_km) || 0;
    const amount = Number(trip.amount_eur) || 0;

    locoKm += km;
    locoMileageEur += amount;
    totalLocoAmountEur += amount;

    const monthKey = extractMonthKey(trip.trip_date || trip.created_at);
    const mStat = getOrCreateMonth(monthKey);
    mStat.locoCount += 1;
    mStat.totalKm = round2(mStat.totalKm + km);
    mStat.mileageEur = round2(mStat.mileageEur + amount);
    mStat.locoEur = round2(mStat.locoEur + amount);
    mStat.totalEur = round2(mStat.totalEur + amount);

    const eStat = getOrCreateEmployee(
      trip.employee_id,
      trip.employee_name,
      trip.employee_oib
    );
    eStat.locoCount += 1;
    eStat.totalKm = round2(eStat.totalKm + km);
    eStat.mileageEur = round2(eStat.mileageEur + amount);
    eStat.totalEur = round2(eStat.totalEur + amount);

    if (trip.vehicle_id) {
      const vStat = getOrCreateVehicle(
        trip.vehicle_id,
        trip.vehicle_make_model,
        trip.vehicle_license_plate
      );
      vStat.locoCount += 1;
      vStat.totalKm = round2(vStat.totalKm + km);
      vStat.mileageEur = round2(vStat.mileageEur + amount);
      vStat.totalEur = round2(vStat.totalEur + amount);
    }
  }

  ordersKm = round2(ordersKm);
  locoKm = round2(locoKm);
  const totalKm = round2(ordersKm + locoKm);

  perDiemEur = round2(perDiemEur);
  ordersMileageEur = round2(ordersMileageEur);
  locoMileageEur = round2(locoMileageEur);
  const mileageEur = round2(ordersMileageEur + locoMileageEur);
  expensesEur = round2(expensesEur);

  totalOrdersAmountEur = round2(totalOrdersAmountEur);
  totalLocoAmountEur = round2(totalLocoAmountEur);
  const totalCombinedAmountEur = round2(
    totalOrdersAmountEur + totalLocoAmountEur
  );
  const averageOrderCostEur =
    orders.length > 0 ? round2(totalOrdersAmountEur / orders.length) : 0;

  const structureTotal = round2(perDiemEur + mileageEur + expensesEur);
  const perDiemPct =
    structureTotal > 0 ? round2((perDiemEur / structureTotal) * 100) : 0;
  const mileagePct =
    structureTotal > 0 ? round2((mileageEur / structureTotal) * 100) : 0;
  const expensesPct =
    structureTotal > 0 ? round2((expensesEur / structureTotal) * 100) : 0;

  const monthlyStats = Array.from(monthlyMap.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey)
  );
  const employeeStats = Array.from(empStatsMap.values()).sort(
    (a, b) => b.totalEur - a.totalEur
  );
  const vehicleStats = Array.from(vehStatsMap.values()).sort(
    (a, b) => b.totalKm - a.totalKm
  );

  return {
    kpis: {
      totalOrdersCount: orders.length,
      totalLocoCount: locoTrips.length,
      totalTripsCount: orders.length + locoTrips.length,
      ordersKm,
      locoKm,
      totalKm,
      totalOrdersAmountEur,
      totalLocoAmountEur,
      totalCombinedAmountEur,
      averageOrderCostEur,
    },
    costStructure: {
      perDiemEur,
      ordersMileageEur,
      locoMileageEur,
      mileageEur,
      expensesEur,
      totalEur: structureTotal,
      perDiemPct,
      mileagePct,
      expensesPct,
    },
    monthlyStats,
    employeeStats,
    vehicleStats,
  };
}
