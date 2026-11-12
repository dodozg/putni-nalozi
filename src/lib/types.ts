export type OrderStatus = "NACRT" | "ODOBREN" | "OBRACUNAT" | "ISPLACEN";

export type TransportType =
  | "PRIVATNO_VOZILO"
  | "SLUZBENO_VOZILO"
  | "JAVNI_PRIJEVOZ";

export type ExpenseCategory =
  | "CESTARINA"
  | "PARKING"
  | "SMJESTAJ"
  | "JAVNI_PRIJEVOZ"
  | "GORIVO"
  | "OSTALO";

export type VehicleOwnership = "SLUZBENO" | "PRIVATNO";

export type LocoStatus = "EVIDENTIRANO" | "ISPLACENO";

export interface CompanySettings {
  id: number;
  name: string;
  oib: string;
  address: string;
  city: string;
  iban: string;
  director_name: string;
  order_prefix: string;
  per_diem_full: number;
  per_diem_half: number;
  mileage_rate: number;
  min_distance_km: number;
  meal_deduction_one_pct: number;
  meal_deduction_two_pct: number;
}

export interface Employee {
  id: number;
  full_name: string;
  oib: string;
  job_title: string;
  address: string;
  active: number;
  created_at: string;
}

export interface Vehicle {
  id: number;
  ownership_type: VehicleOwnership;
  make_model: string;
  license_plate: string;
  employee_id: number | null;
  employee_name?: string | null;
  current_odometer: number;
  active: number;
  created_at: string;
}

export interface TravelExpense {
  id?: number;
  travel_order_id?: number;
  category: ExpenseCategory;
  description: string;
  receipt_number: string;
  expense_date: string;
  amount_eur: number;
}

export interface TravelOrder {
  id: number;
  order_number: string;
  year: number;
  seq_number: number;
  status: OrderStatus;
  issue_date: string;
  employee_id: number;
  employee_name?: string;
  employee_oib?: string;
  employee_job_title?: string;
  employee_address?: string;
  purpose: string;
  origin: string;
  destination: string;
  distance_km: number;
  departure_at: string;
  return_at: string;
  transport_type: TransportType;
  vehicle_id: number | null;
  vehicle_make_model?: string | null;
  vehicle_license_plate?: string | null;
  odometer_start: number;
  odometer_end: number;
  total_km: number;
  one_meal_days: number;
  two_meals_days: number;
  advance_payment_eur: number;
  trip_report: string;
  per_diem_total_eur: number;
  mileage_total_eur: number;
  expenses_total_eur: number;
  total_amount_eur: number;
  balance_due_eur: number;
  approved_by: string;
  created_at: string;
  updated_at: string;
  expenses?: TravelExpense[];
}

export interface LocoTrip {
  id: number;
  trip_date: string;
  employee_id: number;
  employee_name?: string;
  employee_oib?: string;
  vehicle_id: number | null;
  vehicle_make_model?: string | null;
  vehicle_license_plate?: string | null;
  origin: string;
  destination: string;
  purpose: string;
  odometer_start: number;
  odometer_end: number;
  distance_km: number;
  rate_eur: number;
  amount_eur: number;
  status: LocoStatus;
  created_at: string;
}

export interface LegalWarning {
  severity: "warning" | "info" | "error";
  code: string;
  message: string;
}

export interface PerDiemBreakdown {
  totalHours: number;
  fullDaysCount: number;
  remainderHours: number;
  remainderType: "FULL" | "HALF" | "NONE";
  rawFullCount: number;
  rawHalfCount: number;
  grossPerDiemEur: number;
  oneMealDeductionEur: number;
  twoMealsDeductionEur: number;
  netPerDiemEur: number;
  eligibleForPerDiem: boolean;
}

export interface TravelOrderCalculation {
  perDiem: PerDiemBreakdown;
  totalKm: number;
  mileageTotalEur: number;
  expensesTotalEur: number;
  totalAmountEur: number;
  balanceDueEur: number;
  warnings: LegalWarning[];
}
