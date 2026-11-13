"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Car,
  CheckCircle2,
  Compass,
  Edit3,
  FileSpreadsheet,
  FileText,
  Globe,
  Navigation,
  Plus,
  Printer,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  formatDateHr,
  formatEur,
  ORDER_STATUS_LABELS,
  round2,
} from "@/lib/croatian-rules";
import { apiFetch } from "@/lib/demo-seed";
import type {
  CompanySettings,
  Employee,
  LocoTrip,
  TravelOrder,
  Vehicle,
} from "@/lib/types";
import AnalyticsTab from "./AnalyticsTab";
import CroatiaRouteMap from "./CroatiaRouteMap";
import ForeignTravelTab from "./ForeignTravelTab";
import JoppdTab from "./JoppdTab";
import LocoTab from "./LocoTab";
import MasterDataTab from "./MasterDataTab";
import PrintableTravelOrder from "./PrintableTravelOrder";
import TravelOrderModal, { type RoutePrefill } from "./TravelOrderModal";

type ActiveTab =
  | "ORDERS"
  | "FOREIGN"
  | "LOCO"
  | "JOPPD"
  | "ANALYTICS"
  | "MASTER";

interface PutniNaloziAppProps {
  initialSettings: CompanySettings;
  initialEmployees: Employee[];
  initialVehicles: Vehicle[];
  initialOrders: TravelOrder[];
  initialLocoTrips: LocoTrip[];
}

const STATUS_STYLE: Record<string, { badge: string; dot: string }> = {
  NACRT: {
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  },
  ODOBREN: {
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
  },
  OBRACUNAT: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  ISPLACEN: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
};

