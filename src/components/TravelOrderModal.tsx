"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Info,
  MapPin,
  Plus,
  Receipt,
  Trash2,
  Wallet,
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
import CroatiaRouteMap from "./CroatiaRouteMap";
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

function formatLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultDateTimeLocal(offsetHours = 0): string {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  const todayStr = formatLocalDate(new Date());
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

  const [step, setStep] = useState<1 | 2 | 3>(1);
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
  const [showMapPlanner, setShowMapPlanner] = useState(false);

  const handleApplyOptimalRoute = () => {
    if (!origin.trim() || !destination.trim()) {
      setRouteHint(
        "Unesite polazište i odredište za brzi izračun rute i cestarine."
      );
      return;
    }
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
      setStep(1);
      return;
    }
    if (!issueDate) {
      setErrorMsg("Unesite datum izdavanja naloga.");
      setStep(1);
      return;
    }
    if (!purpose.trim() || !origin.trim() || !destination.trim()) {
      setErrorMsg("Svrha putovanja, polazište i odredište su obavezni.");
      setStep(1);
      return;
    }
    if (!departureAt || !returnAt) {
      setErrorMsg("Datum i vrijeme polaska i povratka su obavezni.");
      setStep(1);
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

  const applySameDayPreset = (startHour: string, endHour: string) => {
    const baseDate = (departureAt && departureAt.slice(0, 10)) || todayStr;
    setDepartureAt(`${baseDate}T${startHour}`);
    setReturnAt(`${baseDate}T${endHour}`);
  };

  const applyTwoDayPreset = () => {
    const now = new Date();
    const today = formatLocalDate(now);
    const tomorrow = formatLocalDate(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    );
    setDepartureAt(`${today}T08:00`);
    setReturnAt(`${tomorrow}T18:00`);
  };

  const stepTabs: { id: 1 | 2 | 3; label: string; badge?: string }[] = [
    { id: 1, label: "1. Osnovni podaci i relacija" },
    { id: 2, label: "2. Prijevoz, dnevnice i akontacija" },
    {
      id: 3,
      label: "3. Računi i izvješće",
      badge: expenses.length > 0 ? String(expenses.length) : undefined,
    },
  ];

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none";
  const labelClass = "block text-xs font-medium text-slate-600 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                {order
                  ? `Uređivanje putnog naloga ${order.order_number}`
                  : "Novi putni nalog (Tuzemstvo)"}
              </h2>
              <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                {ORDER_STATUS_LABELS[status] || status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatski izračun dnevnica, kilometraže i provjera po Pravilniku o
              porezu na dohodak
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori modal"
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
        >
          {/* Left column: 3-Step Tabbed Workspace */}
          <div className="lg:col-span-8 lg:min-h-0 lg:overflow-y-auto flex flex-col bg-white">
            {/* Clickable 3-Step Tab Bar */}
            <div className="sticky top-0 z-10 shrink-0 px-6 pt-4 pb-3 border-b border-slate-100 bg-slate-50/50 backdrop-blur-xs flex flex-wrap gap-2">
              {stepTabs.map((tab) => {
                const isActive = step === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStep(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition border ${
                      isActive
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span
                        className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Step Body */}
            <div className="p-6 space-y-5 flex-1">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* STEP 1: Osnovni podaci i relacija */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Row 1 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Zaposlenik *</label>
                      <select
                        value={employeeId || ""}
                        onChange={(e) => setEmployeeId(Number(e.target.value))}
                        className={inputClass}
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
                      <label className={labelClass}>Datum izdavanja *</label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Status naloga</label>
                      <select
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as OrderStatus)
                        }
                        className={inputClass}
                      >
                        {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div>
                    <label className={labelClass}>Svrha putovanja *</label>
                    <input
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="npr. Sastanak s klijentom Dalmacija Projekt d.o.o. oko godišnjeg ugovora"
                      className={inputClass}
                    />
                  </div>

                  {/* Row 3: Route action bar */}
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        Relacija i planiranje rute
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowMapPlanner((prev) => !prev)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                            showMapPlanner
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800"
                          }`}
                        >
                          <Compass className="w-3.5 h-3.5" />
                          {showMapPlanner
                            ? "Sakrij planer karte"
                            : "Planer rute na karti (više lokacija)"}
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyOptimalRoute}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          Brzi izračun rute i cestarine
                        </button>
                      </div>
                    </div>

                    {showMapPlanner && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                        <CroatiaRouteMap
                          orders={[]}
                          readOnly={false}
                          initialOrigin={origin || "Zagreb"}
                          initialDestination={destination || "Split"}
                          mileageRateEur={settings.mileage_rate}
                          applyButtonLabel="Primijeni rutu i cestarinu"
                          onCreateOrderWithRoute={(
                            newOrigin,
                            newDest,
                            maxDistKm,
                            tollEur,
                            totalDrivenKm
                          ) => {
                            setOrigin(newOrigin);
                            setDestination(newDest);
                            setDistanceKm(maxDistKm);
                            if (odometerStart > 0 && totalDrivenKm) {
                              setOdometerEnd(odometerStart + totalDrivenKm);
                            }
                            const toll = round2(tollEur);
                            if (
                              toll > 0 &&
                              !expenses.some((e) => e.category === "CESTARINA")
                            ) {
                              setExpenses((prev) => [
                                ...prev,
                                {
                                  category: "CESTARINA",
                                  description: `Autocesta ${newOrigin} – ${newDest}`,
                                  receipt_number: "",
                                  expense_date:
                                    departureAt.slice(0, 10) || todayStr,
                                  amount_eur: toll,
                                },
                              ]);
                            }
                            setRouteHint(
                              `Ruta primijenjena s karte (${newOrigin} → ${newDest}): ukupno ${
                                totalDrivenKm || maxDistKm * 2
                              } km (najdalja točka ${maxDistKm} km), procjena cestarine ${formatEur(
                                toll
                              )}.`
                            );
                            setShowMapPlanner(false);
                          }}
                        />
                      </div>
                    )}

                    <datalist id="croatian-cities-list">
                      {CROATIAN_CITIES.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>

                    {/* Row 4: Origin, Destination, Distance */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Polazište *</label>
                        <input
                          type="text"
                          list="croatian-cities-list"
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                          placeholder="npr. Zagreb"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Odredište (ili više gradova s –) *
                        </label>
                        <input
                          type="text"
                          list="croatian-cities-list"
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          placeholder="npr. Split – Dubrovnik – Rijeka"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Udaljenost u jednom smjeru (km) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={distanceKm}
                          onChange={(e) =>
                            setDistanceKm(
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                    </div>

                    {routeHint && (
                      <div className="flex items-start gap-2 rounded-xl bg-blue-50/80 border border-blue-200 px-3.5 py-2.5 text-xs text-blue-800">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                        <span>{routeHint}</span>
                      </div>
                    )}
                  </div>

                  {/* Row 5: Times + Quick Presets */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Vrijeme polaska i povratka
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => applySameDayPreset("08:00", "18:00")}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition"
                        >
                          <Calendar className="w-3 h-3" />
                          Jednodnevni (08:00–18:00)
                        </button>
                        <button
                          type="button"
                          onClick={() => applySameDayPreset("07:00", "20:00")}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition"
                        >
                          <Calendar className="w-3 h-3" />
                          Cjelodnevni (07:00–20:00)
                        </button>
                        <button
                          type="button"
                          onClick={applyTwoDayPreset}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition"
                        >
                          <Calendar className="w-3 h-3" />
                          Dvodnevni put
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>
                          Datum i vrijeme polaska *
                        </label>
                        <input
                          type="datetime-local"
                          value={departureAt}
                          onChange={(e) => setDepartureAt(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Datum i vrijeme povratka *
                        </label>
                        <input
                          type="datetime-local"
                          value={returnAt}
                          onChange={(e) => setReturnAt(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Prijevoz, dnevnice i akontacija */}
              {step === 2 && (
                <div className="space-y-6">
                  {/* Transport & Vehicle */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-slate-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Prijevozno sredstvo i brojilo kilometara
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Vrsta prijevoza</label>
                        <select
                          value={transportType}
                          onChange={(e) =>
                            setTransportType(e.target.value as TransportType)
                          }
                          className={inputClass}
                        >
                          {Object.entries(TRANSPORT_TYPE_LABELS).map(
                            ([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div>
                        <label className={labelClass}>
                          Vozilo iz evidencije
                        </label>
                        <select
                          value={vehicleId}
                          onChange={(e) => handleVehicleChange(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">-- Odaberite vozilo --</option>
                          {activeVehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              [{v.ownership_type}] {v.make_model} (
                              {v.license_plate})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {transportType !== "JAVNI_PRIJEVOZ" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className={labelClass}>
                            Početno stanje brojila (km)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={odometerStart}
                            onChange={(e) =>
                              setOdometerStart(
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                            className={`${inputClass} font-mono`}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Završno stanje brojila (km)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={odometerEnd}
                            onChange={(e) =>
                              setOdometerEnd(
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                            className={`${inputClass} font-mono`}
                          />
                        </div>
                        <div>
                          <div className="inline-flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900">
                            <span className="text-xs font-medium text-slate-500">
                              Kilometraža
                            </span>
                            <span className="font-mono text-slate-900">
                              Prijeđeno: {calc.totalKm} km
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5 rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                        <span>
                          Za javni prijevoz stanje brojila vozila se ne
                          evidentira. Putne karte (vlak, autobus, avion) dodajte
                          kao priložene račune u sljedećem koraku.
                        </span>
                      </div>
                    )}
                  </section>

                  {/* Meals & Advance Payment */}
                  <section className="space-y-4 pt-5 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-slate-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Osigurani obroci i isplaćena akontacija
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>
                          Dani s 1 obrokom (-{settings.meal_deduction_one_pct}%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={oneMealDays}
                          onChange={(e) =>
                            setOneMealDays(
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Dani s 2 obroka (-{settings.meal_deduction_two_pct}%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={twoMealsDays}
                          onChange={(e) =>
                            setTwoMealsDays(
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Isplaćena akontacija (€)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={advancePayment}
                          onChange={(e) =>
                            setAdvancePayment(
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-600 leading-relaxed">
                      Prema Pravilniku o porezu na dohodak, ako je na službenom
                      putovanju osiguran jedan obrok (ručak ili večera),
                      neoporeziva dnevnica umanjuje se za{" "}
                      <span className="font-semibold text-slate-800">
                        {settings.meal_deduction_one_pct}%
                      </span>
                      , a za dva osigurana obroka za{" "}
                      <span className="font-semibold text-slate-800">
                        {settings.meal_deduction_two_pct}%
                      </span>
                      .
                    </div>
                  </section>
                </div>
              )}

              {/* STEP 3: Priloženi računi i izvješće */}
              {step === 3 && (
                <div className="space-y-6">
                  {/* Expenses */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Priloženi računi (cestarina, parking, smještaj...)
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={addExpenseRow}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Dodaj račun
                      </button>
                    </div>

                    {expenses.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center space-y-2">
                        <p className="text-xs text-slate-500">
                          Nema unesenih računa. Kliknite{" "}
                          <span className="font-semibold text-slate-700">
                            + Dodaj račun
                          </span>{" "}
                          ili upotrijebite izračun rute u 1. koraku za unos
                          cestarine.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {expenses.map((exp, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-12 gap-2.5 items-end bg-slate-50/80 p-3 rounded-2xl border border-slate-200"
                          >
                            <div className="col-span-12 sm:col-span-4">
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Kategorija
                              </label>
                              <select
                                value={exp.category}
                                onChange={(e) =>
                                  updateExpenseRow(
                                    idx,
                                    "category",
                                    e.target.value as ExpenseCategory
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                              >
                                {Object.entries(EXPENSE_CATEGORY_LABELS).map(
                                  ([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <div className="col-span-12 sm:col-span-8">
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Opis troška
                              </label>
                              <input
                                type="text"
                                placeholder="npr. Autocesta Zagreb – Split"
                                value={exp.description}
                                onChange={(e) =>
                                  updateExpenseRow(
                                    idx,
                                    "description",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                              />
                            </div>

                            <div className="col-span-6 sm:col-span-4">
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Broj računa
                              </label>
                              <input
                                type="text"
                                placeholder="Br. računa"
                                value={exp.receipt_number}
                                onChange={(e) =>
                                  updateExpenseRow(
                                    idx,
                                    "receipt_number",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                              />
                            </div>

                            <div className="col-span-6 sm:col-span-4">
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Datum računa
                              </label>
                              <input
                                type="date"
                                value={exp.expense_date}
                                onChange={(e) =>
                                  updateExpenseRow(
                                    idx,
                                    "expense_date",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                              />
                            </div>

                            <div className="col-span-10 sm:col-span-3">
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                Iznos (€)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder="0.00"
                                value={exp.amount_eur}
                                onChange={(e) =>
                                  updateExpenseRow(
                                    idx,
                                    "amount_eur",
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 text-right font-mono focus:border-slate-900 focus:outline-none"
                              />
                            </div>

                            <div className="col-span-2 sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removeExpenseRow(idx)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                                title="Ukloni trošak"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Trip report & Approver */}
                  <section className="space-y-4 pt-5 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Izvješće s puta i odobrenje
                      </h3>
                    </div>

                    <div>
                      <label className={labelClass}>
                        Kratko izvješće o obavljenom zadatku (potpisuje radnik)
                      </label>
                      <textarea
                        rows={3}
                        value={tripReport}
                        onChange={(e) => setTripReport(e.target.value)}
                        placeholder="Opis obavljenog posla na službenom putu..."
                        className={inputClass}
                      />
                    </div>

                    <div className="sm:w-1/2">
                      <label className={labelClass}>
                        Ovlaštena osoba (Odobrio)
                      </label>
                      <input
                        type="text"
                        value={approvedBy}
                        onChange={(e) => setApprovedBy(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </section>
                </div>
              )}
            </div>

            {/* Bottom Step Navigation Bar */}
            <div className="sticky bottom-0 z-10 shrink-0 px-6 py-3.5 border-t border-slate-100 bg-slate-50/90 backdrop-blur-xs flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={step === 1}
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Natrag
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-xs transition"
                >
                  Dalje
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="text-xs font-medium text-slate-500">
                  Provjerite obračun desno i spremite nalog
                </span>
              )}
            </div>
          </div>

          {/* Right column: Sticky Live Croatian Tax Receipt & Warnings */}
          <div className="lg:col-span-4 lg:min-h-0 bg-slate-50 lg:overflow-y-auto p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Obračun uživo — HR propisi
                </h3>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Uživo
                </span>
              </div>

              {/* Tax Receipt Card */}
              <div className="rounded-2xl bg-white border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
                {/* Per Diem Breakdown */}
                <div className="p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Trajanje puta</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {calc.perDiem.totalHours} h ({calc.perDiem.fullDaysCount}d{" "}
                      + {calc.perDiem.remainderHours}h)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Pravo na dnevnicu (≥ {settings.min_distance_km} km)
                    </span>
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
                    <span>Ostvarene dnevnice</span>
                    <span className="font-mono text-slate-900">
                      {calc.perDiem.rawFullCount} × {settings.per_diem_full}€ +{" "}
                      {calc.perDiem.rawHalfCount} × {settings.per_diem_half}€
                    </span>
                  </div>
                  {(calc.perDiem.oneMealDeductionEur > 0 ||
                    calc.perDiem.twoMealsDeductionEur > 0) && (
                    <div className="flex justify-between text-amber-700">
                      <span>Umanjenje za obroke</span>
                      <span className="font-mono">
                        -
                        {formatEur(
                          calc.perDiem.oneMealDeductionEur +
                            calc.perDiem.twoMealsDeductionEur
                        )}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between text-sm font-semibold text-slate-900">
                    <span>Dnevnice ukupno</span>
                    <span className="font-mono">
                      {formatEur(calc.perDiem.netPerDiemEur)}
                    </span>
                  </div>
                </div>

                {/* Mileage, Expenses & Totals */}
                <div className="p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Kilometraža ({calc.totalKm} km × {settings.mileage_rate}{" "}
                      €)
                    </span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatEur(calc.mileageTotalEur)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Ostali troškovi ({expenses.length})</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatEur(calc.expensesTotalEur)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between text-sm font-semibold text-slate-900">
                    <span>Ukupno</span>
                    <span className="font-mono">
                      {formatEur(calc.totalAmountEur)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Akontacija</span>
                    <span className="font-mono text-slate-700">
                      -{formatEur(advancePayment)}
                    </span>
                  </div>
                </div>

                {/* Highlighted Balance Due Box */}
                <div
                  className={`p-4 flex items-center justify-between ${
                    calc.balanceDueEur >= 0
                      ? "bg-emerald-950 text-white"
                      : "bg-slate-900 text-white"
                  }`}
                >
                  <div>
                    <div
                      className={`text-[11px] font-semibold uppercase tracking-wider ${
                        calc.balanceDueEur >= 0
                          ? "text-emerald-300"
                          : "text-amber-300"
                      }`}
                    >
                      {calc.balanceDueEur >= 0
                        ? "Za isplatu radniku"
                        : "Za povrat u blagajnu"}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      Neto razlika po obračunu
                    </div>
                  </div>
                  <span
                    className={`text-lg font-bold font-mono ${
                      calc.balanceDueEur >= 0
                        ? "text-emerald-300"
                        : "text-amber-300"
                    }`}
                  >
                    {formatEur(Math.abs(calc.balanceDueEur))}
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
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
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
