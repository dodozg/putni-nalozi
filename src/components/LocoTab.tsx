"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { formatDateHr, formatEur, round2 } from "@/lib/croatian-rules";
import { apiFetch } from "@/lib/demo-seed";
import type {
  CompanySettings,
  Employee,
  LocoTrip,
  Vehicle,
} from "@/lib/types";

interface LocoTabProps {
  trips: LocoTrip[];
  employees: Employee[];
  vehicles: Vehicle[];
  settings: CompanySettings;
  onRefresh: () => void;
}

export default function LocoTab({
  trips,
  employees,
  vehicles,
  settings,
  onRefresh,
}: LocoTabProps) {
  const activeEmployees = employees.filter((e) => e.active === 1);
  const privateVehicles = vehicles.filter(
    (v) => v.active === 1 && v.ownership_type === "PRIVATNO"
  );

  const [tripDate, setTripDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [employeeId, setEmployeeId] = useState<number>(
    activeEmployees[0]?.id || 0
  );
  const [vehicleId, setVehicleId] = useState<number | "">(
    privateVehicles[0]?.id || ""
  );
  const [origin, setOrigin] = useState(
    settings.address || "Sjedište tvrtke"
  );
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [odoStart, setOdoStart] = useState<number>(
    privateVehicles[0]?.current_odometer || 0
  );
  const [odoEnd, setOdoEnd] = useState<number>(0);
  const [manualKm, setManualKm] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const [filterEmployee, setFilterEmployee] = useState<string>("ALL");

  const computedKm =
    odoEnd > odoStart ? round2(odoEnd - odoStart) : round2(manualKm);
  const computedAmount = round2(computedKm * settings.mileage_rate);

  const handleVehicleChange = (val: string) => {
    const id = val ? Number(val) : "";
    setVehicleId(id);
    if (id) {
      const found = vehicles.find((v) => v.id === id);
      if (found) setOdoStart(found.current_odometer);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (computedKm <= 0) {
      setErrorMsg("Unesite ispravno stanje brojila ili prijeđene kilometre.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/loco-trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_date: tripDate,
          employee_id: employeeId,
          vehicle_id: vehicleId || null,
          origin,
          destination,
          purpose,
          odometer_start: odoStart,
          odometer_end: odoEnd,
          distance_km: computedKm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Greška pri spremanju.");
      } else {
        setDestination("");
        setPurpose("");
        if (odoEnd > odoStart) setOdoStart(odoEnd);
        setOdoEnd(0);
        setManualKm(0);
        onRefresh();
      }
    } catch {
      setErrorMsg("Mrežna greška.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (trip: LocoTrip) => {
    const nextStatus =
      trip.status === "ISPLACENO" ? "EVIDENTIRANO" : "ISPLACENO";
    const res = await apiFetch(`/api/loco-trips/${trip.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      setStatusMsg(
        `Status vožnje #${trip.id} promijenjen u "${
          nextStatus === "ISPLACENO" ? "Isplaćeno" : "Evidentirano"
        }".`
      );
      setTimeout(() => setStatusMsg(""), 3000);
    }
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Obrisati ovu loko vožnju?")) return;
    await apiFetch(`/api/loco-trips/${id}`, { method: "DELETE" });
    onRefresh();
  };

  const filteredTrips = useMemo(() => {
    if (filterEmployee === "ALL") return trips;
    return trips.filter((t) => String(t.employee_id) === filterEmployee);
  }, [trips, filterEmployee]);

  const totalKm = round2(
    filteredTrips.reduce((acc, t) => acc + t.distance_km, 0)
  );
  const totalAmount = round2(
    filteredTrips.reduce((acc, t) => acc + t.amount_eur, 0)
  );

  return (
    <div className="space-y-6">
      {/* Add Form (hidden in print) */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Nova loko vožnja (gradska vožnja &lt; {settings.min_distance_km} km)
            </h2>
            <p className="text-xs text-slate-500">
              Neoporeziva naknada za korištenje privatnog vozila u službene
              svrhe: <strong>{settings.mileage_rate.toFixed(2)} €/km</strong>
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500">Iznos naknade:</span>
            <div className="text-lg font-bold font-mono text-blue-700">
              {formatEur(computedAmount)} ({computedKm} km)
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
            {statusMsg}
          </div>
        )}

        {computedKm >= settings.min_distance_km && (
          <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <strong>Porezno upozorenje:</strong> Unesena udaljenost ({computedKm} km) je{" "}
            {settings.min_distance_km} km ili više. Za ovakve relacije po Pravilniku je
            potreban službeni putni nalog umjesto loko vožnje.
          </div>
        )}

        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Datum *
            </label>
            <input
              type="date"
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Zaposlenik *
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
              required
            >
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Privatno vozilo
            </label>
            <select
              value={vehicleId}
              onChange={(e) => handleVehicleChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
            >
              <option value="">-- Bez odabira --</option>
              {privateVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make_model} ({v.license_plate})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Polazište *
            </label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Odredište *
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="npr. Porezna uprava, Avenija Dubrovnik"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Svrha vožnje *
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="npr. Predaja dokumentacije"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Početno brojilo
            </label>
            <input
              type="number"
              min={0}
              value={odoStart}
              onChange={(e) => setOdoStart(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Završno brojilo
            </label>
            <input
              type="number"
              min={0}
              value={odoEnd}
              onChange={(e) => setOdoEnd(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Ili ručno km
            </label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={manualKm}
              onChange={(e) => setManualKm(Number(e.target.value))}
              disabled={odoEnd > odoStart}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono disabled:bg-slate-100"
            />
          </div>
          <div className="sm:col-span-3 flex items-end justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 px-4 py-2 text-xs font-semibold text-white transition"
            >
              <Plus className="w-4 h-4" />
              {saving ? "Spremanje..." : "Evidentiraj loko vožnju"}
            </button>
          </div>
        </form>
      </div>

      {/* Evidencija + Print Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm print:border-none print:shadow-none print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Evidencija loko vožnje — {settings.name}
            </h3>
            <p className="text-xs text-slate-500">
              Ukupno: <strong>{totalKm} km</strong> | Za isplatu:{" "}
              <strong className="text-blue-700">{formatEur(totalAmount)}</strong>
            </p>
          </div>

          <div className="no-print flex items-center gap-3">
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            >
              <option value="ALL">Svi zaposlenici</option>
              {employees.map((e) => (
                <option key={e.id} value={String(e.id)}>
                  {e.full_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Ispiši izvješće
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 uppercase">
                <th className="py-2.5 pr-3">Datum</th>
                <th className="py-2.5 pr-3">Zaposlenik</th>
                <th className="py-2.5 pr-3">Vozilo</th>
                <th className="py-2.5 pr-3">Relacija i svrha</th>
                <th className="py-2.5 pr-3 text-right">Brojilo</th>
                <th className="py-2.5 pr-3 text-right">Km</th>
                <th className="py-2.5 pr-3 text-right">Iznos</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="no-print py-2.5 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Nema evidentiranih loko vožnji.
                  </td>
                </tr>
              ) : (
                filteredTrips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {formatDateHr(t.trip_date)}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">
                      {t.employee_name}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {t.vehicle_license_plate || "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-slate-800">
                        {t.origin} &rarr; {t.destination}
                      </div>
                      <div className="text-slate-500">{t.purpose}</div>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-slate-500">
                      {t.odometer_end > 0
                        ? `${t.odometer_start}–${t.odometer_end}`
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono font-semibold">
                      {t.distance_km}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono font-semibold text-slate-900">
                      {formatEur(t.amount_eur)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => toggleStatus(t)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          t.status === "ISPLACENO"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {t.status === "ISPLACENO" ? "Isplaćeno" : "Evidentirano"}
                      </button>
                    </td>
                    <td className="no-print py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                        title="Obriši"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
