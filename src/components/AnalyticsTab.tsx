"use client";

import React, { useMemo } from "react";
import {
  BarChart3,
  Briefcase,
  Car,
  Download,
  FileSpreadsheet,
  PieChart,
  Route,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { formatEur, round2 } from "@/lib/croatian-rules";
import { computeAnalyticsSummary, exportOrdersToCsv } from "@/lib/export-csv";
import type { Employee, LocoTrip, TravelOrder, Vehicle } from "@/lib/types";

interface AnalyticsTabProps {
  orders: TravelOrder[];
  locoTrips: LocoTrip[];
  employees: Employee[];
  vehicles: Vehicle[];
}

function formatKm(km: number): string {
  return new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(round2(km));
}

export default function AnalyticsTab({
  orders,
  locoTrips,
  employees,
  vehicles,
}: AnalyticsTabProps) {
  const summary = useMemo(
    () => computeAnalyticsSummary(orders, locoTrips, employees, vehicles),
    [orders, locoTrips, employees, vehicles]
  );

  const maxMonthlyTotal = useMemo(() => {
    return Math.max(
      ...summary.monthlyStats.map((m) => m.totalEur),
      1
    );
  }, [summary.monthlyStats]);

  const handleDownloadCsv = () => {
    if (orders.length === 0) return;
    const csvContent = exportOrdersToCsv(orders);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "putni_nalozi_izvoz.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const { kpis, costStructure, monthlyStats, employeeStats, vehicleStats } =
    summary;

  return (
    <div className="space-y-6">
      {/* Header & CSV Export Action */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Analitika i izvještaji
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Pregled troškova putnih naloga i loko vožnji po mjesecima,
            zaposlenicima i vozilima.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadCsv}
          disabled={orders.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Preuzmi Excel CSV</span>
          <Download className="h-3.5 w-3.5 opacity-80" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Putni nalozi + Loko
            </span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {kpis.totalTripsCount}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {kpis.totalOrdersCount} putnih naloga · {kpis.totalLocoCount} loko
            vožnji
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Ukupno prijeđenih km
            </span>
            <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
              <Route className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {formatKm(kpis.totalKm)} km
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatKm(kpis.ordersKm)} km nalozi · {formatKm(kpis.locoKm)} km
            loko
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Prosječan trošak po nalogu
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {formatEur(kpis.averageOrderCostEur)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Na temelju {kpis.totalOrdersCount}{" "}
            {kpis.totalOrdersCount === 1 ? "naloga" : "naloga"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Ukupni troškovi
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {formatEur(kpis.totalCombinedAmountEur)}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Nalozi {formatEur(kpis.totalOrdersAmountEur)} · Loko{" "}
            {formatEur(kpis.totalLocoAmountEur)}
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly Costs Bar Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Troškovi po mjesecima
              </h3>
              <p className="text-xs text-slate-500">
                Mjesečni pregled dnevnica, kilometraže i ostalih računa
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />
                Dnevnice
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Kilometraža
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                Računi
              </span>
            </div>
          </div>

          {monthlyStats.length === 0 ? (
            <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
              Nema evidentiranih troškova za prikaz po mjesecima.
            </div>
          ) : (
            <div className="mt-2">
              <div className="flex h-56 items-end gap-3 overflow-x-auto pb-2 pt-6">
                {monthlyStats.map((m) => {
                  const totalHeightPct = Math.max(
                    (m.totalEur / maxMonthlyTotal) * 100,
                    m.totalEur > 0 ? 4 : 0
                  );
                  const perDiemRatio =
                    m.totalEur > 0 ? (m.perDiemEur / m.totalEur) * 100 : 0;
                  const mileageRatio =
                    m.totalEur > 0 ? (m.mileageEur / m.totalEur) * 100 : 0;
                  const expensesRatio =
                    m.totalEur > 0 ? (m.expensesEur / m.totalEur) * 100 : 0;

                  return (
                    <div
                      key={m.monthKey}
                      className="group flex min-w-[56px] flex-1 flex-col items-center gap-2"
                    >
                      <div className="relative flex h-44 w-full max-w-[44px] flex-col justify-end">
                        <div className="mb-1 text-center text-[11px] font-medium text-slate-600 opacity-90">
                          {formatEur(m.totalEur)}
                        </div>
                        <div
                          className="flex w-full flex-col-reverse overflow-hidden rounded-t-lg bg-slate-100 transition-all duration-300 group-hover:brightness-95"
                          style={{ height: `${totalHeightPct}%` }}
                          title={`${m.monthLabel}: ${formatEur(m.totalEur)} (${m.ordersCount} naloga, ${m.locoCount} loko)`}
                        >
                          {m.perDiemEur > 0 && (
                            <div
                              className="w-full bg-indigo-500"
                              style={{ height: `${perDiemRatio}%` }}
                            />
                          )}
                          {m.mileageEur > 0 && (
                            <div
                              className="w-full bg-emerald-500"
                              style={{ height: `${mileageRatio}%` }}
                            />
                          )}
                          {m.expensesEur > 0 && (
                            <div
                              className="w-full bg-amber-500"
                              style={{ height: `${expensesRatio}%` }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-medium text-slate-700">
                          {m.monthLabel}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {m.ordersCount + m.locoCount} vož.
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cost Structure Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Struktura troškova
              </h3>
              <p className="text-xs text-slate-500">
                Udio po kategorijama troška
              </p>
            </div>
            <PieChart className="h-4 w-4 text-slate-400" />
          </div>

          {/* Stacked Horizontal Bar */}
          <div className="mb-5 h-4 w-full overflow-hidden rounded-full bg-slate-100 flex">
            {costStructure.totalEur > 0 ? (
              <>
                <div
                  className="bg-indigo-500 transition-all duration-300"
                  style={{ width: `${costStructure.perDiemPct}%` }}
                  title={`Dnevnice: ${costStructure.perDiemPct}%`}
                />
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${costStructure.mileagePct}%` }}
                  title={`Kilometraža: ${costStructure.mileagePct}%`}
                />
                <div
                  className="bg-amber-500 transition-all duration-300"
                  style={{ width: `${costStructure.expensesPct}%` }}
                  title={`Računi: ${costStructure.expensesPct}%`}
                />
              </>
            ) : null}
          </div>

          <div className="space-y-4">
            {/* Per Diem */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                  Dnevnice
                </span>
                <span className="font-semibold text-slate-900">
                  {formatEur(costStructure.perDiemEur)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${costStructure.perDiemPct}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs text-slate-500">
                  {costStructure.perDiemPct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Mileage */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Kilometraža (nalozi + loko)
                </span>
                <span className="font-semibold text-slate-900">
                  {formatEur(costStructure.mileageEur)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${costStructure.mileagePct}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs text-slate-500">
                  {costStructure.mileagePct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Receipts */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Računi (cestarina, smještaj...)
                </span>
                <span className="font-semibold text-slate-900">
                  {formatEur(costStructure.expensesEur)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500"
                    style={{ width: `${costStructure.expensesPct}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs text-slate-500">
                  {costStructure.expensesPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-500">Ukupno</span>
            <span className="font-bold text-slate-900">
              {formatEur(costStructure.totalEur)}
            </span>
          </div>
        </div>
      </div>

      {/* Employee & Vehicle Tables */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Employee Spending Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Troškovi po zaposlenicima
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {employeeStats.length} radnika
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Zaposlenik</th>
                  <th className="px-3 py-3 text-center font-medium">
                    Nalozi / Loko
                  </th>
                  <th className="px-3 py-3 text-right font-medium">Km</th>
                  <th className="px-3 py-3 text-right font-medium">Dnevnice</th>
                  <th className="px-4 py-3 text-right font-medium">Ukupno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      Nema podataka o potrošnji po zaposlenicima.
                    </td>
                  </tr>
                ) : (
                  employeeStats.map((emp) => (
                    <tr
                      key={emp.employeeId}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {emp.employeeName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {emp.jobTitle || emp.oib || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-slate-600">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {emp.ordersCount} / {emp.locoCount}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">
                        {formatKm(emp.totalKm)}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">
                        {formatEur(emp.perDiemEur)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatEur(emp.totalEur)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicle Spending Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-emerald-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Troškovi po vozilima
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              {vehicleStats.length} vozila
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Vozilo</th>
                  <th className="px-3 py-3 text-center font-medium">Tip</th>
                  <th className="px-3 py-3 text-center font-medium">
                    Nalozi / Loko
                  </th>
                  <th className="px-3 py-3 text-right font-medium">Km</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Trošak vozila
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicleStats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      Nema evidentiranih vožnji s vozilima.
                    </td>
                  </tr>
                ) : (
                  vehicleStats.map((veh) => (
                    <tr
                      key={veh.vehicleId}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {veh.makeModel}
                        </div>
                        <div className="text-xs text-slate-400">
                          {veh.licensePlate}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            veh.ownershipType === "SLUZBENO"
                              ? "bg-sky-50 text-sky-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {veh.ownershipType === "SLUZBENO"
                            ? "Službeno"
                            : "Privatno"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-slate-600">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                          {veh.ordersCount} / {veh.locoCount}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">
                        {formatKm(veh.totalKm)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatEur(veh.totalEur)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
