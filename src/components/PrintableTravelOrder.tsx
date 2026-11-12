"use client";

import React from "react";
import { ArrowLeft, Printer } from "lucide-react";
import {
  calculateTravelOrder,
  EXPENSE_CATEGORY_LABELS,
  formatDateHr,
  formatDateTimeHr,
  formatEur,
  TRANSPORT_TYPE_LABELS,
} from "@/lib/croatian-rules";
import type { CompanySettings, TravelOrder } from "@/lib/types";

interface PrintableTravelOrderProps {
  order: TravelOrder;
  settings: CompanySettings;
  onClose: () => void;
}

export default function PrintableTravelOrder({
  order,
  settings,
  onClose,
}: PrintableTravelOrderProps) {
  const calc = calculateTravelOrder(
    {
      issue_date: order.issue_date,
      purpose: order.purpose,
      distance_km: order.distance_km,
      departure_at: order.departure_at,
      return_at: order.return_at,
      transport_type: order.transport_type,
      odometer_start: order.odometer_start,
      odometer_end: order.odometer_end,
      one_meal_days: order.one_meal_days,
      two_meals_days: order.two_meals_days,
      advance_payment_eur: order.advance_payment_eur,
      expenses: order.expenses || [],
    },
    settings
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto print:static print:bg-white print:overflow-visible">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print sticky top-0 z-10 bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Natrag na popis
          </button>
          <span className="text-sm text-slate-300">
            Službeni obrazac: <strong>{order.order_number}</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold transition"
        >
          <Printer className="w-4 h-4" />
          Ispiši / Spremi kao PDF
        </button>
      </div>

      {/* Printable A4 Container */}
      <div className="max-w-[210mm] mx-auto my-6 bg-white p-8 sm:p-10 shadow-lg border border-slate-200 print:my-0 print:p-0 print:shadow-none print:border-none text-slate-900 text-[13px] leading-relaxed">
        {/* STRANICA 1: NALOG ZA SLUŽBENO PUTOVANJE */}
        <div>
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <div className="font-bold text-base uppercase tracking-wide">
                {settings.name}
              </div>
              <div className="text-xs text-slate-700">
                {settings.address}, {settings.city}
              </div>
              <div className="text-xs text-slate-700">
                OIB: {settings.oib}
                {settings.iban ? ` | IBAN: ${settings.iban}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-slate-600">
                Datum izdavanja
              </div>
              <div className="font-semibold">
                {formatDateHr(order.issue_date)}
              </div>
            </div>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl font-bold uppercase tracking-wider">
              PUTNI NALOG br. {order.order_number}
            </h1>
            <p className="text-xs text-slate-600">
              za službeno putovanje u tuzemstvu (čl. 8. Pravilnika o porezu na
              dohodak)
            </p>
          </div>

          <table className="w-full border-collapse border border-slate-400 mb-6">
            <tbody>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-3 py-2 font-semibold w-1/3">
                  Ime i prezime radnika
                </td>
                <td className="border border-slate-400 px-3 py-2">
                  {order.employee_name}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-3 py-2 font-semibold">
                  OIB radnika
                </td>
                <td className="border border-slate-400 px-3 py-2 font-mono">
                  {order.employee_oib}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-3 py-2 font-semibold">
                  Radno mjesto
                </td>
                <td className="border border-slate-400 px-3 py-2">
                  {order.employee_job_title}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-3 py-2 font-semibold">
                  Prebivalište / Adresa
                </td>
                <td className="border border-slate-400 px-3 py-2">
                  {order.employee_address || "—"}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-3 py-2 font-semibold">
                  Relacija putovanja
                </td>
                <td className="border border-slate-400 px-3 py-2">
                  <strong>{order.origin}</strong> &rarr;{" "}
                  <strong>{order.destination}</strong> (udaljenost u jednom
                  smjeru: {order.distance_km} km)
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-3 py-2 font-semibold">
                  Svrha putovanja
                </td>
                <td className="border border-slate-400 px-3 py-2">
                  {order.purpose}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-3 py-2 font-semibold">
                  Planirani polazak i povratak
                </td>
                <td className="border border-slate-400 px-3 py-2">
                  Polazak: {formatDateTimeHr(order.departure_at)} | Povratak:{" "}
                  {formatDateTimeHr(order.return_at)}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-3 py-2 font-semibold">
                  Odobreno prijevozno sredstvo
                </td>
                <td className="border border-slate-400 px-3 py-2">
                  {TRANSPORT_TYPE_LABELS[order.transport_type]}
                  {order.vehicle_make_model
                    ? ` — ${order.vehicle_make_model} (${order.vehicle_license_plate})`
                    : ""}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-50 px-3 py-2 font-semibold">
                  Odobrena akontacija
                </td>
                <td className="border border-slate-400 px-3 py-2 font-mono font-semibold">
                  {formatEur(order.advance_payment_eur)}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="text-xs text-slate-700 mb-10">
            Putni troškovi terete poslodavca sukladno važećem Pravilniku o
            porezu na dohodak. Radnik je dužan po povratku sa službenog puta u
            roku od 3 dana podnijeti obračun putnih troškova s priloženim
            vjerodostojnim ispravama (računima) i izvješćem s puta.
          </p>

          <div className="grid grid-cols-2 gap-12 mt-12">
            <div>
              <div className="text-xs text-slate-600 mb-8">
                U {settings.city.replace(/^\d+\s*/, "")},{" "}
                {formatDateHr(order.issue_date)}
              </div>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-800 h-10 mb-1"></div>
              <div className="text-xs font-semibold">
                Potpis ovlaštene osobe ({order.approved_by || settings.director_name})
              </div>
            </div>
          </div>
        </div>

        {/* STRANICA 2: OBRAČUN PUTNIH TROŠKOVA */}
        <div className="page-break mt-12 pt-8 border-t-2 border-dashed border-slate-300 print:border-none print:mt-0 print:pt-0">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold uppercase tracking-wider">
              OBRAČUN PUTNIH TROŠKOVA — {order.order_number}
            </h2>
            <p className="text-xs text-slate-600">
              Putnik: <strong>{order.employee_name}</strong> | Relacija:{" "}
              {order.origin} – {order.destination}
            </p>
          </div>

          {/* 1. Dnevnice */}
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">
            1. Obračun dnevnica
          </h3>
          <table className="w-full border-collapse border border-slate-400 mb-5 text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2 py-1.5 text-left">
                  Polazak
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">
                  Povratak
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Ukupno sati
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Bruto dnevnice
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Umanjenje (obroci)
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Neto za isplatu
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-400 px-2 py-1.5">
                  {formatDateTimeHr(order.departure_at)}
                </td>
                <td className="border border-slate-400 px-2 py-1.5">
                  {formatDateTimeHr(order.return_at)}
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                  {calc.perDiem.totalHours} h
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                  {calc.perDiem.rawFullCount}×{settings.per_diem_full}€ +{" "}
                  {calc.perDiem.rawHalfCount}×{settings.per_diem_half}€ ={" "}
                  {formatEur(calc.perDiem.grossPerDiemEur)}
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                  -
                  {formatEur(
                    calc.perDiem.oneMealDeductionEur +
                      calc.perDiem.twoMealsDeductionEur
                  )}
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono font-bold">
                  {formatEur(calc.perDiem.netPerDiemEur)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 2. Prijevoz i kilometraža */}
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">
            2. Troškovi prijevoza (kilometraža)
          </h3>
          <table className="w-full border-collapse border border-slate-400 mb-5 text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2 py-1.5 text-left">
                  Prijevozno sredstvo
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Početno brojilo
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Završno brojilo
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Prijeđeno km
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Naknada/km
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Ukupno
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-400 px-2 py-1.5">
                  {TRANSPORT_TYPE_LABELS[order.transport_type]}
                  {order.vehicle_license_plate
                    ? ` (${order.vehicle_license_plate})`
                    : ""}
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                  {order.odometer_start || "—"}
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                  {order.odometer_end || "—"}
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                  {calc.totalKm} km
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                  {order.transport_type === "PRIVATNO_VOZILO"
                    ? `${settings.mileage_rate.toFixed(2)} €`
                    : "0,00 €"}
                </td>
                <td className="border border-slate-400 px-2 py-1.5 text-right font-mono font-bold">
                  {formatEur(calc.mileageTotalEur)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 3. Priloženi računi */}
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">
            3. Ostali troškovi (priloženi računi)
          </h3>
          <table className="w-full border-collapse border border-slate-400 mb-5 text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2 py-1.5 text-left">
                  Kategorija
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">
                  Opis troška
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-left">
                  Broj računa
                </th>
                <th className="border border-slate-400 px-2 py-1.5 text-right">
                  Iznos
                </th>
              </tr>
            </thead>
            <tbody>
              {!order.expenses || order.expenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="border border-slate-400 px-2 py-2 text-center text-slate-500"
                  >
                    Nema priloženih računa.
                  </td>
                </tr>
              ) : (
                order.expenses.map((exp, idx) => (
                  <tr key={idx}>
                    <td className="border border-slate-400 px-2 py-1.5">
                      {EXPENSE_CATEGORY_LABELS[exp.category] || exp.category}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5">
                      {exp.description || "—"}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 font-mono">
                      {exp.receipt_number || "—"}
                    </td>
                    <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                      {formatEur(exp.amount_eur)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Rekapitulacija */}
          <div className="flex justify-end mb-6">
            <table className="w-72 border-collapse border border-slate-400 text-xs">
              <tbody>
                <tr>
                  <td className="border border-slate-400 px-3 py-1.5 bg-slate-50">
                    Ukupno obračunati troškovi:
                  </td>
                  <td className="border border-slate-400 px-3 py-1.5 text-right font-mono font-semibold">
                    {formatEur(calc.totalAmountEur)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-3 py-1.5 bg-slate-50">
                    Primljena akontacija:
                  </td>
                  <td className="border border-slate-400 px-3 py-1.5 text-right font-mono">
                    -{formatEur(order.advance_payment_eur)}
                  </td>
                </tr>
                <tr className="bg-slate-100 font-bold text-sm">
                  <td className="border border-slate-400 px-3 py-2">
                    {calc.balanceDueEur >= 0
                      ? "Razlika za isplatu radniku:"
                      : "Za povrat u blagajnu:"}
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-right font-mono">
                    {formatEur(Math.abs(calc.balanceDueEur))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Izvješće s puta */}
          <div className="mb-10">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">
              4. Izvješće s puta
            </h3>
            <div className="border border-slate-400 p-3 min-h-[60px] text-xs">
              {order.trip_report || "Nije uneseno."}
            </div>
          </div>

          {/* 3 Potpisa */}
          <div className="grid grid-cols-3 gap-6 mt-12 text-center text-xs">
            <div>
              <div className="border-b border-slate-800 h-10 mb-1"></div>
              <div className="font-semibold">Podnositelj obračuna</div>
              <div className="text-slate-600">{order.employee_name}</div>
            </div>
            <div>
              <div className="border-b border-slate-800 h-10 mb-1"></div>
              <div className="font-semibold">Obračunao (Računovodstvo)</div>
            </div>
            <div>
              <div className="border-b border-slate-800 h-10 mb-1"></div>
              <div className="font-semibold">Odobrio za isplatu</div>
              <div className="text-slate-600">
                {order.approved_by || settings.director_name}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
