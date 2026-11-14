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
  Database,
  Edit3,
  FileSpreadsheet,
  FileText,
  Globe,
  LogOut,
  Navigation,
  Plus,
  Printer,
  Route,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  formatDateHr,
  formatEur,
  ORDER_STATUS_LABELS,
  round2,
  TRANSPORT_TYPE_LABELS,
} from "@/lib/croatian-rules";
import { apiFetch } from "@/lib/demo-seed";
import {
  ALL_PERMISSIONS,
  type AuthSession,
  type Company,
  type CompanySettings,
  type Employee,
  type LocoTrip,
  type OrderStatus,
  type TravelOrder,
  type UserPermissions,
  type UserRole,
  type Vehicle,
} from "@/lib/types";
import AnalyticsTab from "./AnalyticsTab";
import BackupRestoreTab from "./BackupRestoreTab";
import CroatiaRouteMap from "./CroatiaRouteMap";
import ForeignTravelTab from "./ForeignTravelTab";
import JoppdTab from "./JoppdTab";
import LocoTab from "./LocoTab";
import LoginScreen from "./LoginScreen";
import MasterDataTab from "./MasterDataTab";
import PrintableTravelOrder from "./PrintableTravelOrder";
import TravelOrderModal from "./TravelOrderModal";
import UserCompanyAdminTab from "./UserCompanyAdminTab";

type ActiveTab =
  | "ORDERS"
  | "FOREIGN"
  | "LOCO"
  | "JOPPD"
  | "ANALYTICS"
  | "MASTER"
  | "ADMIN"
  | "BACKUP";

interface PutniNaloziAppProps {
  initialSettings: CompanySettings;
  initialEmployees: Employee[];
  initialVehicles: Vehicle[];
  initialOrders: TravelOrder[];
  initialLocoTrips: LocoTrip[];
}

