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

export type UserRole = "global_admin" | "company_admin" | "user";

export interface UserPermissions {
  canManageTravelOrders: boolean;
  canApproveTravelOrders: boolean;
  canManageLoco: boolean;
  canManageMasterData: boolean;
  canViewAnalytics: boolean;
  canManageJoppd: boolean;
  canBackupRestore: boolean;
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

export interface Company {
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
  active: number;
  created_at: string;
  employee_count?: number;
  user_count?: number;
  order_count?: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: number | null;
  company_name?: string | null;
  permissions: UserPermissions;
  active: number;
  created_at: string;
}

export interface AuthSession {
  user: User;
  activeCompanyId: number;
  activeCompany: Company;
  companies?: Company[];
}

export interface CompanySettings {
  id: number;
  company_id?: number;
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
  company_id?: number;
  full_name: string;
  oib: string;
  job_title: string;
  address: string;
  active: number;
  created_at: string;
}

export interface Vehicle {
  id: number;
  company_id?: number;
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
  company_id?: number;
  country_code?: string;
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
  company_id?: number;
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

export interface CompanyBackupData {
  company: Company;
  settings: CompanySettings;
  employees: Employee[];
  vehicles: Vehicle[];
  travelOrders: TravelOrder[];
  locoTrips: LocoTrip[];
  users?: Array<Omit<User, "id"> & { id?: number }>;
}

export interface BackupPayload {
  version: string;
  exportedAt: string;
  exportedBy: string;
  scope: "company" | "all";
  companyData?: CompanyBackupData;
  allCompaniesData?: CompanyBackupData[];
  globalUsers?: User[];
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
