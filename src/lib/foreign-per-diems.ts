import type { LegalWarning } from "./types";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type ForeignCurrency = "EUR" | "USD" | "GBP" | "CHF";

export interface ForeignPerDiemCountry {
  code: string;
  name: string;
  dailyRate: number;
  currency: ForeignCurrency;
  /** Indicative HNB middle rate: 1 unit of foreign currency in EUR */
  exchangeRateToEur: number;
  region: "EU" | "EUROPA_OSTALO" | "SVIJET";
  notes?: string;
}

/**
 * Indikativni srednji tečajevi HNB-a (1 jedinica strane valute = X EUR).
 * Korisnik u kalkulatoru može unijeti točan tečaj HNB-a na dan obračuna.
 */
export const DEFAULT_EXCHANGE_RATES_TO_EUR: Record<ForeignCurrency, number> = {
  EUR: 1.0,
  USD: 0.92,
  GBP: 1.18,
  CHF: 1.06,
};

/**
 * Službene dnevnice za službena putovanja u inozemstvo prema Odluci Vlade RH
 * o visini dnevnice za službeno putovanje u inozemstvo za korisnike koji se
 * financiraju iz sredstava državnog proračuna (NN / važeći iznosi).
 */
export const FOREIGN_PER_DIEM_COUNTRIES: ForeignPerDiemCountry[] = [
  {
    code: "DE",
    name: "Njemačka",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "AT",
    name: "Austrija",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "IT",
    name: "Italija",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "SI",
    name: "Slovenija",
    dailyRate: 50,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "FR",
    name: "Francuska",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "CH",
    name: "Švicarska",
    dailyRate: 80,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EUROPA_OSTALO",
  },
  {
    code: "GB",
    name: "Ujedinjeno Kraljevstvo",
    dailyRate: 70,
    currency: "GBP",
    exchangeRateToEur: DEFAULT_EXCHANGE_RATES_TO_EUR.GBP,
    region: "EUROPA_OSTALO",
  },
  {
    code: "US",
    name: "Sjedinjene Američke Države",
    dailyRate: 85,
    currency: "USD",
    exchangeRateToEur: DEFAULT_EXCHANGE_RATES_TO_EUR.USD,
    region: "SVIJET",
  },
  {
    code: "HU",
    name: "Mađarska",
    dailyRate: 50,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "RS",
    name: "Srbija",
    dailyRate: 40,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EUROPA_OSTALO",
  },
  {
    code: "BA",
    name: "Bosna i Hercegovina",
    dailyRate: 40,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EUROPA_OSTALO",
  },
  {
    code: "CZ",
    name: "Češka",
    dailyRate: 50,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "PL",
    name: "Poljska",
    dailyRate: 50,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "NL",
    name: "Nizozemska",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "BE",
    name: "Belgija",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "ES",
    name: "Španjolska",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "PT",
    name: "Portugal",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "GR",
    name: "Grčka",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "IE",
    name: "Irska",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "DK",
    name: "Danska",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "SE",
    name: "Švedska",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "NO",
    name: "Norveška",
    dailyRate: 80,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EUROPA_OSTALO",
  },
  {
    code: "FI",
    name: "Finska",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "SK",
    name: "Slovačka",
    dailyRate: 50,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "RO",
    name: "Rumunjska",
    dailyRate: 50,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "BG",
    name: "Bugarska",
    dailyRate: 50,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "LU",
    name: "Luksemburg",
    dailyRate: 70,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EU",
  },
  {
    code: "ME",
    name: "Crna Gora",
    dailyRate: 40,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EUROPA_OSTALO",
  },
  {
    code: "MK",
    name: "Sjeverna Makedonija",
    dailyRate: 40,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EUROPA_OSTALO",
  },
  {
    code: "TR",
    name: "Turska",
    dailyRate: 55,
    currency: "EUR",
    exchangeRateToEur: 1.0,
    region: "EUROPA_OSTALO",
  },
  {
    code: "CA",
    name: "Kanada",
    dailyRate: 85,
    currency: "USD",
    exchangeRateToEur: DEFAULT_EXCHANGE_RATES_TO_EUR.USD,
    region: "SVIJET",
  },
  {
    code: "JP",
    name: "Japan",
    dailyRate: 85,
    currency: "USD",
    exchangeRateToEur: DEFAULT_EXCHANGE_RATES_TO_EUR.USD,
    region: "SVIJET",
  },
  {
    code: "AU",
    name: "Australija",
    dailyRate: 85,
    currency: "USD",
    exchangeRateToEur: DEFAULT_EXCHANGE_RATES_TO_EUR.USD,
    region: "SVIJET",
  },
  {
    code: "AE",
    name: "Ujedinjeni Arapski Emirati",
    dailyRate: 75,
    currency: "USD",
    exchangeRateToEur: DEFAULT_EXCHANGE_RATES_TO_EUR.USD,
    region: "SVIJET",
  },
  {
    code: "LI",
    name: "Lihtenštajn",
    dailyRate: 80,
    currency: "CHF",
    exchangeRateToEur: DEFAULT_EXCHANGE_RATES_TO_EUR.CHF,
    region: "EUROPA_OSTALO",
  },
];

