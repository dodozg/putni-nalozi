"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileSpreadsheet,
  Info,
} from "lucide-react";
import { formatEur, round2 } from "@/lib/croatian-rules";
import {
  buildJoppdRecords,
  formatJoppdReportLabel,
  generateJoppdCsv,
  generateJoppdXml,
  type JoppdCode,
} from "@/lib/joppd";
import type {
  CompanySettings,
  Employee,
  LocoStatus,
  LocoTrip,
  OrderStatus,
  TravelOrder,
} from "@/lib/types";

interface JoppdTabProps {
  orders: TravelOrder[];
  locoTrips: LocoTrip[];
  employees: Employee[];
  settings: CompanySettings;
}

type StatusFilterMode = "OBRACUNAT_ISPLACEN" | "ISPLACEN_ONLY" | "ALL";

const CODE_BADGE_CLASSES: Record<JoppdCode, string> = {
  "17": "bg-blue-50 text-blue-700 border-blue-200",
  "18": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "19": "bg-amber-50 text-amber-700 border-amber-200",
};

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function JoppdTab({
  orders,
  locoTrips,
  employees,
  settings,
}: JoppdTabProps) {
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const o of orders) {
      const m = (o.issue_date || o.departure_at || "").slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(m)) months.add(m);
    }
    for (const t of locoTrips) {
      const m = (t.trip_date || "").slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(m)) months.add(m);
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [orders, locoTrips]);

  const [monthFilter, setMonthFilter] = useState<string>(
    () => availableMonths[0] || new Date().toISOString().slice(0, 7)
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilterMode>(
    "OBRACUNAT_ISPLACEN"
  );
  const [reportDate, setReportDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [showXmlPreview, setShowXmlPreview] = useState(false);
  const [copiedXml, setCopiedXml] = useState(false);

  const filterOptions = useMemo(() => {
    if (statusFilter === "ISPLACEN_ONLY") {
      return {
        orderStatuses: ["ISPLACEN"] as OrderStatus[],
        locoStatuses: ["ISPLACENO"] as LocoStatus[],
      };
    }
    if (statusFilter === "ALL") {
      return {
        orderStatuses: [
          "NACRT",
          "ODOBREN",
          "OBRACUNAT",
          "ISPLACEN",
        ] as OrderStatus[],
        locoStatuses: ["EVIDENTIRANO", "ISPLACENO"] as LocoStatus[],
      };
    }
    return {
      orderStatuses: ["OBRACUNAT", "ISPLACEN"] as OrderStatus[],
      locoStatuses: ["ISPLACENO"] as LocoStatus[],
    };
  }, [statusFilter]);

  const records = useMemo(
    () =>
      buildJoppdRecords(
        orders,
        locoTrips,
        employees,
        monthFilter,
        filterOptions
      ),
    [orders, locoTrips, employees, monthFilter, filterOptions]
  );

  const summary = useMemo(() => {
    const uniqueEmployees = new Set(
      records.map((r) => r.employeeOib || String(r.employeeId))
    );
    let sum17 = 0;
    let sum18 = 0;
    let sum19 = 0;
    for (const r of records) {
      if (r.code === "17") sum17 += r.amountEur;
      else if (r.code === "18") sum18 += r.amountEur;
      else if (r.code === "19") sum19 += r.amountEur;
    }
    return {
      employeeCount: uniqueEmployees.size,
      rowCount: records.length,
      sum17: round2(sum17),
      sum18: round2(sum18),
      sum19: round2(sum19),
      totalEur: round2(sum17 + sum18 + sum19),
    };
  }, [records]);

  const xmlContent = useMemo(
    () => generateJoppdXml(settings, records, reportDate),
    [settings, records, reportDate]
  );

  const csvContent = useMemo(() => generateJoppdCsv(records), [records]);

  const handleDownloadXml = () => {
    downloadTextFile(
      "JOPPD_obrazac.xml",
      xmlContent,
      "application/xml;charset=utf-8"
    );
  };

  const handleDownloadCsv = () => {
    downloadTextFile(
      "JOPPD_pregled.csv",
      csvContent,
      "text/csv;charset=utf-8"
    );
  };

  const handleCopyXml = async () => {
    try {
      await navigator.clipboard.writeText(xmlContent);
      setCopiedXml(true);
      setTimeout(() => setCopiedXml(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              JOPPD obrazac — Neoporezivi primici
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pregled i izvoz Stranice A i B za ePoreznu (šifre 17, 18 i 19 prema
              Pravilniku o porezu na dohodak).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowXmlPreview((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {showXmlPreview ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {showXmlPreview ? "Sakrij XML" : "Pregled XML-a"}
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={records.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              JOPPD_pregled.csv
            </button>

            <button
              type="button"
              onClick={handleDownloadXml}
              disabled={records.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Preuzmi JOPPD_obrazac.xml
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="joppd-month"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Mjesec obračuna (YYYY-MM)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="joppd-month"
                type="month"
                value={monthFilter === "ALL" ? "" : monthFilter}
                onChange={(e) => setMonthFilter(e.target.value || "ALL")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setMonthFilter("ALL")}
                className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium ${
                  monthFilter === "ALL"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Svi
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="joppd-status"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Status dokumenata
            </label>
            <select
              id="joppd-status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as StatusFilterMode)
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="OBRACUNAT_ISPLACEN">
                Obračunati i isplaćeni (preporučeno)
              </option>
              <option value="ISPLACEN_ONLY">Samo isplaćeni</option>
              <option value="ALL">Svi statusi (uklj. nacrte)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="joppd-report-date"
              className="block text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              Datum izvješća (Oznaka:{" "}
              <span className="font-semibold text-slate-700">
                {formatJoppdReportLabel(reportDate)}
              </span>
              )
            </label>
            <input
              id="joppd-report-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">
            Šifra 17 — Dnevnice
          </div>
          <div className="mt-1 text-xl font-bold text-blue-700">
            {formatEur(summary.sum17)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">
            Šifra 18 — Privatni auto
          </div>
          <div className="mt-1 text-xl font-bold text-emerald-700">
            {formatEur(summary.sum18)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">
            Šifra 19 — Noćenja i troškovi
          </div>
          <div className="mt-1 text-xl font-bold text-amber-700">
            {formatEur(summary.sum19)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">
            Osoba / Redaka (Str. A)
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {summary.employeeCount} / {summary.rowCount}
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="text-xs font-medium text-blue-700">
            Ukupno neoporezivo
          </div>
          <div className="mt-1 text-xl font-bold text-blue-900">
            {formatEur(summary.totalEur)}
          </div>
        </div>
      </div>

      {/* Stranica B Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-900">
            Stranica B — Pregled neoporezivih primitaka po zaposleniku
          </h3>
          <span className="text-xs text-slate-500">
            Podnositelj: {settings.name} (OIB: {settings.oib || "—"})
          </span>
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <Info className="h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              Nema neoporezivih primitaka za odabrane filtere
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Promijenite mjesec obračuna ili status dokumenata kako biste
              prikazali podatke za JOPPD.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Rbr</th>
                  <th className="px-4 py-3">Zaposlenik</th>
                  <th className="px-4 py-3">OIB</th>
                  <th className="px-4 py-3">Šifra</th>
                  <th className="px-4 py-3">Opis neoporezivog primitka</th>
                  <th className="px-4 py-3">Izvori</th>
                  <th className="px-4 py-3 text-right">Iznos (EUR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {records.map((rec, idx) => (
                  <tr
                    key={`${rec.employeeId}-${rec.code}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {rec.employeeName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                      {rec.employeeOib || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          CODE_BADGE_CLASSES[rec.code]
                        }`}
                      >
                        {rec.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {rec.description}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {rec.sourceRefs.join(", ")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                      {formatEur(rec.amountEur)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right">
                    Ukupno Stranica B:
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-blue-700">
                    {formatEur(summary.totalEur)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* XML Preview */}
      {showXmlPreview && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-100 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <FileCode2 className="h-4 w-4 text-blue-400" />
              JOPPD_obrazac.xml (Stranica A + Stranica B)
            </div>
            <button
              type="button"
              onClick={handleCopyXml}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              {copiedXml ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Kopirano
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Kopiraj XML
                </>
              )}
            </button>
          </div>
          <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
            {xmlContent}
          </pre>
        </div>
      )}
    </div>
  );
}
