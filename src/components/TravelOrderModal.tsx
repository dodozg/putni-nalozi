"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Info,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  computeMultiStopRoute,
  CROATIAN_CITIES,
  parseRelationStops,
} from "@/lib/croatian-routes";
import {
  calculateTravelOrder,
  EXPENSE_CATEGORY_LABELS,
  formatEur,
  ORDER_STATUS_LABELS,
  round2,
  TRANSPORT_TYPE_LABELS,
} from "@/lib/croatian-rules";
import { apiFetch } from "@/lib/demo-seed";
import type {
  CompanySettings,
  Employee,
  ExpenseCategory,
  OrderStatus,
  TransportType,
  TravelExpense,
  TravelOrder,
  Vehicle,
} from "@/lib/types";

export interface RoutePrefill {
  origin: string;
  destination: string;
  distanceKm: number;
  tollEur: number;
  totalDrivenKm?: number;
}

interface TravelOrderModalProps {
  order: TravelOrder | null;
  routePrefill?: RoutePrefill | null;
  settings: CompanySettings;
  employees: Employee[];
  vehicles: Vehicle[];
  onClose: () => void;
  onSaved: () => void;
}

function defaultDateTimeLocal(offsetHours = 0): string {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function TravelOrderModal({
  order,
  routePrefill,
  settings,
  employees,
  vehicles,
  onClose,
  onSaved,
}: TravelOrderModalProps) {
  const activeEmployees = employees.filter(
    (e) => e.active === 1 || e.id === order?.employee_id
  );
  const activeVehicles = vehicles.filter(
    (v) => v.active === 1 || v.id === order?.vehicle_id
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultVehicle = activeVehicles[0];
  const initialOdoStart =
    order?.odometer_start ?? (defaultVehicle?.current_odometer || 0);
  const initialDist = order?.distance_km ?? (routePrefill?.distanceKm || 0);
  const initialOdoEnd =
    order?.odometer_end ??
    (routePrefill && initialOdoStart > 0
      ? initialOdoStart +
        (routePrefill.totalDrivenKm ?? routePrefill.distanceKm * 2)
      : 0);

  const [status, setStatus] = useState<OrderStatus>(order?.status || "NACRT");
  const [issueDate, setIssueDate] = useState(order?.issue_date || todayStr);
  const [employeeId, setEmployeeId] = useState<number>(
    order?.employee_id || activeEmployees[0]?.id || 0
  );
  const [purpose, setPurpose] = useState(order?.purpose || "");
  const [origin, setOrigin] = useState(
    order?.origin ||
      routePrefill?.origin ||
      settings.city.replace(/^\d+\s*/, "") ||
      "Zagreb"
  );
  const [destination, setDestination] = useState(
    order?.destination || routePrefill?.destination || ""
  );
  const [distanceKm, setDistanceKm] = useState<number>(initialDist);
  const [departureAt, setDepartureAt] = useState(
    order?.departure_at || defaultDateTimeLocal(1)
  );
  const [returnAt, setReturnAt] = useState(
    order?.return_at || defaultDateTimeLocal(15)
  );
  const [transportType, setTransportType] = useState<TransportType>(
    order?.transport_type || "PRIVATNO_VOZILO"
  );
  const [vehicleId, setVehicleId] = useState<number | "">(
    order?.vehicle_id ?? (defaultVehicle?.id || "")
  );
  const [odometerStart, setOdometerStart] = useState<number>(initialOdoStart);
  const [odometerEnd, setOdometerEnd] = useState<number>(initialOdoEnd);
  const [oneMealDays, setOneMealDays] = useState<number>(
    order?.one_meal_days || 0
  );
  const [twoMealsDays, setTwoMealsDays] = useState<number>(
    order?.two_meals_days || 0
  );
  const [advancePayment, setAdvancePayment] = useState<number>(
    order?.advance_payment_eur || 0
  );
  const [tripReport, setTripReport] = useState(order?.trip_report || "");
  const [approvedBy, setApprovedBy] = useState(
    order?.approved_by || settings.director_name
  );
  const [expenses, setExpenses] = useState<TravelExpense[]>(() => {
    if (order?.expenses) return order.expenses;
    if (routePrefill && routePrefill.tollEur > 0) {
      return [
        {
          category: "CESTARINA",
          description: `Autocesta ${routePrefill.origin} – ${routePrefill.destination} (povratno)`,
          receipt_number: "",
          expense_date: todayStr,
          amount_eur: routePrefill.tollEur,
        },
      ];
    }
    return [];
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [routeHint, setRouteHint] = useState<string>("");

  const handleApplyOptimalRoute = () => {
    if (!origin.trim() || !destination.trim()) return;
    const parsedStops = parseRelationStops(origin, destination);
    const isMulti = parsedStops.length > 2;
    const effectiveStops =
      !isMulti && parsedStops[0] !== parsedStops[1]
        ? [parsedStops[0], parsedStops[1], parsedStops[0]]
        : parsedStops;

    const tour = computeMultiStopRoute(effectiveStops);
    setOrigin(tour.stops[0].name);
    setDestination(
      isMulti
        ? tour.stops
            .slice(1)
            .map((s) => s.name)
            .join(" – ")
        : tour.stops[1].name
    );
    setDistanceKm(tour.maxDistanceFromOriginKm);
    if (odometerStart > 0) {
      setOdometerEnd(odometerStart + tour.totalDistanceKm);
    }
    const toll = round2(tour.totalTollEur);
    if (toll > 0 && !expenses.some((e) => e.category === "CESTARINA")) {
      setExpenses((prev) => [
        ...prev,
        {
          category: "CESTARINA",
          description: `Autocesta (${tour.highwaysUsed.join("/")}) ${tour.relationString}`,
          receipt_number: "",
          expense_date: departureAt.slice(0, 10) || todayStr,
          amount_eur: toll,
        },
      ]);
    }
    setRouteHint(
      `Ruta (${tour.legs.length} etape: ${tour.relationString}): ukupno ${tour.totalDistanceKm} km (najdalja točka ${tour.maxDistanceFromOriginKm} km), procjena cestarine ${formatEur(toll)}.`
    );
  };

  const handleVehicleChange = (val: string) => {
    const id = val ? Number(val) : "";
    setVehicleId(id);
    if (id) {
      const found = vehicles.find((v) => v.id === id);
      if (found && !order) {
        setOdometerStart(found.current_odometer);
        if (distanceKm > 0) {
          setOdometerEnd(found.current_odometer + distanceKm * 2);
        }
      }
      if (found) {
        setTransportType(
          found.ownership_type === "PRIVATNO"
            ? "PRIVATNO_VOZILO"
            : "SLUZBENO_VOZILO"
        );
      }
    }
  };

  const addExpenseRow = () => {
    setExpenses((prev) => [
      ...prev,
      {
        category: "CESTARINA",
        description: "",
        receipt_number: "",
        expense_date: departureAt.slice(0, 10) || todayStr,
        amount_eur: 0,
      },
    ]);
  };

  const updateExpenseRow = (
    idx: number,
    field: keyof TravelExpense,
    value: string | number
  ) => {
    setExpenses((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const removeExpenseRow = (idx: number) => {
    setExpenses((prev) => prev.filter((_, i) => i !== idx));
  };

  const calc = useMemo(
    () =>
      calculateTravelOrder(
        {
          issue_date: issueDate,
          purpose,
          distance_km: distanceKm,
          departure_at: departureAt,
          return_at: returnAt,
          transport_type: transportType,
          odometer_start: odometerStart,
          odometer_end: odometerEnd,
          one_meal_days: oneMealDays,
          two_meals_days: twoMealsDays,
          advance_payment_eur: advancePayment,
          expenses,
        },
        settings
      ),
    [
      issueDate,
      purpose,
      distanceKm,
      departureAt,
      returnAt,
      transportType,
      odometerStart,
      odometerEnd,
      oneMealDays,
      twoMealsDays,
      advancePayment,
      expenses,
      settings,
    ]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!employeeId) {
      setErrorMsg("Odaberite zaposlenika.");
      return;
    }
    if (!purpose.trim() || !origin.trim() || !destination.trim()) {
      setErrorMsg("Svrha putovanja, polazište i odredište su obavezni.");
      return;
    }

    setSaving(true);
    try {
      const url = order
        ? `/api/travel-orders/${order.id}`
        : "/api/travel-orders";
      const method = order ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          issue_date: issueDate,
          employee_id: employeeId,
          purpose,
          origin,
          destination,
          distance_km: distanceKm,
          departure_at: departureAt,
          return_at: returnAt,
          transport_type: transportType,
          vehicle_id: vehicleId || null,
          odometer_start: odometerStart,
          odometer_end: odometerEnd,
          one_meal_days: oneMealDays,
          two_meals_days: twoMealsDays,
          advance_payment_eur: advancePayment,
          trip_report: tripReport,
          approved_by: approvedBy,
          expenses,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Greška pri spremanju putnog naloga.");
        setSaving(false);
        return;
      }

      onSaved();
    } catch {
      setErrorMsg("Mrežna greška pri spremanju.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {order
                ? `Uređivanje putnog naloga ${order.order_number}`
                : "Novi putni nalog (Tuzemstvo)"}
            </h2>
            <p className="text-xs text-slate-500">
              Automatski izračun dnevnica, kilometraže i provjera po Pravilniku o
              porezu na dohodak
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
        >
          {/* Left 2 cols: Form inputs */}
          <div className="lg:col-span-2 p-6 space-y-6">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {errorMsg}
              </div>
            )}

            {/* Section 1: Osnovni podaci */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Osnovni podaci naloga
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Zaposlenik *
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    required
                  >
                    <option value="">-- Odaberite --</option>
                    {activeEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.job_title})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Datum izdavanja naloga *
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Status naloga
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OrderStatus)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Svrha putovanja *
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="npr. Sastanak s klijentom Dalmacija Projekt d.o.o. oko godišnjeg ugovora"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>
            </section>

            {/* Section 2: Relacija i vrijeme */}
            <section className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  2. Relacija i trajanje puta
                </h3>
                <button
                  type="button"
                  onClick={handleApplyOptimalRoute}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition"
                >
                  <Compass className="w-3.5 h-3.5" />
                  Izračunaj optimalnu rutu i cestarinu
                </button>
              </div>

              <datalist id="croatian-cities-list">
                {CROATIAN_CITIES.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Polazište *
                  </label>
                  <input
                    type="text"
                    list="croatian-cities-list"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Odredište (ili više gradova odvojenih crticom) *
                  </label>
                  <input
                    type="text"
                    list="croatian-cities-list"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="npr. Split – Dubrovnik – Rijeka – Slavonski Brod – Zagreb"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Udaljenost u jednom smjeru (km) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {routeHint && (
                <div className="rounded-xl bg-blue-50/80 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                  {routeHint}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Datum i vrijeme polaska *
                  </label>
                  <input
                    type="datetime-local"
                    value={departureAt}
                    onChange={(e) => setDepartureAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Datum i vrijeme povratka *
                  </label>
                  <input
                    type="datetime-local"
                    value={returnAt}
                    onChange={(e) => setReturnAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Prijevoz i brojilo */}
            <section className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                3. Prijevozno sredstvo i kilometraža
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vrsta prijevoza
                  </label>
                  <select
                    value={transportType}
                    onChange={(e) =>
                      setTransportType(e.target.value as TransportType)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {Object.entries(TRANSPORT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {transportType !== "JAVNI_PRIJEVOZ" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Vozilo iz evidencije
                    </label>
                    <select
                      value={vehicleId}
                      onChange={(e) => handleVehicleChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    >
                      <option value="">-- Odaberite vozilo --</option>
                      {activeVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          [{v.ownership_type}] {v.make_model} ({v.license_plate})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {transportType !== "JAVNI_PRIJEVOZ" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Početno stanje brojila (km)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={odometerStart}
                      onChange={(e) => setOdometerStart(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Završno stanje brojila (km)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={odometerEnd}
                      onChange={(e) => setOdometerEnd(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
                      Prijeđeno: {calc.totalKm} km
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Section 4: Umanjenje dnevnica i akontacija */}
            <section className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                4. Osigurani obroci i akontacija
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dnevnice s 1 obrokom (-{settings.meal_deduction_one_pct}%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={oneMealDays}
                    onChange={(e) => setOneMealDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Dnevnice s 2 obroka (-{settings.meal_deduction_two_pct}%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={twoMealsDays}
                    onChange={(e) => setTwoMealsDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Isplaćena akontacija (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={advancePayment}
                    onChange={(e) => setAdvancePayment(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Section 5: Putni troškovi (računi) */}
            <section className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  5. Priloženi računi (cestarina, parking, smještaj...)
                </h3>
                <button
                  type="button"
                  onClick={addExpenseRow}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Dodaj trošak
                </button>
              </div>

              {expenses.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Nema unesenih računa. Kliknite &ldquo;Dodaj trošak&rdquo; ili
                  &ldquo;Izračunaj optimalnu rutu&rdquo; za unos cestarine.
                </p>
              ) : (
                <div className="space-y-2">
                  {expenses.map((exp, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200"
                    >
                      <select
                        value={exp.category}
                        onChange={(e) =>
                          updateExpenseRow(
                            idx,
                            "category",
                            e.target.value as ExpenseCategory
                          )
                        }
                        className="col-span-12 sm:col-span-3 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                      >
                        {Object.entries(EXPENSE_CATEGORY_LABELS).map(
                          ([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          )
                        )}
                      </select>
                      <input
                        type="text"
                        placeholder="Opis troška"
                        value={exp.description}
                        onChange={(e) =>
                          updateExpenseRow(idx, "description", e.target.value)
                        }
                        className="col-span-12 sm:col-span-4 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Br. računa"
                        value={exp.receipt_number}
                        onChange={(e) =>
                          updateExpenseRow(idx, "receipt_number", e.target.value)
                        }
                        className="col-span-5 sm:col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="Iznos €"
                        value={exp.amount_eur}
                        onChange={(e) =>
                          updateExpenseRow(
                            idx,
                            "amount_eur",
                            Number(e.target.value)
                          )
                        }
                        className="col-span-5 sm:col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white text-right font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => removeExpenseRow(idx)}
                        className="col-span-2 sm:col-span-1 flex justify-center p-1.5 text-slate-400 hover:text-red-600"
                        title="Ukloni trošak"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 6: Izvješće s puta i odobravatelj */}
            <section className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                6. Izvješće s puta i odobrenje
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kratko izvješće o obavljenom zadatku (potpisuje radnik)
                </label>
                <textarea
                  rows={2}
                  value={tripReport}
                  onChange={(e) => setTripReport(e.target.value)}
                  placeholder="Opis obavljenog posla na službenom putu..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ovlaštena osoba (Odobrio)
                </label>
                <input
                  type="text"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className="w-full sm:w-1/2 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </section>
          </div>

          {/* Right col: Live Croatian Tax Calculation & Legal Warnings */}
          <div className="bg-slate-50 p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Obračun uživo (HR propisi)
              </h3>

              {/* Duration & Per Diem */}
              <div className="rounded-2xl bg-white p-4 border border-slate-200 space-y-2.5 text-sm shadow-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Trajanje puta:</span>
                  <span className="font-semibold text-slate-900">
                    {calc.perDiem.totalHours} h ({calc.perDiem.fullDaysCount} d +{" "}
                    {calc.perDiem.remainderHours} h)
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Pravo na dnevnicu (≥ {settings.min_distance_km} km):</span>
                  <span
                    className={`font-semibold ${
                      calc.perDiem.eligibleForPerDiem
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    {calc.perDiem.eligibleForPerDiem ? "Da" : "Ne"}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Ostvarene dnevnice:</span>
                  <span className="font-mono text-slate-900">
                    {calc.perDiem.rawFullCount}×{settings.per_diem_full}€ +{" "}
                    {calc.perDiem.rawHalfCount}×{settings.per_diem_half}€
                  </span>
                </div>
                {(calc.perDiem.oneMealDeductionEur > 0 ||
                  calc.perDiem.twoMealsDeductionEur > 0) && (
                  <div className="flex justify-between text-amber-700 text-xs">
                    <span>Umanjenje za obroke:</span>
                    <span className="font-mono">
                      -
                      {formatEur(
                        calc.perDiem.oneMealDeductionEur +
                          calc.perDiem.twoMealsDeductionEur
                      )}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100 flex justify-between font-semibold text-slate-900">
                  <span>Dnevnice ukupno:</span>
                  <span className="font-mono">
                    {formatEur(calc.perDiem.netPerDiemEur)}
                  </span>
                </div>
              </div>

              {/* Mileage & Expenses */}
              <div className="rounded-2xl bg-white p-4 border border-slate-200 space-y-2.5 text-sm shadow-xs">
                <div className="flex justify-between text-slate-600">
                  <span>
                    Kilometraža ({calc.totalKm} km × {settings.mileage_rate} €):
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatEur(calc.mileageTotalEur)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Priloženi računi ({expenses.length}):</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatEur(calc.expensesTotalEur)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Isplaćena akontacija:</span>
                  <span className="font-mono text-slate-700">
                    -{formatEur(advancePayment)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-base font-bold">
                  <span>
                    {calc.balanceDueEur >= 0
                      ? "Razlika za isplatu:"
                      : "Za povrat u blagajnu:"}
                  </span>
                  <span
                    className={`font-mono ${
                      calc.balanceDueEur >= 0
                        ? "text-blue-700"
                        : "text-amber-700"
                    }`}
                  >
                    {formatEur(Math.abs(calc.balanceDueEur))}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex justify-between">
                  <span>Ukupni trošak naloga:</span>
                  <span className="font-mono">
                    {formatEur(calc.totalAmountEur)}
                  </span>
                </div>
              </div>

              {/* Legal Compliance Warnings */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Provjera zakonske usklađenosti
                </h4>
                {calc.warnings.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>
                      Svi provjereni elementi u skladu su s Pravilnikom o porezu
                      na dohodak.
                    </span>
                  </div>
                ) : (
                  calc.warnings.map((w, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-2xl border p-3 text-xs ${
                        w.severity === "error"
                          ? "bg-red-50 border-red-200 text-red-800"
                          : w.severity === "warning"
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-blue-50 border-blue-200 text-blue-800"
                      }`}
                    >
                      {w.severity === "info" ? (
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <span>{w.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Odustani
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-sm font-semibold text-white shadow-sm transition"
              >
                {saving ? "Spremanje..." : "Spremi putni nalog"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