export interface ForeignPerDiemInput {
  countryCode: string;
  /** Polazak iz sjedišta/prebivališta u RH (ISO datetime) */
  departureAt: string;
  /** Prelazak hrvatske granice pri odlasku (ISO datetime); ako nije zadano, koristi se departureAt */
  borderExitAt?: string;
  /** Prelazak hrvatske granice pri povratku (ISO datetime); ako nije zadano, koristi se returnAt */
  borderReturnAt?: string;
  /** Povratak u sjedište/prebivalište u RH (ISO datetime) */
  returnAt: string;
  /** Broj dana s osiguranim 1 obrokom (-30%) */
  oneMealDays?: number;
  /** Broj dana s osigurana 2 obroka (-60%) */
  twoMealsDays?: number;
  /** Opcionalni tečaj (1 jedinica strane valute u EUR) */
  customExchangeRateToEur?: number;
  /** Tuzemna dnevnica u EUR za dio puta u RH (default 30,00 €) */
  domesticPerDiemEur?: number;
}

export interface ForeignPerDiemResult {
  country: ForeignPerDiemCountry;
  totalHours: number;
  foreignHours: number;
  domesticHours: number;
  foreignFullCount: number;
  foreignHalfCount: number;
  domesticFullCount: number;
  domesticHalfCount: number;
  grossForeignAmount: number;
  oneMealDeductionForeign: number;
  twoMealsDeductionForeign: number;
  netForeignAmount: number;
  exchangeRateToEur: number;
  netForeignAmountEur: number;
  grossDomesticEur: number;
  mealDeductionDomesticEur: number;
  netDomesticEur: number;
  totalNetEur: number;
  warnings: LegalWarning[];
}

export function getForeignCountryByCode(
  code: string
): ForeignPerDiemCountry | undefined {
  return FOREIGN_PER_DIEM_COUNTRIES.find(
    (c) => c.code.toUpperCase() === code.trim().toUpperCase()
  );
}

