"use client";

import React, { useState } from "react";
import { Building2, Car, Plus, RotateCcw, Save, Users } from "lucide-react";
import { DEFAULT_CROATIAN_RATES } from "@/lib/croatian-rules";
import { apiFetch } from "@/lib/demo-seed";
import type {
  CompanySettings,
  Employee,
  Vehicle,
  VehicleOwnership,
} from "@/lib/types";

interface MasterDataTabProps {
  settings: CompanySettings;
  employees: Employee[];
  vehicles: Vehicle[];
  onRefresh: () => void;
}

export default function MasterDataTab({
  settings,
  employees,
  vehicles,
  onRefresh,
}: MasterDataTabProps) {
  // Company settings form
  const [formSettings, setFormSettings] = useState<CompanySettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState("");

  // New employee form
  const [empName, setEmpName] = useState("");
  const [empOib, setEmpOib] = useState("");
  const [empJob, setEmpJob] = useState("");
  const [empAddr, setEmpAddr] = useState("");
  const [savingEmp, setSavingEmp] = useState(false);

  // New vehicle form
  const [vehOwnership, setVehOwnership] =
    useState<VehicleOwnership>("PRIVATNO");
  const [vehModel, setVehModel] = useState("");
  const [vehPlate, setVehPlate] = useState("");
  const [vehEmpId, setVehEmpId] = useState<string>("");
  const [vehOdo, setVehOdo] = useState<number>(0);
  const [savingVeh, setSavingVeh] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedMsg("");
    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formSettings),
      });
      if (res.ok) {
        setSettingsSavedMsg("Postavke su uspješno spremljene.");
        onRefresh();
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const resetLegalDefaults = () => {
    setFormSettings((prev) => ({
      ...prev,
      ...DEFAULT_CROATIAN_RATES,
    }));
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEmp(true);
    try {
      const res = await apiFetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: empName,
          oib: empOib,
          job_title: empJob,
          address: empAddr,
        }),
      });
      if (res.ok) {
        setEmpName("");
        setEmpOib("");
        setEmpJob("");
        setEmpAddr("");
        onRefresh();
      }
    } finally {
      setSavingEmp(false);
    }
  };

  const toggleEmployeeActive = async (emp: Employee) => {
    await apiFetch(`/api/employees/${emp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...emp, active: emp.active === 1 ? 0 : 1 }),
    });
    onRefresh();
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVeh(true);
    try {
      const res = await apiFetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownership_type: vehOwnership,
          make_model: vehModel,
          license_plate: vehPlate,
          employee_id: vehEmpId ? Number(vehEmpId) : null,
          current_odometer: vehOdo,
        }),
      });
      if (res.ok) {
        setVehModel("");
        setVehPlate("");
        setVehEmpId("");
        setVehOdo(0);
        onRefresh();
      }
    } finally {
      setSavingVeh(false);
    }
  };

  const toggleVehicleActive = async (v: Vehicle) => {
    await apiFetch(`/api/vehicles/${v.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...v, active: v.active === 1 ? 0 : 1 }),
    });
    onRefresh();
  };

  return (
    <div className="space-y-8">
      {/* 1. Postavke tvrtke */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-blue-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Postavke tvrtke i neoporezivi iznosi (RH)
              </h2>
              <p className="text-xs text-slate-500">
                Podaci koji se ispisuju u zaglavlju putnog naloga i stope po
                Pravilniku o porezu na dohodak
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetLegalDefaults}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Zadane HR stope
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Naziv tvrtke *
              </label>
              <input
                type="text"
                value={formSettings.name}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, name: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                OIB tvrtke *
              </label>
              <input
                type="text"
                value={formSettings.oib}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, oib: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                IBAN
              </label>
              <input
                type="text"
                value={formSettings.iban}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, iban: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adresa sjedišta
              </label>
              <input
                type="text"
                value={formSettings.address}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, address: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Poštanski broj i grad
              </label>
              <input
                type="text"
                value={formSettings.city}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, city: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Odgovorna osoba (Odobravatelj)
              </label>
              <input
                type="text"
                value={formSettings.director_name}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    director_name: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Puna dnevnica (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formSettings.per_diem_full}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    per_diem_full: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pola dnevnice (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formSettings.per_diem_half}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    per_diem_half: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kilometraža (€/km)
              </label>
              <input
                type="number"
                step="0.01"
                value={formSettings.mileage_rate}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    mileage_rate: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Min. udaljenost (km)
              </label>
              <input
                type="number"
                value={formSettings.min_distance_km}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    min_distance_km: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Umanj. 1 obrok (%)
              </label>
              <input
                type="number"
                value={formSettings.meal_deduction_one_pct}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    meal_deduction_one_pct: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Umanj. 2 obroka (%)
              </label>
              <input
                type="number"
                value={formSettings.meal_deduction_two_pct}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    meal_deduction_two_pct: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-700 font-medium">
              {settingsSavedMsg}
            </span>
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 px-4 py-2 text-xs font-semibold text-white transition"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? "Spremanje..." : "Spremi postavke"}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Zaposlenici */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-blue-700" />
          <h2 className="text-base font-bold text-slate-900">
            Evidencija zaposlenika
          </h2>
        </div>

        <form
          onSubmit={handleAddEmployee}
          className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200"
        >
          <input
            type="text"
            placeholder="Ime i prezime *"
            value={empName}
            onChange={(e) => setEmpName(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
            required
          />
          <input
            type="text"
            placeholder="OIB (11 znamenki) *"
            value={empOib}
            onChange={(e) => setEmpOib(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white font-mono"
            required
          />
          <input
            type="text"
            placeholder="Radno mjesto *"
            value={empJob}
            onChange={(e) => setEmpJob(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
            required
          />
          <input
            type="text"
            placeholder="Adresa prebivališta"
            value={empAddr}
            onChange={(e) => setEmpAddr(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
          />
          <button
            type="submit"
            disabled={savingEmp}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Dodaj radnika
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 uppercase">
                <th className="py-2 pr-3">Ime i prezime</th>
                <th className="py-2 pr-3">OIB</th>
                <th className="py-2 pr-3">Radno mjesto</th>
                <th className="py-2 pr-3">Prebivalište</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {emp.full_name}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-slate-600">
                    {emp.oib}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700">{emp.job_title}</td>
                  <td className="py-2.5 pr-3 text-slate-500">
                    {emp.address || "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleEmployeeActive(emp)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        emp.active === 1
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {emp.active === 1 ? "Aktivan" : "Neaktivan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Vozila */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <Car className="w-5 h-5 text-blue-700" />
          <h2 className="text-base font-bold text-slate-900">
            Evidencija vozila (službena i privatna)
          </h2>
        </div>

        <form
          onSubmit={handleAddVehicle}
          className="grid grid-cols-1 sm:grid-cols-6 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200"
        >
          <select
            value={vehOwnership}
            onChange={(e) =>
              setVehOwnership(e.target.value as VehicleOwnership)
            }
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
          >
            <option value="PRIVATNO">Privatno vozilo</option>
            <option value="SLUZBENO">Službeno vozilo</option>
          </select>
          <input
            type="text"
            placeholder="Marka i model *"
            value={vehModel}
            onChange={(e) => setVehModel(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
            required
          />
          <input
            type="text"
            placeholder="Registracija (ZG-1234-AB) *"
            value={vehPlate}
            onChange={(e) => setVehPlate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white uppercase font-mono"
            required
          />
          <select
            value={vehEmpId}
            onChange={(e) => setVehEmpId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
          >
            <option value="">-- Vlasnik / korisnik --</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Stanje brojila (km)"
            value={vehOdo}
            onChange={(e) => setVehOdo(Number(e.target.value))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white font-mono"
          />
          <button
            type="submit"
            disabled={savingVeh}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Dodaj vozilo
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 uppercase">
                <th className="py-2 pr-3">Vrsta</th>
                <th className="py-2 pr-3">Marka i model</th>
                <th className="py-2 pr-3">Registracija</th>
                <th className="py-2 pr-3">Zaposlenik</th>
                <th className="py-2 pr-3 text-right">Zadnje brojilo</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        v.ownership_type === "PRIVATNO"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      {v.ownership_type === "PRIVATNO" ? "Privatno" : "Službeno"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {v.make_model}
                  </td>
                  <td className="py-2.5 pr-3 font-mono font-semibold text-slate-800">
                    {v.license_plate}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {v.employee_name || "Sva vozila tvrtke"}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-slate-700">
                    {v.current_odometer.toLocaleString("hr-HR")} km
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggleVehicleActive(v)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        v.active === 1
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {v.active === 1 ? "Aktivno" : "Neaktivno"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