function getInitials(name?: string): string {
  if (!name) return "PN";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export default function PutniNaloziApp({
  initialSettings,
  initialEmployees,
  initialVehicles,
  initialOrders,
  initialLocoTrips,
}: PutniNaloziAppProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("ORDERS");

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  const [settings, setSettings] = useState<CompanySettings>(initialSettings);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [orders, setOrders] = useState<TravelOrder[]>(initialOrders);
  const [locoTrips, setLocoTrips] = useState<LocoTrip[]>(initialLocoTrips);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedMapOrderId, setSelectedMapOrderId] = useState<number | null>(
    initialOrders[0]?.id || null
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<TravelOrder | null>(null);
  const [routePrefill, setRoutePrefill] = useState<RoutePrefill | null>(null);
  const [printingOrder, setPrintingOrder] = useState<TravelOrder | null>(null);

  const refreshAll = useCallback(async () => {
    const [sRes, eRes, vRes, oRes, lRes] = await Promise.all([
      apiFetch("/api/settings"),
      apiFetch("/api/employees"),
      apiFetch("/api/vehicles"),
      apiFetch("/api/travel-orders"),
      apiFetch("/api/loco-trips"),
    ]);
    if (sRes.ok) setSettings(await sRes.json());
    if (eRes.ok) setEmployees(await eRes.json());
    if (vRes.ok) setVehicles(await vRes.json());
    if (oRes.ok) setOrders(await oRes.json());
    if (lRes.ok) setLocoTrips(await lRes.json());
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const openNewOrder = () => {
    setEditingOrder(null);
    setRoutePrefill(null);
    setModalOpen(true);
  };

  const openNewOrderWithRoute = (
    origin: string,
    destination: string,
    distanceKm: number,
    tollEur: number,
    totalDrivenKm?: number
  ) => {
    setEditingOrder(null);
    setRoutePrefill({
      origin,
      destination,
      distanceKm,
      tollEur,
      totalDrivenKm,
    });
    setModalOpen(true);
  };

  const openEditOrder = async (id: number) => {
    const res = await apiFetch(`/api/travel-orders/${id}`);
    if (res.ok) {
      const fullOrder = await res.json();
      setEditingOrder(fullOrder);
      setRoutePrefill(null);
      setModalOpen(true);
    }
  };

  const openPrintOrder = async (id: number) => {
    const res = await apiFetch(`/api/travel-orders/${id}`);
    if (res.ok) {
      const fullOrder = await res.json();
      setPrintingOrder(fullOrder);
    }
  };

  const handleDeleteOrder = async (id: number, orderNumber: string) => {
    if (!confirm(`Jeste li sigurni da želite obrisati nalog ${orderNumber}?`))
      return;
    const res = await apiFetch(`/api/travel-orders/${id}`, { method: "DELETE" });
    if (res.ok) refreshAll();
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.employee_name || "").toLowerCase().includes(q) ||
        o.destination.toLowerCase().includes(q) ||
        o.purpose.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, searchQuery]);

  const kpis = useMemo(() => {
    const totalPerDiem = round2(
      orders.reduce((s, o) => s + o.per_diem_total_eur, 0)
    );
    const totalMileage = round2(
      orders.reduce((s, o) => s + o.mileage_total_eur, 0)
    );
    const totalPayable = round2(
      orders.reduce((s, o) => s + o.total_amount_eur, 0)
    );
    const totalKm = round2(orders.reduce((s, o) => s + o.total_km, 0));
    return {
      count: orders.length,
      totalPerDiem,
      totalMileage,
      totalPayable,
      totalKm,
    };
  }, [orders]);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white border-r border-slate-800/80 shadow-xl z-30">
        {/* Brand */}
        <div className="px-6 py-6 flex items-center gap-3.5 border-b border-white/10">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">
                Putni Nalozi
              </span>
              <span className="rounded-md bg-blue-500/20 border border-blue-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                HR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Obračun po RH propisima
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Izbornik
          </div>

          <button
            type="button"
            onClick={() => switchTab("ORDERS")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "ORDERS"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <FileText className="w-4 h-4" />
              Putni nalozi i karta
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === "ORDERS"
                  ? "bg-white/20 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("LOCO")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "LOCO"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <Navigation className="w-4 h-4" />
              Loko vožnja
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === "LOCO"
                  ? "bg-white/20 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {locoTrips.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("FOREIGN")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "FOREIGN"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <Globe className="w-4 h-4" />
              Inozemni nalozi
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("JOPPD")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "JOPPD"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <FileSpreadsheet className="w-4 h-4" />
              JOPPD obrazac
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("ANALYTICS")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "ANALYTICS"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <BarChart3 className="w-4 h-4" />
              Analitika i izvoz
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("MASTER")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === "MASTER"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <Building2 className="w-4 h-4" />
              Tvrtka, radnici i vozila
            </span>
          </button>
        </nav>

        {/* Legal Rates Quick Card */}
        <div className="p-4 m-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            Pravilnik o porezu na dohodak
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/70 rounded-lg p-2">
              <div className="text-slate-400 text-[10px]">Dnevnica (&gt;12h)</div>
              <div className="font-mono font-bold text-white">
                {settings.per_diem_full.toFixed(2)} €
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-lg p-2">
              <div className="text-slate-400 text-[10px]">Pola (8–12h)</div>
              <div className="font-mono font-bold text-white">
                {settings.per_diem_half.toFixed(2)} €
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-lg p-2">
              <div className="text-slate-400 text-[10px]">Privatni auto</div>
              <div className="font-mono font-bold text-white">
                {settings.mileage_rate.toFixed(2)} €/km
              </div>
            </div>
            <div className="bg-slate-900/70 rounded-lg p-2">
              <div className="text-slate-400 text-[10px]">Min. prag</div>
              <div className="font-mono font-bold text-white">
                {settings.min_distance_km} km
              </div>
            </div>
          </div>
        </div>

        {/* Company Footer */}
        <div className="px-6 py-4 border-t border-white/10 text-xs">
          <div className="font-semibold text-white truncate">{settings.name}</div>
          <div className="text-slate-400 font-mono mt-0.5">
            OIB: {settings.oib}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="no-print lg:hidden bg-slate-900 text-white px-4 py-3 sticky top-0 z-30 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm">Putni Nalozi HR</div>
                <div className="text-[11px] text-slate-400">{settings.name}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={openNewOrder}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              Novi nalog
            </button>
          </div>
          <div className="flex gap-1 mt-3 pt-2 border-t border-white/10 overflow-x-auto">
            <button
              type="button"
              onClick={() => switchTab("ORDERS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeTab === "ORDERS"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300"
              }`}
            >
              Putni nalozi i karta ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => switchTab("LOCO")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeTab === "LOCO"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300"
              }`}
            >
              Loko vožnja ({locoTrips.length})
            </button>
            <button
              type="button"
              onClick={() => switchTab("FOREIGN")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeTab === "FOREIGN"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300"
              }`}
            >
              Inozemni nalozi
            </button>
            <button
              type="button"
              onClick={() => switchTab("JOPPD")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeTab === "JOPPD"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300"
              }`}
            >
              JOPPD obrazac
            </button>
            <button
              type="button"
              onClick={() => switchTab("ANALYTICS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeTab === "ANALYTICS"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300"
              }`}
            >
              Analitika i izvoz
            </button>
            <button
              type="button"
              onClick={() => switchTab("MASTER")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeTab === "MASTER"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300"
              }`}
            >
              Postavke i vozila
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-7 space-y-7">
          {activeTab === "ORDERS" && (
            <>
              {/* Hero Banner */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
                <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
                <div className="absolute right-24 -bottom-16 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-medium text-blue-200 backdrop-blur-sm">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Usklađeno s hrvatskim poreznim propisima
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                      Evidencija putnih naloga
                    </h1>
                    <p className="text-sm text-slate-300 max-w-xl">
                      Automatski obračun dnevnica, kilometraže privatnih vozila,
                      vizualizacija optimalne rute i službeni A4 PDF ispis za{" "}
                      <span className="font-semibold text-white">
                        {settings.name}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openNewOrder}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-slate-900 hover:bg-blue-50 px-5 py-3 text-sm font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.99] shrink-0"
                  >
                    <Plus className="w-4 h-4 text-blue-700" />
                    Novi putni nalog
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="group bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Putni nalozi
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
                    {kpis.count}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Ukupno evidentiranih naloga
                  </div>
                </div>

                <div className="group bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Dnevnice
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {formatEur(kpis.totalPerDiem)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Neoporezivi iznos dnevnica
                  </div>
                </div>

                <div className="group bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Kilometraža
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      <Route className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {formatEur(kpis.totalMileage)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Ukupno prijeđeno {kpis.totalKm.toLocaleString("hr-HR")} km
                  </div>
                </div>

                <div className="group bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Ukupni troškovi
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-blue-700 tabular-nums">
                    {formatEur(kpis.totalPayable)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Dnevnice + kilometraža + računi
                  </div>
                </div>
              </div>

              {/* Interactive Croatia Route Map & Driving Simulator */}
              <CroatiaRouteMap
                orders={orders}
                selectedOrderId={selectedMapOrderId}
                onSelectOrder={(o) => setSelectedMapOrderId(o.id)}
                onCreateOrderWithRoute={openNewOrderWithRoute}
                mileageRateEur={settings.mileage_rate}
              />

              {/* Filter & Search Bar */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pretraži po broju naloga, zaposleniku, gradu ili svrsi..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 py-2.5 text-sm focus:bg-white focus:border-blue-600 focus:outline-none transition"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-600 focus:outline-none transition"
                  >
                    <option value="ALL">Svi statusi</option>
                    {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="overflow-x-auto lg:overflow-x-visible">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-3 pl-4 pr-2">Nalog</th>
                        <th className="py-3 px-2">Zaposlenik</th>
                        <th className="py-3 px-2">Relacija i svrha</th>
                        <th className="py-3 px-2 hidden md:table-cell">Trajanje i prijevoz</th>
                        <th className="py-3 px-2 text-right">Iznos i status</th>
                        <th className="py-3 pl-2 pr-3 text-right">Akcije</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-14 text-center text-slate-400"
                          >
                            Nema putnih naloga za odabrani filter.
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((o) => {
                          const st = STATUS_STYLE[o.status] || STATUS_STYLE.NACRT;
                          const isMapSelected = o.id === selectedMapOrderId;
                          return (
                            <tr
                              key={o.id}
                              className={`transition-colors ${
                                isMapSelected
                                  ? "bg-blue-50/50"
                                  : "hover:bg-blue-50/25"
                              }`}
                            >
                              <td className="py-3 pl-4 pr-2 whitespace-nowrap align-top">
                                <span className="font-mono font-bold text-slate-900 text-xs">
                                  {o.order_number}
                                </span>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {formatDateHr(o.issue_date)}
                                </div>
                              </td>
                              <td className="py-3 px-2 align-top">
                                <div className="flex items-center gap-2">
                                  <div className="hidden xl:flex w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-800 font-bold text-[11px] items-center justify-center shrink-0">
                                    {getInitials(o.employee_name)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 text-xs truncate max-w-[125px]">
                                      {o.employee_name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate max-w-[125px]">
                                      {o.employee_job_title}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-2 min-w-0 align-top">
                                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 font-semibold text-slate-800 text-xs">
                                  <span>{o.origin}</span>
                                  <ArrowRight className="w-3 h-3 text-blue-500 shrink-0" />
                                  <span className="break-words">{o.destination}</span>
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-normal text-slate-600 shrink-0">
                                    {o.distance_km} km
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  {o.purpose}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-xs text-slate-600 hidden md:table-cell align-top whitespace-nowrap">
                                <div className="font-medium text-slate-800 text-[11px]">
                                  {formatDateHr(o.departure_at)}
                                  {o.return_at !== o.departure_at && (
                                    <span className="text-slate-400 font-normal">
                                      {" "}– {formatDateHr(o.return_at).replace(/\. \d{4}\.$/, ".")}
                                    </span>
                                  )}
                                </div>
                                <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                  <Car className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>
                                    {o.transport_type === "PRIVATNO_VOZILO"
                                      ? "Privatno"
                                      : o.transport_type === "SLUZBENO_VOZILO"
                                      ? "Službeno"
                                      : "Javni"}
                                  </span>
                                  {o.vehicle_license_plate && (
                                    <span className="font-mono text-slate-400">
                                      · {o.vehicle_license_plate}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right whitespace-nowrap align-top">
                                <div className="font-mono font-bold text-slate-900 tabular-nums text-xs">
                                  {formatEur(o.total_amount_eur)}
                                </div>
                                <div className="mt-0.5 flex items-center justify-end gap-1.5">
                                  {o.advance_payment_eur > 0 && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      Ispl: {formatEur(o.balance_due_eur)}
                                    </span>
                                  )}
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.badge}`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                                    />
                                    {ORDER_STATUS_LABELS[o.status] || o.status}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 pl-2 pr-3 text-right whitespace-nowrap align-top">
                                <div className="inline-flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMapOrderId(o.id)}
                                    className={`p-2 rounded-xl transition ${
                                      isMapSelected
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                    }`}
                                    title="Prikaži i animiraj rutu na karti"
                                  >
                                    <Compass className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openPrintOrder(o.id)}
                                    className="p-2 rounded-xl text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition"
                                    title="Službeni ispis / PDF"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditOrder(o.id)}
                                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                                    title="Uredi nalog i obračun"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteOrder(o.id, o.order_number)
                                    }
                                    className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                                    title="Obriši nalog"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === "LOCO" && (
            <LocoTab
              trips={locoTrips}
              employees={employees}
              vehicles={vehicles}
              settings={settings}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === "FOREIGN" && (
            <ForeignTravelTab
              companyName={settings.name}
              companyOib={settings.oib}
              companyAddress={settings.address}
            />
          )}

          {activeTab === "JOPPD" && (
            <JoppdTab
              orders={orders}
              locoTrips={locoTrips}
              employees={employees}
              settings={settings}
            />
          )}

          {activeTab === "ANALYTICS" && (
            <AnalyticsTab
              orders={orders}
              locoTrips={locoTrips}
              employees={employees}
              vehicles={vehicles}
            />
          )}

          {activeTab === "MASTER" && (
            <MasterDataTab
              settings={settings}
              employees={employees}
              vehicles={vehicles}
              onRefresh={refreshAll}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {modalOpen && (
        <TravelOrderModal
          order={editingOrder}
          routePrefill={routePrefill}
          settings={settings}
          employees={employees}
          vehicles={vehicles}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            refreshAll();
          }}
        />
      )}

      {printingOrder && (
        <PrintableTravelOrder
          order={printingOrder}
          settings={settings}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  );
}