export function formatCurrency(
  amount: number,
  currency: ForeignCurrency
): string {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function countSlotsFromHours(hours: number): {
  fullCount: number;
  halfCount: number;
} {
  if (hours < 8) {
    return { fullCount: 0, halfCount: 0 };
  }
  const fullDays = Math.floor(hours / 24);
  const remainder = round2(hours - fullDays * 24);
  if (remainder > 12) {
    return { fullCount: fullDays + 1, halfCount: 0 };
  }
  if (remainder >= 8) {
    return { fullCount: fullDays, halfCount: 1 };
  }
  return { fullCount: fullDays, halfCount: 0 };
}

/**
 * Izračun inozemne dnevnice prema hrvatskom Pravilniku o porezu na dohodak:
 * - > 12 sati = 100% dnevnice, 8 do 12 sati = 50% dnevnice, < 8 sati = 0%
 * - Pravilo prelaska granice: vrijeme u inozemstvu računa se od prelaska granice RH pri odlasku
 *   do prelaska granice RH pri povratku. Ako ukupni put traje >= 8h, a u inozemstvu je provedeno
 *   manje od ukupnog broja dnevnica (npr. < 8h u inozemstvu), ostatak do ukupnog prava
 *   obračunava se kao tuzemna dnevnica.
 * - Umanjenje za osiguranu prehranu: 1 obrok -30%, 2 obroka -60%.
 */
export function calculateForeignPerDiem(
  input: ForeignPerDiemInput
): ForeignPerDiemResult {
  const country =
    getForeignCountryByCode(input.countryCode) ?? FOREIGN_PER_DIEM_COUNTRIES[0];
  const exchangeRateToEur =
    input.customExchangeRateToEur && input.customExchangeRateToEur > 0
      ? input.customExchangeRateToEur
      : country.exchangeRateToEur;
  const domesticRate = input.domesticPerDiemEur ?? 30;

  const warnings: LegalWarning[] = [];

  const depMs = new Date(input.departureAt).getTime();
  const retMs = new Date(input.returnAt).getTime();
  const exitMs = input.borderExitAt
    ? new Date(input.borderExitAt).getTime()
    : depMs;
  const borderRetMs = input.borderReturnAt
    ? new Date(input.borderReturnAt).getTime()
    : retMs;

  const emptyResult = (warnList: LegalWarning[]): ForeignPerDiemResult => ({
    country,
    totalHours: 0,
    foreignHours: 0,
    domesticHours: 0,
    foreignFullCount: 0,
    foreignHalfCount: 0,
    domesticFullCount: 0,
    domesticHalfCount: 0,
    grossForeignAmount: 0,
    oneMealDeductionForeign: 0,
    twoMealsDeductionForeign: 0,
    netForeignAmount: 0,
    exchangeRateToEur,
    netForeignAmountEur: 0,
    grossDomesticEur: 0,
    mealDeductionDomesticEur: 0,
    netDomesticEur: 0,
    totalNetEur: 0,
    warnings: warnList,
  });

  if (
    Number.isNaN(depMs) ||
    Number.isNaN(retMs) ||
    Number.isNaN(exitMs) ||
    Number.isNaN(borderRetMs) ||
    retMs <= depMs
  ) {
    warnings.push({
      severity: "error",
      code: "INVALID_DATES",
      message: "Datum i vrijeme povratka moraju biti nakon polaska.",
    });
    return emptyResult(warnings);
  }

  if (exitMs < depMs || borderRetMs > retMs || borderRetMs < exitMs) {
    warnings.push({
      severity: "error",
      code: "INVALID_BORDER_TIMES",
      message:
        "Vrijeme prelaska granice mora biti unutar raspona od polaska iz RH do povratka u RH.",
    });
    return emptyResult(warnings);
  }

  const totalHours = round2((retMs - depMs) / (1000 * 60 * 60));
  const foreignHours = round2((borderRetMs - exitMs) / (1000 * 60 * 60));
  const domesticHours = round2(Math.max(0, totalHours - foreignHours));

  const totalSlots = countSlotsFromHours(totalHours);
  const foreignSlots = countSlotsFromHours(foreignHours);

  // Ukupno ostvarene polovice dnevnica (1 puna = 2 jedinice, 1 pola = 1 jedinica)
  const totalUnits = totalSlots.fullCount * 2 + totalSlots.halfCount;
  const foreignUnits = Math.min(
    totalUnits,
    foreignSlots.fullCount * 2 + foreignSlots.halfCount
  );
  const domesticUnits = Math.max(0, totalUnits - foreignUnits);

  const foreignFullCount = Math.floor(foreignUnits / 2);
  const foreignHalfCount = foreignUnits % 2;
  const domesticFullCount = Math.floor(domesticUnits / 2);
  const domesticHalfCount = domesticUnits % 2;

  if (foreignHours > 0 && foreignHours < 8 && totalHours >= 8) {
    warnings.push({
      severity: "info",
      code: "FOREIGN_UNDER_8H",
      message:
        "Boravak u inozemstvu kraći je od 8 sati pa se umjesto inozemne obračunava tuzemna dnevnica za ukupno trajanje puta.",
    });
  }

  const grossForeignAmount = round2(
    foreignFullCount * country.dailyRate +
      foreignHalfCount * (country.dailyRate * 0.5)
  );
  const grossDomesticEur = round2(
    domesticFullCount * domesticRate + domesticHalfCount * (domesticRate * 0.5)
  );

  // Pripremi pojedinačne dnevnice (prvo inozemne pune, pa inozemna pola, zatim tuzemne)
  // kako bi se umanjenja za obroke primijenila točno na ostvarene dnevnice.
  interface Slot {
    kind: "FOREIGN" | "DOMESTIC";
    amount: number;
  }
  const slots: Slot[] = [
    ...Array.from({ length: foreignFullCount }, () => ({
      kind: "FOREIGN" as const,
      amount: country.dailyRate,
    })),
    ...Array.from({ length: foreignHalfCount }, () => ({
      kind: "FOREIGN" as const,
      amount: round2(country.dailyRate * 0.5),
    })),
    ...Array.from({ length: domesticFullCount }, () => ({
      kind: "DOMESTIC" as const,
      amount: domesticRate,
    })),
    ...Array.from({ length: domesticHalfCount }, () => ({
      kind: "DOMESTIC" as const,
      amount: round2(domesticRate * 0.5),
    })),
  ];

  const safeTwo = Math.max(0, Math.floor(input.twoMealsDays || 0));
  const safeOne = Math.max(0, Math.floor(input.oneMealDays || 0));

  if (safeOne + safeTwo > slots.length && slots.length > 0) {
    warnings.push({
      severity: "warning",
      code: "MEALS_EXCEED_PER_DIEM",
      message: `Broj dana s osiguranim obrocima (${safeOne + safeTwo}) veći je od broja ostvarenih dnevnica (${slots.length}). Umanjenje je primijenjeno samo na ostvarene dnevnice.`,
    });
  }

  let oneMealDeductionForeign = 0;
  let twoMealsDeductionForeign = 0;
  let mealDeductionDomesticEur = 0;
  let idx = 0;

  for (let i = 0; i < safeTwo && idx < slots.length; i++, idx++) {
    const ded = slots[idx].amount * 0.6;
    if (slots[idx].kind === "FOREIGN") {
      twoMealsDeductionForeign += ded;
    } else {
      mealDeductionDomesticEur += ded;
    }
  }

  for (let i = 0; i < safeOne && idx < slots.length; i++, idx++) {
    const ded = slots[idx].amount * 0.3;
    if (slots[idx].kind === "FOREIGN") {
      oneMealDeductionForeign += ded;
    } else {
      mealDeductionDomesticEur += ded;
    }
  }

  oneMealDeductionForeign = round2(oneMealDeductionForeign);
  twoMealsDeductionForeign = round2(twoMealsDeductionForeign);
  mealDeductionDomesticEur = round2(mealDeductionDomesticEur);

  const netForeignAmount = round2(
    Math.max(
      0,
      grossForeignAmount - oneMealDeductionForeign - twoMealsDeductionForeign
    )
  );
  const netForeignAmountEur = round2(netForeignAmount * exchangeRateToEur);
  const netDomesticEur = round2(
    Math.max(0, grossDomesticEur - mealDeductionDomesticEur)
  );
  const totalNetEur = round2(netForeignAmountEur + netDomesticEur);

  return {
    country,
    totalHours,
    foreignHours,
    domesticHours,
    foreignFullCount,
    foreignHalfCount,
    domesticFullCount,
    domesticHalfCount,
    grossForeignAmount,
    oneMealDeductionForeign,
    twoMealsDeductionForeign,
    netForeignAmount,
    exchangeRateToEur,
    netForeignAmountEur,
    grossDomesticEur,
    mealDeductionDomesticEur,
    netDomesticEur,
    totalNetEur,
    warnings,
  };
}
