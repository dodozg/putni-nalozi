"use client";

import React, { useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArchiveRestore,
  Building2,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  HardDriveDownload,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { formatDateTimeHr } from "@/lib/croatian-rules";
import { apiFetch } from "@/lib/demo-seed";
import type {
  AuthSession,
  BackupPayload,
  Employee,
  LocoTrip,
  TravelOrder,
  Vehicle,
} from "@/lib/types";

interface BackupRestoreTabProps {
  session: AuthSession;
  employees: Employee[];
  vehicles: Vehicle[];
  orders: TravelOrder[];
  locoTrips: LocoTrip[];
  onRefresh: () => Promise<void>;
}

export default function BackupRestoreTab({
  session,
  employees,
  vehicles,
  orders,
  locoTrips,
  onRefresh,
}: BackupRestoreTabProps) {
  const isGlobalAdmin = session.user.role === "global_admin";
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [downloadingCompany, setDownloadingCompany] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const [parsedBackup, setParsedBackup] = useState<BackupPayload | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [restoring, setRestoring] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    title: string;
    details?: string;
  } | null>(null);

  const triggerJsonDownload = (payload: BackupPayload, filename: string) => {
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadBackup = async (scope: "company" | "all") => {
    setFeedback(null);
    if (scope === "all") {
      setDownloadingAll(true);
    } else {
      setDownloadingCompany(true);
    }

    try {
      const res = await apiFetch(
        `/api/backup?scope=${scope}&companyId=${session.activeCompanyId}`
      );
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          title: "Greška pri izradi sigurnosne kopije",
          details: data.error || "Poslužitelj je odbio zahtjev.",
        });
        return;
      }

      const payload = data as BackupPayload;
      const dateStr = new Date().toISOString().slice(0, 10);
      const safeCompSlug = session.activeCompany.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const filename =
        scope === "all"
          ? `putni-nalozi-sustav-backup-${dateStr}.json`
          : `putni-nalozi-backup-${safeCompSlug || "tvrtka"}-${dateStr}.json`;

      triggerJsonDownload(payload, filename);

      setFeedback({
        type: "success",
        title:
          scope === "all"
            ? "Cjelovita sigurnosna kopija sustava je preuzeta"
            : `Sigurnosna kopija za tvrtku "${session.activeCompany.name}" je preuzeta`,
        details: `Datoteka "${filename}" spremljena je na vaše računalo.`,
      });
    } catch {
      setFeedback({
        type: "error",
        title: "Greška u mreži",
        details: "Nije moguće preuzeti sigurnosnu kopiju.",
      });
    } finally {
      setDownloadingCompany(false);
      setDownloadingAll(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as BackupPayload;

      if (
        !json ||
        typeof json !== "object" ||
        (!json.companyData && !json.allCompaniesData)
      ) {
        setParsedBackup(null);
        setFeedback({
          type: "error",
          title: "Neispravan format datoteke",
          details:
            "Odabrana .json datoteka ne sadrži valjanu strukturu sigurnosne kopije sustava Putni Nalozi.",
        });
        return;
      }

      setParsedBackup(json);
    } catch {
      setParsedBackup(null);
      setFeedback({
        type: "error",
        title: "Greška pri čitanju JSON datoteke",
        details: "Provjerite je li datoteka ispravna .json sigurnosna kopija.",
      });
    }
  };

  const handleClearFile = () => {
    setParsedBackup(null);
    setSelectedFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExecuteRestore = async () => {
    if (!parsedBackup) return;

    if (
      restoreMode === "replace" &&
      !confirm(
        `UPOZORENJE: Odabrali ste način "Zamijeni sve podatke tvrtke (Replace)". Postojeći podaci tvrtke "${session.activeCompany.name}" bit će zamijenjeni podacima iz sigurnosne kopije. Želite li nastaviti?`
      )
    ) {
      return;
    }

    setRestoring(true);
    setFeedback(null);
    try {
      const res = await apiFetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backup: parsedBackup,
          mode: restoreMode,
          targetCompanyId: session.activeCompanyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          title: "Greška pri vraćanju podataka",
          details: data.error || "Vraćanje podataka nije uspjelo.",
        });
        return;
      }

      const s = data.summary || {};
      const detailsParts = [
        `Radnici: ${s.employeesRestored ?? 0}`,
        `Vozila: ${s.vehiclesRestored ?? 0}`,
        `Putni nalozi: ${s.ordersRestored ?? 0}`,
        `Loko vožnje: ${s.locoTripsRestored ?? 0}`,
      ];
      if (s.companiesRestored !== undefined) {
        detailsParts.unshift(`Tvrtke: ${s.companiesRestored}`);
      }

      setFeedback({
        type: "success",
        title: `Podaci su uspješno vraćeni (${
          restoreMode === "merge"
            ? "Spojeno s postojećim podacima"
            : "Zamijenjeni podaci tvrtke"
        })`,
        details: `Sažetak vraćenih zapisa — ${detailsParts.join(" · ")}`,
      });

      handleClearFile();
      await onRefresh();
    } catch {
      setFeedback({
        type: "error",
        title: "Mrežna greška pri vraćanju podataka",
        details: "Provjerite vezu s poslužiteljem.",
      });
    } finally {
      setRestoring(false);
    }
  };

  // Compute preview summary for uploaded backup
  const previewSummary = React.useMemo(() => {
    if (!parsedBackup) return null;
    if (parsedBackup.scope === "all" && parsedBackup.allCompaniesData) {
      const list = parsedBackup.allCompaniesData;
      return {
        isSystemBackup: true,
        companyName: `Cjelovita kopija sustava (${list.length} tvrtki)`,
        oib: list.map((c) => c.company?.name).join(", "),
        exportedAt: parsedBackup.exportedAt,
        exportedBy: parsedBackup.exportedBy,
        employeesCount: list.reduce(
          (sum, c) => sum + (c.employees?.length || 0),
          0
        ),
        vehiclesCount: list.reduce(
          (sum, c) => sum + (c.vehicles?.length || 0),
          0
        ),
        ordersCount: list.reduce(
          (sum, c) => sum + (c.travelOrders?.length || 0),
          0
        ),
        locoCount: list.reduce((sum, c) => sum + (c.locoTrips?.length || 0), 0),
      };
    }

    const cd = parsedBackup.companyData;
    if (!cd) return null;
    return {
      isSystemBackup: false,
      companyName: cd.company?.name || cd.settings?.name || "Nepoznata tvrtka",
      oib: cd.company?.oib || cd.settings?.oib || "—",
      exportedAt: parsedBackup.exportedAt,
      exportedBy: parsedBackup.exportedBy,
      employeesCount: cd.employees?.length || 0,
      vehiclesCount: cd.vehicles?.length || 0,
      ordersCount: cd.travelOrders?.length || 0,
      locoCount: cd.locoTrips?.length || 0,
    };
  }, [parsedBackup]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Sigurnosna kopija i vraćanje podataka (Backup &amp; Restore)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Izvezite kompletne podatke tvrtke u strukturiranu{" "}
              <span className="font-mono">.json</span> datoteku ili vratite
              podatke iz postojeće sigurnosne kopije.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 shrink-0">
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Aktivna tvrtka: {session.activeCompany.name}</span>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-xs ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">{feedback.title}</div>
              {feedback.details && (
                <div className="mt-0.5 opacity-90">{feedback.details}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: BACKUP (EXPORT) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <HardDriveDownload className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                1. Izrada sigurnosne kopije (Backup)
              </h3>
              <p className="text-xs text-slate-500">
                Preuzmite sve evidencije u JSON formatu za arhivu ili prijenos
              </p>
            </div>
          </div>

          {/* Current Company Summary */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {session.activeCompany.name}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  OIB: {session.activeCompany.oib}
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-semibold">
                <ShieldCheck className="w-3 h-3" />
                Spremno za izvoz
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white rounded-xl border border-slate-200/70 p-2.5">
                <div className="text-[10px] text-slate-500">Zaposlenici</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {employees.length}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/70 p-2.5">
                <div className="text-[10px] text-slate-500">Vozila</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {vehicles.length}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/70 p-2.5">
                <div className="text-[10px] text-slate-500">Putni nalozi</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {orders.length}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200/70 p-2.5">
                <div className="text-[10px] text-slate-500">Loko vožnje</div>
                <div className="text-sm font-bold text-slate-900 font-mono">
                  {locoTrips.length}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={downloadingCompany}
              onClick={() => handleDownloadBackup("company")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 px-4 shadow-xs transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloadingCompany
                  ? "Priprema datoteke..."
                  : `Preuzmi sigurnosnu kopiju tvrtke (${session.activeCompany.name})`}
              </span>
            </button>
          </div>

          {/* Global Admin Full System Backup */}
          {isGlobalAdmin && (
            <div className="rounded-2xl bg-purple-50/60 border border-purple-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-purple-950">
                    Cjelovita sigurnosna kopija sustava (Globalni Admin)
                  </div>
                  <p className="text-[11px] text-purple-800 mt-0.5">
                    Uključuje podatke svih registriranih tvrtki, sve korisničke
                    račune, ovlasti, putne naloge i loko vožnje u jednoj
                    datoteci.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={downloadingAll}
                onClick={() => handleDownloadBackup("all")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs py-2.5 px-4 shadow-xs transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {downloadingAll
                    ? "Izvoz cijelog sustava..."
                    : "Preuzmi cjeloviti sustavski backup (Sve tvrtke i korisnici)"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: RESTORE (IMPORT) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <ArchiveRestore className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                2. Vraćanje podataka (Restore)
              </h3>
              <p className="text-xs text-slate-500">
                Učitajte <span className="font-mono">.json</span> sigurnosnu
                kopiju, pregledajte sažetak i odaberite način vraćanja
              </p>
            </div>
          </div>

          {/* File Upload Dropzone */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
              id="backup-file-upload"
            />
            <label
              htmlFor="backup-file-upload"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 p-6 text-center cursor-pointer transition"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center shadow-2xs">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {selectedFileName
                  ? `Odabrana datoteka: ${selectedFileName}`
                  : "Kliknite za odabir .json datoteke sigurnosne kopije"}
              </div>
              <div className="text-[11px] text-slate-500">
                Podržane su datoteke izvezene iz sustava Putni Nalozi HR
              </div>
            </label>
          </div>

          {/* Preview Summary Card when file is loaded */}
          {previewSummary && (
            <div className="space-y-4 pt-1">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Pregled učitane sigurnosne kopije
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Izvezeno:{" "}
                        {previewSummary.exportedAt
                          ? formatDateTimeHr(previewSummary.exportedAt)
                          : "—"}{" "}
                        · Autor: {previewSummary.exportedBy || "—"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="text-xs text-slate-400 hover:text-slate-700"
                    title="Ukloni datoteku"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs bg-white rounded-xl border border-slate-200/80 p-3 space-y-1">
                  <div>
                    <span className="text-slate-500">Izvorna tvrtka:</span>{" "}
                    <strong className="text-slate-900">
                      {previewSummary.companyName}
                    </strong>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    OIB / Obuhvat: {previewSummary.oib}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white rounded-xl border border-slate-200/70 p-2">
                    <div className="text-[10px] text-slate-500">Zaposlenici</div>
                    <div className="text-sm font-bold text-blue-700 font-mono">
                      {previewSummary.employeesCount}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200/70 p-2">
                    <div className="text-[10px] text-slate-500">Vozila</div>
                    <div className="text-sm font-bold text-blue-700 font-mono">
                      {previewSummary.vehiclesCount}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200/70 p-2">
                    <div className="text-[10px] text-slate-500">
                      Putni nalozi
                    </div>
                    <div className="text-sm font-bold text-blue-700 font-mono">
                      {previewSummary.ordersCount}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200/70 p-2">
                    <div className="text-[10px] text-slate-500">Loko vožnje</div>
                    <div className="text-sm font-bold text-blue-700 font-mono">
                      {previewSummary.locoCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Restore Mode Selection */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-800">
                  Odaberite način vraćanja podataka:
                </label>

                <label
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                    restoreMode === "merge"
                      ? "bg-blue-50/70 border-blue-400 text-slate-900"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="restoreMode"
                    value="merge"
                    checked={restoreMode === "merge"}
                    onChange={() => setRestoreMode("merge")}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="text-xs">
                    <div className="font-bold">
                      Spoji s postojećim podacima (Merge) — Preporučeno
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Zadržava postojeće evidencije u tvrtki i nadodaje nove
                      radnike, vozila, putne naloge i loko vožnje iz datoteke.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition ${
                    restoreMode === "replace"
                      ? "bg-amber-50/80 border-amber-400 text-slate-900"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="restoreMode"
                    value="replace"
                    checked={restoreMode === "replace"}
                    onChange={() => setRestoreMode("replace")}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-amber-950">
                      Zamijeni sve podatke tvrtke (Replace)
                    </div>
                    <div className="text-amber-800/90 mt-0.5">
                      Briše trenutne radnike, vozila, putne naloge i loko vožnje
                      aktivne tvrtke te ih u potpunosti zamjenjuje podacima iz
                      ove kopije.
                    </div>
                  </div>
                </label>
              </div>

              {restoreMode === "replace" && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Zamjena podataka odnosi se samo na trenutno aktivnu tvrtku (
                    <strong>{session.activeCompany.name}</strong>). Podaci
                    ostalih tvrtki u sustavu ostaju netaknuti.
                  </span>
                </div>
              )}

              <button
                type="button"
                disabled={restoring}
                onClick={handleExecuteRestore}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-3 px-4 shadow-xs transition cursor-pointer"
              >
                <RefreshCw
                  className={`w-4 h-4 ${restoring ? "animate-spin" : ""}`}
                />
                <span>
                  {restoring
                    ? "Vraćanje podataka u tijeku..."
                    : `Izvrši vraćanje podataka u tvrtku "${session.activeCompany.name}"`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