interface NavItemConfig {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroupConfig {
  title: string;
  items: NavItemConfig[];
}

const TAB_META: Record<ActiveTab, { title: string; subtitle: string }> = {
  ORDERS: {
    title: "Putni nalozi",
    subtitle:
      "Evidencija službenih putovanja, obračun dnevnica, kilometraže i A4 ispis",
  },
  FOREIGN: {
    title: "Inozemni nalozi",
    subtitle:
      "Obračun službenih putovanja u inozemstvo prema propisanim državnim dnevnicama",
  },
  LOCO: {
    title: "Loko vožnja",
    subtitle:
      "Evidencija gradskih i lokalnih vožnji te obračun naknade po kilometru",
  },
  JOPPD: {
    title: "JOPPD obrazac",
    subtitle:
      "Pregled i priprema neoporezivih primitaka za izvještavanje Poreznoj upravi",
  },
  ANALYTICS: {
    title: "Analitika i izvoz",
    subtitle:
      "Pregled troškova po zaposlenicima, vozilima i izvoz evidencija",
  },
  MASTER: {
    title: "Tvrtka, radnici i vozila",
    subtitle:
      "Matični podaci društva, zaposlenici, vozni park i neoporezive stope",
  },
  ADMIN: {
    title: "Korisnici, tvrtke i ovlasti",
    subtitle:
      "Upravljanje korisničkim računima, tvrtkama i granularnim pravima pristupa",
  },
  BACKUP: {
    title: "Sigurnosna kopija (Backup & Restore)",
    subtitle:
      "Izrada sigurnosne kopije podataka tvrtke i vraćanje podataka iz JSON arhive",
  },
};

const ROLE_HEADER_LABELS: Record<UserRole, string> = {
  global_admin: "Globalni Admin",
  company_admin: "Administrator tvrtke",
  user: "Korisnik",
};

const ROLE_HEADER_BADGE: Record<UserRole, string> = {
  global_admin: "bg-purple-50 text-purple-700 border-purple-200",
  company_admin: "bg-blue-50 text-blue-700 border-blue-200",
  user: "bg-slate-100 text-slate-700 border-slate-200",
};

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
  const [authChecking, setAuthChecking] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);

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
    null
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<TravelOrder | null>(null);
  const [printingOrder, setPrintingOrder] = useState<TravelOrder | null>(null);

  // Effective permissions based on user role
  const effectivePermissions: UserPermissions = useMemo(() => {
    if (!session) return ALL_PERMISSIONS;
    if (
      session.user.role === "global_admin" ||
      session.user.role === "company_admin"
    ) {
      return ALL_PERMISSIONS;
    }
    return {
      ...ALL_PERMISSIONS,
      ...(session.user.permissions || {}),
    };
  }, [session]);

  const canAccessAdminTab =
    session?.user.role === "global_admin" ||
    session?.user.role === "company_admin";

  const refreshAll = useCallback(async () => {
    const [sRes, eRes, vRes, oRes, lRes, meRes] = await Promise.all([
      apiFetch("/api/settings"),
      apiFetch("/api/employees"),
      apiFetch("/api/vehicles"),
      apiFetch("/api/travel-orders"),
      apiFetch("/api/loco-trips"),
      apiFetch("/api/auth/me"),
    ]);
    if (sRes.ok) setSettings(await sRes.json());
    if (eRes.ok) setEmployees(await eRes.json());
    if (vRes.ok) setVehicles(await vRes.json());
    if (oRes.ok) setOrders(await oRes.json());
    if (lRes.ok) setLocoTrips(await lRes.json());
    if (meRes.ok) {
      const meData = (await meRes.json()) as AuthSession;
      setSession(meData);
      if (meData.companies) {
        setAllCompanies(meData.companies);
      } else if (meData.user.role === "global_admin") {
        const cRes = await apiFetch("/api/companies");
        if (cRes.ok) setAllCompanies(await cRes.json());
      }
    }
  }, []);

  // Initial auth check on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok && mounted) {
          const meData = (await res.json()) as AuthSession;
          setSession(meData);
          if (meData.companies) {
            setAllCompanies(meData.companies);
          } else if (meData.user.role === "global_admin") {
            const cRes = await apiFetch("/api/companies");
            if (cRes.ok) setAllCompanies(await cRes.json());
          }
          await refreshAll();
        }
      } finally {
        if (mounted) setAuthChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshAll]);

  const handleLoginSuccess = async (newSession: AuthSession) => {
    setSession(newSession);
    if (newSession.companies) {
      setAllCompanies(newSession.companies);
    } else if (newSession.user.role === "global_admin") {
      const cRes = await apiFetch("/api/companies");
      if (cRes.ok) setAllCompanies(await cRes.json());
    }
    setActiveTab("ORDERS");
    await refreshAll();
  };

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    setSelectedMapOrderId(null);
  };

  const handleSwitchCompany = async (companyId: number) => {
    const res = await apiFetch("/api/auth/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeCompanyId: companyId }),
    });
    if (res.ok) {
      const updatedSession = (await res.json()) as AuthSession;
      setSession(updatedSession);
      setSelectedMapOrderId(null);
      await refreshAll();
    }
  };

  const openNewOrder = () => {
    if (!effectivePermissions.canManageTravelOrders) return;
    setEditingOrder(null);
    setModalOpen(true);
  };

  const openEditOrder = async (id: number) => {
    if (!effectivePermissions.canManageTravelOrders) return;
    const res = await apiFetch(`/api/travel-orders/${id}`);
    if (res.ok) {
      const fullOrder = await res.json();
      setEditingOrder(fullOrder);
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

  const handleQuickStatusChange = async (
    order: TravelOrder,
    nextStatus: OrderStatus
  ) => {
    if (!effectivePermissions.canApproveTravelOrders) return;
    const res = await apiFetch(`/api/travel-orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      await refreshAll();
    }
  };

  const handleDeleteOrder = async (id: number, orderNumber: string) => {
    if (!effectivePermissions.canManageTravelOrders) return;
    if (!confirm(`Jeste li sigurni da želite obrisati nalog ${orderNumber}?`))
      return;
    const res = await apiFetch(`/api/travel-orders/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (selectedMapOrderId === id) {
        setSelectedMapOrderId(null);
      }
      refreshAll();
    }
  };

  const navGroups: NavGroupConfig[] = useMemo(() => {
    const groups: NavGroupConfig[] = [];

    const evidencijaItems: NavItemConfig[] = [
      {
        id: "ORDERS",
        label: "Putni nalozi",
        icon: FileText,
        badge: orders.length,
      },
      {
        id: "FOREIGN",
        label: "Inozemni nalozi",
        icon: Globe,
      },
    ];
    if (effectivePermissions.canManageLoco) {
      evidencijaItems.push({
        id: "LOCO",
        label: "Loko vožnja",
        icon: Navigation,
        badge: locoTrips.length,
      });
    }
    groups.push({
      title: "Evidencija i obračun",
      items: evidencijaItems,
    });

    const reportItems: NavItemConfig[] = [];
    if (effectivePermissions.canManageJoppd) {
      reportItems.push({
        id: "JOPPD",
        label: "JOPPD obrazac",
        icon: FileSpreadsheet,
      });
    }
    if (effectivePermissions.canViewAnalytics) {
      reportItems.push({
        id: "ANALYTICS",
        label: "Analitika i izvoz",
        icon: BarChart3,
      });
    }
    if (reportItems.length > 0) {
      groups.push({
        title: "Izvještaji i Porezna",
        items: reportItems,
      });
    }

    const adminItems: NavItemConfig[] = [];
    if (effectivePermissions.canManageMasterData) {
      adminItems.push({
        id: "MASTER",
        label: "Tvrtka, radnici i vozila",
        icon: Building2,
      });
    }
    if (canAccessAdminTab) {
      adminItems.push({
        id: "ADMIN",
        label:
          session?.user.role === "global_admin"
            ? "Tvrtke, korisnici i prava"
            : "Korisnici i ovlasti",
        icon: Shield,
      });
    }
    if (effectivePermissions.canBackupRestore) {
      adminItems.push({
        id: "BACKUP",
        label: "Sigurnosna kopija (Backup)",
        icon: Database,
      });
    }
    if (adminItems.length > 0) {
      groups.push({
        title: "Upravljanje i sustav",
        items: adminItems,
      });
    }

    return groups;
  }, [
    orders.length,
    locoTrips.length,
    effectivePermissions,
    canAccessAdminTab,
    session?.user.role,
  ]);

  const flatNavItems = useMemo(
    () => navGroups.flatMap((group) => group.items),
    [navGroups]
  );

  // Ensure activeTab is allowed for current user
  useEffect(() => {
    if (
      flatNavItems.length > 0 &&
      !flatNavItems.some((item) => item.id === activeTab)
    ) {
      setActiveTab("ORDERS");
    }
  }, [flatNavItems, activeTab]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(ORDER_STATUS_LABELS)) {
      counts[key] = 0;
    }
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.employee_name || "").toLowerCase().includes(q) ||
        o.origin.toLowerCase().includes(q) ||
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

  if (authChecking) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center animate-pulse">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div className="text-xs font-medium text-slate-400">
            Provjera prijave i učitavanje sustava Putni Nalozi...
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const activeMeta = TAB_META[activeTab];
  const isGlobalAdmin = session.user.role === "global_admin";

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden flex bg-slate-50 text-slate-900 ${
        printingOrder ? "no-print" : ""
      }`}
    >
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-950 text-slate-100 border-r border-slate-800/80 z-30">
        {/* Brand */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-500/20 shrink-0">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-white truncate">
              Putni Nalozi HR
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {settings.name}
            </p>
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-white/10 text-white ring-1 ring-white/15 shadow-xs"
                        : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-blue-400" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-mono font-medium tabular-nums shrink-0 ${
                          isActive
                            ? "bg-blue-500/25 text-blue-200 border border-blue-400/30"
                            : "bg-slate-900 text-slate-400 border border-slate-800"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Compact Pravilnik RH Rates Summary Card */}
        <div className="mx-3 mb-3 p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Pravilnik RH</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="bg-slate-900/80 border border-white/[0.05] rounded-lg px-2.5 py-1.5">
              <div className="text-slate-400 text-[10px]">Dnevnica (&gt;12h)</div>
              <div className="font-mono font-semibold text-white tabular-nums">
                {settings.per_diem_full.toFixed(2)} €
              </div>
            </div>
            <div className="bg-slate-900/80 border border-white/[0.05] rounded-lg px-2.5 py-1.5">
              <div className="text-slate-400 text-[10px]">Pola (8–12h)</div>
              <div className="font-mono font-semibold text-white tabular-nums">
                {settings.per_diem_half.toFixed(2)} €
              </div>
            </div>
            <div className="bg-slate-900/80 border border-white/[0.05] rounded-lg px-2.5 py-1.5">
              <div className="text-slate-400 text-[10px]">Kilometraža</div>
              <div className="font-mono font-semibold text-white tabular-nums">
                {settings.mileage_rate.toFixed(2)} €/km
              </div>
            </div>
            <div className="bg-slate-900/80 border border-white/[0.05] rounded-lg px-2.5 py-1.5">
              <div className="text-slate-400 text-[10px]">Min. prag</div>
              <div className="font-mono font-semibold text-white tabular-nums">
                {settings.min_distance_km} km
              </div>
            </div>
          </div>
        </div>

        {/* User & Company Footer */}
        <div className="px-4 py-3.5 border-t border-white/10 text-xs bg-slate-950/80 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-slate-100 truncate">
                {session.user.full_name}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {ROLE_HEADER_LABELS[session.user.role]}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Odjava iz sustava"
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Odjava</span>
            </button>
          </div>
          <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400 truncate">
            {settings.name} · OIB: {settings.oib}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="no-print lg:hidden bg-slate-950 text-slate-100 px-4 py-3 sticky top-0 z-30 border-b border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-white truncate">
                  {settings.name}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {session.user.full_name} ·{" "}
                  {ROLE_HEADER_LABELS[session.user.role]}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {effectivePermissions.canManageTravelOrders && (
                <button
                  type="button"
                  onClick={openNewOrder}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novi</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Odjava</span>
              </button>
            </div>
          </div>

          {isGlobalAdmin && allCompanies.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400 shrink-0">
                Aktivna tvrtka:
              </span>
              <select
                value={session.activeCompanyId}
                onChange={(e) => handleSwitchCompany(Number(e.target.value))}
                className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1 text-xs text-white"
              >
                {allCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (OIB: {c.oib})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-2 border-t border-white/10 overflow-x-auto pb-0.5">
            {flatNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                  {item.badge !== undefined ? ` (${item.badge})` : ""}
                </button>
              );
            })}
          </div>
        </header>

        {/* Sticky Top Header Bar (Desktop) */}
        <header className="no-print hidden lg:flex sticky top-0 z-20 items-center justify-between gap-4 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-8 py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-semibold tracking-tight text-slate-900 truncate">
                {activeMeta.title}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 whitespace-nowrap shrink-0">
                <ShieldCheck className="w-3 h-3" />
                Službene stope RH · Neoporezivo
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {activeMeta.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Active Company Switcher (for Global Admin) or Static Badge */}
            {isGlobalAdmin && allCompanies.length > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/60 px-3 py-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="text-purple-900 font-medium whitespace-nowrap">
                  Aktivna tvrtka:
                </span>
                <select
                  value={session.activeCompanyId}
                  onChange={(e) => handleSwitchCompany(Number(e.target.value))}
                  aria-label="Odabir aktivne tvrtke"
                  className="bg-white rounded-lg border border-purple-200 px-2 py-0.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {allCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 max-w-[220px]"
                title={`${settings.name} (OIB: ${settings.oib})`}
              >
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{settings.name}</span>
              </div>
            )}

            {/* Logged-in User & Role Badge */}
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs">
              <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                {session.user.full_name}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  ROLE_HEADER_BADGE[session.user.role]
                }`}
              >
                <UserCheck className="w-3 h-3" />
                {ROLE_HEADER_LABELS[session.user.role]}
              </span>
            </div>

            {effectivePermissions.canManageTravelOrders && (
              <button
                type="button"
                onClick={openNewOrder}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novi putni nalog</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              title="Odjava iz sustava"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-slate-700 px-3 py-2 text-xs font-medium transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Odjava</span>
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 min-w-0">
          {/* Mobile Tab Title Strip */}
          <div className="lg:hidden flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                {activeMeta.title}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                Službene stope RH · Neoporezivo
              </span>
            </div>
            <p className="text-xs text-slate-500">{activeMeta.subtitle}</p>
          </div>

          {activeTab === "ORDERS" && (
            <>
              {/* 4 Sleek KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      Putni nalozi
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                    {kpis.count}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Ukupno evidentiranih naloga ({settings.name})
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      Prijeđeno km
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Route className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5 text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
                    {kpis.totalKm.toLocaleString("hr-HR")} km
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Ukupna službena kilometraža
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      Dnevnice i km naknade
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5 text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
                    {formatEur(kpis.totalPerDiem + kpis.totalMileage)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 truncate">
                    Dnevnice {formatEur(kpis.totalPerDiem)} · Km{" "}
                    {formatEur(kpis.totalMileage)}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      Ukupno obračunato
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5 text-2xl font-semibold tracking-tight font-mono text-blue-700 tabular-nums">
                    {formatEur(kpis.totalPayable)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Dnevnice + kilometraža + računi
                  </div>
                </div>
              </div>

              {/* Unified Toolbar */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                {/* Segmented Status Filter Pills */}
                <div className="flex flex-wrap items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setStatusFilter("ALL")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                      statusFilter === "ALL"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Svi</span>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        statusFilter === "ALL"
                          ? "text-blue-600 font-semibold"
                          : "text-slate-400"
                      }`}
                    >
                      ({orders.length})
                    </span>
                  </button>

                  {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => {
                    const isSelected = statusFilter === key;
                    const count = statusCounts[key] ?? 0;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(key)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-white text-slate-900 shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <span>{label}</span>
                        <span
                          className={`font-mono text-[11px] tabular-nums ${
                            isSelected
                              ? "text-blue-600 font-semibold"
                              : "text-slate-400"
                          }`}
                        >
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Input */}
                <div className="relative w-full xl:w-80 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pretraži po broju naloga, radniku, gradu ili svrsi..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                      aria-label="Očisti pretragu"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Order List */}
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs py-14 px-6 text-center space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-slate-700">
                    Nema putnih naloga za odabrani filter.
                  </div>
                  <p className="text-xs text-slate-400">
                    Promijenite status filter ili pojam pretrage, ili kreirajte
                    novi putni nalog.
                  </p>
                  {(statusFilter !== "ALL" || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("ALL");
                        setSearchQuery("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition cursor-pointer"
                    >
                      Poništi filtere
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((o) => {
                    const st = STATUS_STYLE[o.status] || STATUS_STYLE.NACRT;
                    const isExpanded = o.id === selectedMapOrderId;
                    const transportLabel =
                      TRANSPORT_TYPE_LABELS[o.transport_type] ||
                      o.transport_type;

                    return (
                      <div
                        key={o.id}
                        className={`rounded-2xl border bg-white p-4 sm:p-5 shadow-xs transition-all ${
                          isExpanded
                            ? "border-blue-400 ring-1 ring-blue-100"
                            : "border-slate-200/80 hover:border-slate-300"
                        }`}
                      >
                        {/* Summary Header Row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                            <span className="font-mono font-bold text-slate-900 text-sm sm:text-[15px] tracking-tight">
                              {o.order_number}
                            </span>

                            {effectivePermissions.canApproveTravelOrders ? (
                              <select
                                value={o.status}
                                onChange={(e) =>
                                  handleQuickStatusChange(
                                    o,
                                    e.target.value as OrderStatus
                                  )
                                }
                                title="Promijeni status naloga"
                                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer ${st.badge}`}
                              >
                                {Object.entries(ORDER_STATUS_LABELS).map(
                                  ([k, label]) => (
                                    <option key={k} value={k}>
                                      {label}
                                    </option>
                                  )
                                )}
                              </select>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.badge}`}
                                title="Nemate ovlasti za odobravanje statusa"
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                                />
                                {ORDER_STATUS_LABELS[o.status] || o.status}
                              </span>
                            )}

                            <span className="text-xs text-slate-500">
                              Izdano {formatDateHr(o.issue_date)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 ml-auto">
                            <div className="text-right">
                              <div className="font-mono font-semibold text-slate-900 text-sm sm:text-base tabular-nums">
                                {formatEur(o.total_amount_eur)}
                              </div>
                              {o.advance_payment_eur > 0 && (
                                <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                                  Za isplatu: {formatEur(o.balance_due_eur)}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1 pl-2 sm:pl-3 border-l border-slate-200/80">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedMapOrderId((prev) =>
                                    prev === o.id ? null : o.id
                                  )
                                }
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                                  isExpanded
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-blue-700 bg-blue-50/90 hover:bg-blue-100"
                                }`}
                              >
                                <Compass className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {isExpanded ? "Zatvori" : "Detalji i karta"}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openPrintOrder(o.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                                title="Ispis / PDF"
                              >
                                <Printer className="w-3.5 h-3.5 shrink-0" />
                                <span className="hidden sm:inline">
                                  Ispis / PDF
                                </span>
                              </button>

                              {effectivePermissions.canManageTravelOrders && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditOrder(o.id)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                                    title="Uredi"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 shrink-0" />
                                    <span className="hidden sm:inline">
                                      Uredi
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteOrder(o.id, o.order_number)
                                    }
                                    className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                                    title="Obriši"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                    <span className="hidden md:inline">
                                      Obriši
                                    </span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Summary 3-Column Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3.5 text-xs sm:text-sm">
                          {/* Col 1: Zaposlenik */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0">
                              {getInitials(o.employee_name)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] font-medium text-slate-400">
                                Zaposlenik
                              </div>
                              <div className="font-semibold text-slate-900 truncate">
                                {o.employee_name}
                              </div>
                              <div className="text-xs text-slate-500 truncate">
                                {o.employee_job_title}
                              </div>
                            </div>
                          </div>

                          {/* Col 2: Relacija i svrha */}
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-slate-400 mb-0.5">
                              Relacija i svrha
                            </div>
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold text-slate-800">
                              <span className="break-words">{o.origin}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="break-words">
                                {o.destination}
                              </span>
                              <span className="rounded-md bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-600 shrink-0">
                                {o.distance_km} km
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {o.purpose}
                            </div>
                          </div>

                          {/* Col 3: Trajanje i prijevoz */}
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-slate-400 mb-0.5">
                              Trajanje i prijevoz
                            </div>
                            <div className="font-medium text-slate-800">
                              {formatDateHr(o.departure_at)} –{" "}
                              {formatDateHr(o.return_at)}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                              <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{transportLabel}</span>
                              {o.vehicle_license_plate && (
                                <span className="font-mono text-slate-500 shrink-0">
                                  · {o.vehicle_license_plate}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Read-Only Order Inspector */}
                        {isExpanded && (
                          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-4 pt-4 border-t border-slate-100">
                            <div className="xl:col-span-7 min-w-0">
                              <CroatiaRouteMap
                                orders={[o]}
                                selectedOrderId={o.id}
                                mileageRateEur={settings.mileage_rate}
                                readOnly
                              />
                            </div>

                            <div className="xl:col-span-5 min-w-0 rounded-2xl bg-slate-50/80 border border-slate-200/80 p-4 flex flex-col justify-between space-y-4">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-slate-900">
                                    Specifikacija obračuna
                                  </h3>
                                  <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-500">
                                    {o.order_number}
                                  </span>
                                </div>

                                <dl className="space-y-2 text-xs">
                                  <div className="flex items-start justify-between gap-3">
                                    <dt className="text-slate-500 shrink-0">
                                      Relacija
                                    </dt>
                                    <dd className="font-medium text-slate-900 text-right break-words">
                                      {o.origin} → {o.destination} (
                                      {o.distance_km} km)
                                    </dd>
                                  </div>
                                  <div className="flex items-start justify-between gap-3">
                                    <dt className="text-slate-500 shrink-0">
                                      Vrijeme polaska/povratka
                                    </dt>
                                    <dd className="font-medium text-slate-900 text-right tabular-nums">
                                      {formatDateHr(o.departure_at)} –{" "}
                                      {formatDateHr(o.return_at)}
                                    </dd>
                                  </div>
                                  <div className="flex items-start justify-between gap-3">
                                    <dt className="text-slate-500 shrink-0">
                                      Svrha puta
                                    </dt>
                                    <dd className="font-medium text-slate-800 text-right break-words">
                                      {o.purpose}
                                    </dd>
                                  </div>
                                  <div className="flex items-start justify-between gap-3">
                                    <dt className="text-slate-500 shrink-0">
                                      Prijevoz i brojilo
                                    </dt>
                                    <dd className="font-medium text-slate-900 text-right">
                                      <div>
                                        {transportLabel}
                                        {o.vehicle_license_plate
                                          ? ` · ${o.vehicle_license_plate}`
                                          : ""}
                                      </div>
                                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                                        {o.odometer_start} → {o.odometer_end} km
                                        · Ukupno {o.total_km} km
                                      </div>
                                    </dd>
                                  </div>
                                </dl>

                                {/* Financial Breakdown Card */}
                                <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 space-y-2 text-xs">
                                  <div className="flex items-center justify-between gap-2 text-slate-600">
                                    <span>Dnevnice ukupno</span>
                                    <span className="font-mono font-medium text-slate-900 tabular-nums">
                                      {formatEur(o.per_diem_total_eur)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 text-slate-600">
                                    <span>Naknada za kilometražu</span>
                                    <span className="font-mono font-medium text-slate-900 tabular-nums">
                                      {formatEur(o.mileage_total_eur)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 text-slate-600">
                                    <span>Priloženi računi</span>
                                    <span className="font-mono font-medium text-slate-900 tabular-nums">
                                      {formatEur(o.expenses_total_eur)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 font-semibold text-slate-900">
                                    <span>Ukupno obračunato</span>
                                    <span className="font-mono tabular-nums">
                                      {formatEur(o.total_amount_eur)}
                                    </span>
                                  </div>
                                  {o.advance_payment_eur > 0 && (
                                    <div className="flex items-center justify-between gap-2 text-slate-500">
                                      <span>Primljena akontacija</span>
                                      <span className="font-mono tabular-nums">
                                        -{formatEur(o.advance_payment_eur)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="font-bold text-emerald-700 text-sm pt-2 border-t border-slate-100 flex justify-between items-center gap-2">
                                    <span>Za isplatu radniku</span>
                                    <span className="font-mono tabular-nums">
                                      {formatEur(o.balance_due_eur)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Quick Footer Actions */}
                              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
                                {effectivePermissions.canManageTravelOrders && (
                                  <button
                                    type="button"
                                    onClick={() => openEditOrder(o.id)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 px-3 py-2 text-xs font-semibold transition cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Uredi obračun i rutu</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openPrintOrder(o.id)}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 text-xs font-semibold transition cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>A4 PDF ispis</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === "LOCO" && effectivePermissions.canManageLoco && (
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

          {activeTab === "JOPPD" && effectivePermissions.canManageJoppd && (
            <JoppdTab
              orders={orders}
              locoTrips={locoTrips}
              employees={employees}
              settings={settings}
            />
          )}

          {activeTab === "ANALYTICS" &&
            effectivePermissions.canViewAnalytics && (
              <AnalyticsTab
                orders={orders}
                locoTrips={locoTrips}
                employees={employees}
                vehicles={vehicles}
              />
            )}

          {activeTab === "MASTER" &&
            effectivePermissions.canManageMasterData && (
              <MasterDataTab
                settings={settings}
                employees={employees}
                vehicles={vehicles}
                onRefresh={refreshAll}
              />
            )}

          {activeTab === "ADMIN" && canAccessAdminTab && (
            <UserCompanyAdminTab
              session={session}
              onSwitchCompany={handleSwitchCompany}
              onRefreshData={refreshAll}
            />
          )}

          {activeTab === "BACKUP" &&
            effectivePermissions.canBackupRestore && (
              <BackupRestoreTab
                session={session}
                employees={employees}
                vehicles={vehicles}
                orders={orders}
                locoTrips={locoTrips}
                onRefresh={refreshAll}
              />
            )}
        </main>
      </div>

      {/* Modals */}
      {modalOpen && (
        <TravelOrderModal
          order={editingOrder}
          routePrefill={null}
          settings={settings}
          employees={employees}
          vehicles={vehicles}
          canApprove={effectivePermissions.canApproveTravelOrders}
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
