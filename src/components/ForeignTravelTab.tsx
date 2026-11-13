"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  Globe,
  Info,
  Printer,
  Search,
} from "lucide-react";
import { formatDateTimeHr, formatEur } from "@/lib/croatian-rules";
import {
  calculateForeignPerDiem,
  FOREIGN_PER_DIEM_COUNTRIES,
  formatCurrency,
  type ForeignPerDiemCountry,
} from "@/lib/foreign-per-diems";

interface ForeignTravelTabProps {
  companyName?: string;
  companyOib?: string;
  companyAddress?: string;
}

const REGION_LABELS: Record<ForeignPerDiemCountry["region"], string> = {
  EU: "EU",
  EUROPA_OSTALO: "Europa (ostalo)",
  SVIJET: "Svijet",
};

function defaultDateTimeLocal(daysOffset: number, hour: string): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hour}`;
}

export default function ForeignTravelTab({
  companyName = "Tvrtka d.o.o.",
  companyOib = "",
  companyAddress = "",
}: ForeignTravelTabProps) {
  // Calculator state
  const [countryCode, setCountryCode] = useState<string>("DE");
  const [employeeName, setEmployeeName] = useState<string>("");
  const [destinationCity, setDestinationCity] = useState<string>("München");
  const [purpose, setPurpose] = useState<string>(
    "Poslovni sastanak s inozemnim partnerom"
  );

  const [departureAt, setDepartureAt] = useState<string>(() =>
    defaultDateTimeLocal(0, "06:00")
  );
  const [borderExitAt, setBorderExitAt] = useState<string>(() =>
    defaultDateTimeLocal(0, "07:30")
  );
  const [borderReturnAt, setBorderReturnAt] = useState<string>(() =>
    defaultDateTimeLocal(1, "18:30")
  );
  const [returnAt, setReturnAt] = useState<string>(() =>
    defaultDateTimeLocal(1, "20:00")
  );

  const [oneMealDays, setOneMealDays] = useState<number>(0);
  const [twoMealsDays, setTwoMealsDays] = useState<number>(0);
  const [customRate, setCustomRate] = useState<string>("");

  // Searchable table state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");

  const selectedCountry = useMemo(
    () =>
      FOREIGN_PER_DIEM_COUNTRIES.find((c) => c.code === countryCode) ??
      FOREIGN_PER_DIEM_COUNTRIES[0],
    [countryCode]
  );

  const handleSelectCountry = (code: string) => {
    setCountryCode(code);
    setCustomRate("");
  };

  const parsedCustomRate = useMemo(() => {
    const num = Number(customRate.replace(",", "."));
    return Number.isFinite(num) && num > 0 ? num : undefined;
  }, [customRate]);

  const calc = useMemo(
    () =>
      calculateForeignPerDiem({
        countryCode,
        departureAt,
        borderExitAt,
        borderReturnAt,
        returnAt,
        oneMealDays,
        twoMealsDays,
        customExchangeRateToEur: parsedCustomRate,
      }),
    [
      countryCode,
      departureAt,
      borderExitAt,
      borderReturnAt,
      returnAt,
      oneMealDays,
      twoMealsDays,
      parsedCustomRate,
    ]
  );

  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FOREIGN_PER_DIEM_COUNTRIES.filter((c) => {
      if (regionFilter !== "ALL" && c.region !== regionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, regionFilter]);

  return (
    <div className="space-y-6">
      {/* Header (screen) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Inozemni putni nalozi i dnevnice
            </h2>
            <p className="text-sm text-slate-600">
              Službena Odluka Vlade RH o visini inozemnih dnevnica i kalkulator
              prema Pravilniku o porezu na dohodak (pravilo prelaska granice).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-sm font-medium transition cursor-pointer shrink-0"
        >
          <Printer className="w-4 h-4" />
          Ispiši obračun
        </button>
      </div>

      {/* Print-only formal header */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-4">
        <div className="flex justify-between items-start text-sm">
          <div>
            <div className="font-bold text-base">{companyName}</div>
            {companyAddress && <div>{companyAddress}</div>}
            {companyOib && <div>OIB: {companyOib}</div>}
          </div>
          <div className="text-right">
            <div className="font-bold text-base">
              OBRAČUN INOZEMNOG PUTNOG NALOGA
            </div>
            <div className="text-slate-600">
              Datum ispisa: {new Date().toLocaleDateString("hr-HR")}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm bg-slate-50 p-3 rounded border border-slate-300">
          <div>
            <span className="text-slate-500">Djelatnik:</span>{" "}
            <span className="font-medium">{employeeName || "—"}</span>
          </div>
          <div>
            <span className="text-slate-500">Država / Odredište:</span>{" "}
            <span className="font-medium">
              {calc.country.name}
              {destinationCity ? ` (${destinationCity})` : ""}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500">Svrha putovanja:</span>{" "}
            <span className="font-medium">{purpose || "—"}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Calculator Form + Live Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form (hidden when printing) */}
        <div className="no-print lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calculator className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">
              Kalkulator inozemne dnevnice
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Država odredišta
              </label>
              <select
                value={countryCode}
                onChange={(e) => handleSelectCountry(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {FOREIGN_PER_DIEM_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.dailyRate} {c.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Grad / odredište (za ispis)
              </label>
              <input
                type="text"
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
                placeholder="npr. München, Beč..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Djelatnik (za ispis)
              </label>
              <input
                type="text"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="Ime i prezime"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Svrha putovanja (za ispis)
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Konkretan opis svrhe puta"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Vremena putovanja i prelaska granice RH
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  1. Polazak iz RH (sjedište)
                </label>
                <input
                  type="datetime-local"
                  value={departureAt}
                  onChange={(e) => setDepartureAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  2. Prelazak granice (izlaz iz RH)
                </label>
                <input
                  type="datetime-local"
                  value={borderExitAt}
                  onChange={(e) => setBorderExitAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  3. Prelazak granice (povratak u RH)
                </label>
                <input
                  type="datetime-local"
                  value={borderReturnAt}
                  onChange={(e) => setBorderReturnAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  4. Povratak u RH (sjedište)
                </label>
                <input
                  type="datetime-local"
                  value={returnAt}
                  onChange={(e) => setReturnAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dani s 1 obrokom (-30%)
              </label>
              <input
                type="number"
                min={0}
                value={oneMealDays}
                onChange={(e) =>
                  setOneMealDays(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dani s 2 obroka (-60%)
              </label>
              <input
                type="number"
                min={0}
                value={twoMealsDays}
                onChange={(e) =>
                  setTwoMealsDays(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tečaj (1 {selectedCountry.currency} u EUR)
              </label>
              <input
                type="number"
                step="0.0001"
                min={0}
                disabled={selectedCountry.currency === "EUR"}
                value={
                  selectedCountry.currency === "EUR"
                    ? "1.0000"
                    : customRate || String(selectedCountry.exchangeRateToEur)
                }
                onChange={(e) => setCustomRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Calculation Breakdown Card (visible on screen AND in print) */}
        <div className="lg:col-span-5 print:col-span-12 bg-white rounded-xl border border-slate-200 p-5 shadow-sm print:shadow-none print:border-slate-300 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-semibold text-slate-900">
                Obračun dnevnica — {calc.country.name}
              </h3>
              <p className="text-xs text-slate-500">
                Službena dnevnica:{" "}
                {formatCurrency(calc.country.dailyRate, calc.country.currency)}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
              {calc.country.currency}
            </span>
          </div>

          {/* Warnings */}
          {calc.warnings.length > 0 && (
            <div className="space-y-2">
              {calc.warnings.map((w) => (
                <div
                  key={w.code}
                  className={`flex items-start gap-2 rounded-lg p-3 text-xs ${
                    w.severity === "error"
                      ? "bg-red-50 text-red-800 border border-red-200"
                      : w.severity === "warning"
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : "bg-sky-50 text-sky-800 border border-sky-200"
                  }`}
                >
                  {w.severity === "info" ? (
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Duration summary */}
          <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div>
              <div className="text-[11px] text-slate-500">Ukupno put</div>
              <div className="text-sm font-semibold text-slate-900">
                {calc.totalHours} h
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">U inozemstvu</div>
              <div className="text-sm font-semibold text-indigo-700">
                {calc.foreignHours} h
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">U tuzemstvu</div>
              <div className="text-sm font-semibold text-slate-900">
                {calc.domesticHours} h
              </div>
            </div>
          </div>

          {/* Print-only travel timestamps */}
          <div className="hidden print:grid grid-cols-2 gap-2 text-xs text-slate-700 border border-slate-200 rounded p-2.5">
            <div>Polazak iz RH: {formatDateTimeHr(departureAt)}</div>
            <div>Prelazak granice (izlaz): {formatDateTimeHr(borderExitAt)}</div>
            <div>
              Prelazak granice (povratak): {formatDateTimeHr(borderReturnAt)}
            </div>
            <div>Povratak u RH: {formatDateTimeHr(returnAt)}</div>
          </div>

          {/* Detailed breakdown lines */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-700">
              <span>
                Inozemne dnevnice ({calc.foreignFullCount} pune +{" "}
                {calc.foreignHalfCount} pola)
              </span>
              <span className="font-medium">
                {formatCurrency(calc.grossForeignAmount, calc.country.currency)}
              </span>
            </div>

            {calc.oneMealDeductionForeign > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>Umanjenje za 1 obrok (-30%)</span>
                <span>
                  −
                  {formatCurrency(
                    calc.oneMealDeductionForeign,
                    calc.country.currency
                  )}
                </span>
              </div>
            )}

            {calc.twoMealsDeductionForeign > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>Umanjenje za 2 obroka (-60%)</span>
                <span>
                  −
                  {formatCurrency(
                    calc.twoMealsDeductionForeign,
                    calc.country.currency
                  )}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-900 font-medium pt-1 border-t border-slate-100">
              <span>Neto inozemne dnevnice ({calc.country.currency})</span>
              <span>
                {formatCurrency(calc.netForeignAmount, calc.country.currency)}
              </span>
            </div>

            {calc.country.currency !== "EUR" && (
              <div className="flex justify-between text-slate-600 text-xs">
                <span>
                  Preračun u EUR (tečaj 1 {calc.country.currency} ={" "}
                  {calc.exchangeRateToEur} EUR)
                </span>
                <span className="font-medium text-slate-800">
                  {formatEur(calc.netForeignAmountEur)}
                </span>
              </div>
            )}

            {(calc.domesticFullCount > 0 || calc.domesticHalfCount > 0) && (
              <>
                <div className="flex justify-between text-slate-700 pt-2 border-t border-slate-100">
                  <span>
                    Tuzemne dnevnice ({calc.domesticFullCount} pune +{" "}
                    {calc.domesticHalfCount} pola)
                  </span>
                  <span className="font-medium">
                    {formatEur(calc.grossDomesticEur)}
                  </span>
                </div>
                {calc.mealDeductionDomesticEur > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Umanjenje tuzemnih dnevnica za obroke</span>
                    <span>−{formatEur(calc.mealDeductionDomesticEur)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Total */}
          <div className="rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between print:bg-slate-100 print:text-slate-900 print:border print:border-slate-400">
            <div>
              <div className="text-xs text-slate-300 print:text-slate-600">
                Ukupno dnevnica za isplatu (EUR)
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-500">
                &gt;12h = 100% | 8–12h = 50% | &lt;8h = 0%
              </div>
            </div>
            <div className="text-2xl font-bold">
              {formatEur(calc.totalNetEur)}
            </div>
          </div>

          {/* Print-only signature block */}
          <div className="hidden print:grid grid-cols-2 gap-12 pt-10 text-xs text-slate-600">
            <div className="border-t border-slate-400 pt-2 text-center">
              Potpis podnositelja putnog računa
            </div>
            <div className="border-t border-slate-400 pt-2 text-center">
              Odobrio (direktor / ovlaštena osoba)
            </div>
          </div>
        </div>
      </div>

      {/* Searchable Official Per Diem Table (hidden when printing) */}
      <div className="no-print bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">
              Tablica službenih inozemnih dnevnica ({filteredCountries.length}{" "}
              država)
            </h3>
            <p className="text-xs text-slate-500">
              Kliknite na državu za automatski odabir u kalkulatoru iznad.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pretraži državu ili valutu..."
                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-56"
              />
            </div>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">Sve regije</option>
              <option value="EU">Europska unija</option>
              <option value="EUROPA_OSTALO">Europa (ostalo)</option>
              <option value="SVIJET">Svijet</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Država</th>
                <th className="px-4 py-3 font-medium">Šifra</th>
                <th className="px-4 py-3 font-medium">Regija</th>
                <th className="px-4 py-3 font-medium text-right">
                  Puna dnevnica (&gt;12h)
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Pola dnevnice (8–12h)
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  Indikativni tečaj (EUR)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCountries.map((c) => {
                const isSelected = c.code === countryCode;
                return (
                  <tr
                    key={c.code}
                    onClick={() => handleSelectCountry(c.code)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? "bg-indigo-50/70 hover:bg-indigo-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {c.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">
                      {c.code}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">
                      {REGION_LABELS[c.region]}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                      {formatCurrency(c.dailyRate, c.currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {formatCurrency(c.dailyRate * 0.5, c.currency)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600 font-mono text-xs">
                      {c.currency === "EUR"
                        ? "1,0000"
                        : c.exchangeRateToEur.toFixed(4).replace(".", ",")}
                    </td>
                  </tr>
                );
              })}
              {filteredCountries.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Nema država koje odgovaraju pretrazi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
