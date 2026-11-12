import type {
  CompanySettings,
  LegalWarning,
  PerDiemBreakdown,
  TransportType,
  TravelExpense,
  TravelOrderCalculation,
} from "./types";

export const DEFAULT_CROATIAN_RATES = {
  per_diem_full: 30.0,
  per_diem_half: 15.0,
  mileage_rate: 0.5,
  min_distance_km: 30,
  meal_deduction_one_pct: 30,
  meal_deduction_two_pct: 60,
} as const;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDateHr(isoDate: string): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTimeHr(isoDateTime: string): string {
  if (!isoDateTime) return "—";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return isoDateTime;
  return new Intl.DateTimeFormat("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export interface TravelCalcInput {
  issue_date: string;
  purpose: string;
  distance_km: number;
  departure_at: string;
  return_at: string;
  transport_type: TransportType;
  odometer_start: number;
  odometer_end: number;
  one_meal_days: number;
  two_meals_days: number;
  advance_payment_eur: number;
  expenses: TravelExpense[];
}

export function calculatePerDiem(
  departureAt: string,
  returnAt: string,
  distanceKm: number,
  oneMealDays: number,
  twoMealsDays: number,
  settings: Pick<
    CompanySettings,
    | "per_diem_full"
    | "per_diem_half"
    | "min_distance_km"
    | "meal_deduction_one_pct"
    | "meal_deduction_two_pct"
  >
): PerDiemBreakdown {
  const dep = new Date(departureAt).getTime();
  const ret = new Date(returnAt).getTime();

  if (Number.isNaN(dep) || Number.isNaN(ret) || ret <= dep) {
    return {
      totalHours: 0,
      fullDaysCount: 0,
      remainderHours: 0,
      remainderType: "NONE",
      rawFullCount: 0,
      rawHalfCount: 0,
      grossPerDiemEur: 0,
      oneMealDeductionEur: 0,
      twoMealsDeductionEur: 0,
      netPerDiemEur: 0,
      eligibleForPerDiem: distanceKm >= settings.min_distance_km,
    };
  }

  const totalHours = round2((ret - dep) / (1000 * 60 * 60));
  const eligible = distanceKm >= settings.min_distance_km;

  if (!eligible) {
    return {
      totalHours,
      fullDaysCount: 0,
      remainderHours: round2(totalHours % 24),
      remainderType: "NONE",
      rawFullCount: 0,
      rawHalfCount: 0,
      grossPerDiemEur: 0,
      oneMealDeductionEur: 0,
      twoMealsDeductionEur: 0,
      netPerDiemEur: 0,
      eligibleForPerDiem: false,
    };
  }

  const fullDaysCount = Math.floor(totalHours / 24);
  const remainderHours = round2(totalHours - fullDaysCount * 24);

  let remainderType: "FULL" | "HALF" | "NONE" = "NONE";
  if (remainderHours > 12) {
    remainderType = "FULL";
  } else if (remainderHours >= 8) {
    remainderType = "HALF";
  }

  const rawFullCount = fullDaysCount + (remainderType === "FULL" ? 1 : 0);
  const rawHalfCount = remainderType === "HALF" ? 1 : 0;

  const grossPerDiemEur = round2(
    rawFullCount * settings.per_diem_full +
      rawHalfCount * settings.per_diem_half
  );

  // Build individual per-diem slots (full days first, then half day if any)
  // so meal deductions apply accurately to the actual earned per diems.
  const slots: number[] = [
    ...Array(rawFullCount).fill(settings.per_diem_full),
    ...Array(rawHalfCount).fill(settings.per_diem_half),
  ];

  let oneMealDeductionEur = 0;
  let twoMealsDeductionEur = 0;
  let slotIdx = 0;

  const safeTwo = Math.max(0, Math.floor(twoMealsDays || 0));
  const safeOne = Math.max(0, Math.floor(oneMealDays || 0));

  for (let i = 0; i < safeTwo && slotIdx < slots.length; i++, slotIdx++) {
    twoMealsDeductionEur +=
      slots[slotIdx] * (settings.meal_deduction_two_pct / 100);
  }

  for (let i = 0; i < safeOne && slotIdx < slots.length; i++, slotIdx++) {
    oneMealDeductionEur +=
      slots[slotIdx] * (settings.meal_deduction_one_pct / 100);
  }

  oneMealDeductionEur = round2(oneMealDeductionEur);
  twoMealsDeductionEur = round2(twoMealsDeductionEur);

  const netPerDiemEur = round2(
    Math.max(0, grossPerDiemEur - oneMealDeductionEur - twoMealsDeductionEur)
  );

  return {
    totalHours,
    fullDaysCount,
    remainderHours,
    remainderType,
    rawFullCount,
    rawHalfCount,
    grossPerDiemEur,
    oneMealDeductionEur,
    twoMealsDeductionEur,
    netPerDiemEur,
    eligibleForPerDiem: true,
  };
}

export function calculateTravelOrder(
  input: TravelCalcInput,
  settings: CompanySettings
): TravelOrderCalculation {
  const warnings: LegalWarning[] = [];

  const perDiem = calculatePerDiem(
    input.departure_at,
    input.return_at,
    input.distance_km || 0,
    input.one_meal_days || 0,
    input.two_meals_days || 0,
    settings
  );

  // 1. Check issue date vs departure date
  if (input.issue_date && input.departure_at) {
    const issueDay = input.issue_date.slice(0, 10);
    const depDay = input.departure_at.slice(0, 10);
    if (issueDay > depDay) {
      warnings.push({
        severity: "error",
        code: "ISSUE_AFTER_DEPARTURE",
        message:
          "Datum izdavanja putnog naloga je nakon datuma polaska. Prema Pravilniku o porezu na dohodak, putni nalog mora biti izdan prije polaska na put.",
      });
    }
  }

  // 2. Check return > departure
  if (input.departure_at && input.return_at) {
    if (new Date(input.return_at).getTime() <= new Date(input.departure_at).getTime()) {
      warnings.push({
        severity: "error",
        code: "INVALID_DATES",
        message: "Datum i vrijeme povratka moraju biti nakon polaska.",
      });
    }
  }

  // 3. Check 30 km rule
  if ((input.distance_km || 0) > 0 && input.distance_km < settings.min_distance_km) {
    warnings.push({
      severity: "info",
      code: "UNDER_30KM",
      message: `Udaljenost (${input.distance_km} km) je manja od zakonskog praga od ${settings.min_distance_km} km. Nema prava na neoporezivu dnevnicu; za korištenje privatnog vozila koristite Loko vožnju.`,
    });
  }

  // 4. Check purpose specificity
  const normalizedPurpose = (input.purpose || "").trim().toLowerCase();
  if (
    normalizedPurpose.length > 0 &&
    (normalizedPurpose.length < 8 ||
      normalizedPurpose === "službeni put" ||
      normalizedPurpose === "sluzbeni put")
  ) {
    warnings.push({
      severity: "warning",
      code: "GENERIC_PURPOSE",
      message:
        'Svrha putovanja treba biti konkretno opisana (npr. "Sastanak s klijentom X radi ugovora"), a ne samo općenito "službeni put".',
    });
  }

  // 5. Meal deduction count vs earned per diems
  const totalEarnedSlots = perDiem.rawFullCount + perDiem.rawHalfCount;
  const totalMealDays = (input.one_meal_days || 0) + (input.two_meals_days || 0);
  if (totalMealDays > totalEarnedSlots && totalEarnedSlots > 0) {
    warnings.push({
      severity: "warning",
      code: "MEALS_EXCEED_PER_DIEM",
      message: `Broj dana s osiguranim obrocima (${totalMealDays}) veći je od broja ostvarenih dnevnica (${totalEarnedSlots}). Umanjenje je primijenjeno samo na ostvarene dnevnice.`,
    });
  }

  // 6. Mileage calculation
  let totalKm = 0;
  let mileageTotalEur = 0;
  const hasOdometer =
    (input.odometer_end || 0) > 0 &&
    (input.odometer_end || 0) > (input.odometer_start || 0);

  if (input.transport_type === "PRIVATNO_VOZILO") {
    if (hasOdometer) {
      totalKm = round2(input.odometer_end - input.odometer_start);
    } else {
      warnings.push({
        severity: "warning",
        code: "MISSING_ODOMETER",
        message:
          "Za korištenje privatnog vozila obavezno je upisati početno i završno stanje kilometarskog brojila.",
      });
    }
    mileageTotalEur = round2(totalKm * settings.mileage_rate);
  } else if (input.transport_type === "SLUZBENO_VOZILO" && hasOdometer) {
    totalKm = round2(input.odometer_end - input.odometer_start);
  }

  // 7. Expenses & fuel check for private vehicle
  let expensesTotalEur = 0;
  for (const exp of input.expenses || []) {
    expensesTotalEur += Number(exp.amount_eur) || 0;
    if (
      input.transport_type === "PRIVATNO_VOZILO" &&
      exp.category === "GORIVO"
    ) {
      warnings.push({
        severity: "error",
        code: "FUEL_WITH_PRIVATE_CAR",
        message:
          "Trošak goriva ne može se neoporezivo isplatiti uz naknadu od 0,50 €/km za privatno vozilo (dopušteni su samo cestarina i parking).",
      });
    }
  }
  expensesTotalEur = round2(expensesTotalEur);

  const totalAmountEur = round2(
    perDiem.netPerDiemEur + mileageTotalEur + expensesTotalEur
  );
  const balanceDueEur = round2(
    totalAmountEur - (Number(input.advance_payment_eur) || 0)
  );

  return {
    perDiem,
    totalKm,
    mileageTotalEur,
    expensesTotalEur,
    totalAmountEur,
    balanceDueEur,
    warnings,
  };
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NACRT: "Nacrt",
  ODOBREN: "Odobren",
  OBRACUNAT: "Obračunat",
  ISPLACEN: "Isplaćen",
};

export const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = {
  PRIVATNO_VOZILO: "Privatno vozilo (0,50 €/km)",
  SLUZBENO_VOZILO: "Službeno vozilo",
  JAVNI_PRIJEVOZ: "Javni prijevoz",
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  CESTARINA: "Cestarina / Tunelarina",
  PARKING: "Parking",
  SMJESTAJ: "Smještaj (noćenje)",
  JAVNI_PRIJEVOZ: "Karta (vlak / bus / avion)",
  GORIVO: "Gorivo (samo službeno vozilo)",
  OSTALO: "Ostali troškovi",
};
