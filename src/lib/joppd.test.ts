import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildJoppdRecords,
  formatJoppdReportLabel,
  generateJoppdCsv,
  generateJoppdXml,
} from "./joppd.ts";
import type {
  CompanySettings,
  Employee,
  LocoTrip,
  TravelOrder,
} from "./types.ts";

const SETTINGS: CompanySettings = {
  id: 1,
  name: "Adriatic Tech d.o.o.",
  oib: "12345678901",
  address: "Savska cesta 41",
  city: "10000 Zagreb",
  iban: "HR1234567890123456789",
  director_name: "Ana Kovač",
  order_prefix: "PN",
  per_diem_full: 30,
  per_diem_half: 15,
  mileage_rate: 0.5,
  min_distance_km: 30,
  meal_deduction_one_pct: 30,
  meal_deduction_two_pct: 60,
};

const EMPLOYEES: Employee[] = [
  {
    id: 1,
    full_name: "Marko Marić",
    oib: "11122233344",
    job_title: "Konzultant",
    address: "Zagreb",
    active: 1,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    full_name: "Ivana Ivić",
    oib: "55566677788",
    job_title: "Inženjerka",
    address: "Split",
    active: 1,
    created_at: "2026-01-01T00:00:00Z",
  },
];

function makeOrder(overrides: Partial<TravelOrder>): TravelOrder {
  return {
    id: 1,
    order_number: "PN-2026-001",
    year: 2026,
    seq_number: 1,
    status: "ISPLACEN",
    issue_date: "2026-11-05",
    employee_id: 1,
    purpose: "Sastanak s klijentom",
    origin: "Zagreb",
    destination: "Rijeka",
    distance_km: 160,
    departure_at: "2026-11-05T08:00",
    return_at: "2026-11-05T21:00",
    transport_type: "PRIVATNO_VOZILO",
    vehicle_id: 1,
    odometer_start: 10000,
    odometer_end: 10320,
    total_km: 320,
    one_meal_days: 0,
    two_meals_days: 0,
    advance_payment_eur: 0,
    trip_report: "Održan sastanak",
    per_diem_total_eur: 30,
    mileage_total_eur: 160,
    expenses_total_eur: 25.5,
    total_amount_eur: 215.5,
    balance_due_eur: 215.5,
    approved_by: "Ana Kovač",
    created_at: "2026-11-05T07:00:00Z",
    updated_at: "2026-11-06T10:00:00Z",
    ...overrides,
  };
}

function makeLoco(overrides: Partial<LocoTrip>): LocoTrip {
  return {
    id: 10,
    trip_date: "2026-11-12",
    employee_id: 1,
    vehicle_id: 1,
    origin: "Zagreb",
    destination: "Velika Gorica",
    purpose: "Dostava dokumentacije",
    odometer_start: 10320,
    odometer_end: 10360,
    distance_km: 40,
    rate_eur: 0.5,
    amount_eur: 20,
    status: "ISPLACENO",
    created_at: "2026-11-12T12:00:00Z",
    ...overrides,
  };
}

describe("JOPPD obrazac - grupiranje i izvoz", () => {
  it("grupira primitke po zaposleniku i šiframa 17, 18 (putni + loko) i 19", () => {
    const orders: TravelOrder[] = [
      makeOrder({
        id: 1,
        order_number: "PN-2026-001",
        employee_id: 1,
        status: "ISPLACEN",
        per_diem_total_eur: 30,
        mileage_total_eur: 160,
        expenses_total_eur: 25.5,
      }),
      makeOrder({
        id: 2,
        order_number: "PN-2026-002",
        employee_id: 1,
        status: "OBRACUNAT",
        per_diem_total_eur: 15,
        mileage_total_eur: 0,
        expenses_total_eur: 80,
      }),
      makeOrder({
        id: 3,
        order_number: "PN-2026-003",
        employee_id: 2,
        status: "ISPLACEN",
        per_diem_total_eur: 60,
        mileage_total_eur: 50,
        expenses_total_eur: 0,
      }),
      // Nacrt se po defaultu ne uključuje u JOPPD
      makeOrder({
        id: 4,
        order_number: "PN-2026-004",
        employee_id: 2,
        status: "NACRT",
        per_diem_total_eur: 999,
        mileage_total_eur: 999,
        expenses_total_eur: 999,
      }),
    ];

    const locoTrips: LocoTrip[] = [
      makeLoco({ id: 10, employee_id: 1, amount_eur: 20, status: "ISPLACENO" }),
      makeLoco({ id: 11, employee_id: 1, amount_eur: 12.5, status: "ISPLACENO" }),
      // Evidentirano (neisplaćeno) se po defaultu ne uključuje
      makeLoco({ id: 12, employee_id: 2, amount_eur: 100, status: "EVIDENTIRANO" }),
    ];

    const records = buildJoppdRecords(orders, locoTrips, EMPLOYEES, "2026-11");

    // Ivana Ivić: 17 (60), 18 (50) -> 2 retka
    // Marko Marić: 17 (45), 18 (160 + 20 + 12.5 = 192.5), 19 (25.5 + 80 = 105.5) -> 3 retka
    assert.equal(records.length, 5);

    const marko17 = records.find((r) => r.employeeId === 1 && r.code === "17");
    const marko18 = records.find((r) => r.employeeId === 1 && r.code === "18");
    const marko19 = records.find((r) => r.employeeId === 1 && r.code === "19");
    const ivana17 = records.find((r) => r.employeeId === 2 && r.code === "17");
    const ivana18 = records.find((r) => r.employeeId === 2 && r.code === "18");

    assert.equal(marko17?.amountEur, 45);
    assert.equal(marko17?.sourceCount, 2);
    assert.equal(marko18?.amountEur, 192.5);
    assert.equal(marko18?.sourceCount, 3);
    assert.equal(marko19?.amountEur, 105.5);
    assert.equal(ivana17?.amountEur, 60);
    assert.equal(ivana18?.amountEur, 50);
  });

  it("filtrira zapise prema zadanom mjesecu (YYYY-MM)", () => {
    const orders: TravelOrder[] = [
      makeOrder({ id: 1, issue_date: "2026-10-28", per_diem_total_eur: 30, mileage_total_eur: 0, expenses_total_eur: 0 }),
      makeOrder({ id: 2, issue_date: "2026-11-03", per_diem_total_eur: 15, mileage_total_eur: 0, expenses_total_eur: 0 }),
    ];
    const locoTrips: LocoTrip[] = [
      makeLoco({ id: 1, trip_date: "2026-10-15", amount_eur: 10 }),
      makeLoco({ id: 2, trip_date: "2026-11-18", amount_eur: 25 }),
    ];

    const novRecords = buildJoppdRecords(orders, locoTrips, EMPLOYEES, "2026-11");
    assert.equal(novRecords.length, 2);
    assert.equal(novRecords.find((r) => r.code === "17")?.amountEur, 15);
    assert.equal(novRecords.find((r) => r.code === "18")?.amountEur, 25);
  });

  it("generira valjani JOPPD XML sa Stranicom A, Stranicom B i točnim zbrojevima", () => {
    const records = buildJoppdRecords(
      [
        makeOrder({
          id: 1,
          employee_id: 1,
          per_diem_total_eur: 30,
          mileage_total_eur: 40,
          expenses_total_eur: 15.25,
        }),
      ],
      [makeLoco({ id: 5, employee_id: 2, amount_eur: 10.5 })],
      EMPLOYEES,
      "2026-11"
    );

    const xml = generateJoppdXml(SETTINGS, records, "2026-11-30");

    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.ok(xml.includes("<ObrazacJOPPD"));
    assert.ok(xml.includes("<StranaA>"));
    assert.ok(xml.includes("<StranaB>"));
    assert.ok(xml.includes("<DatumIzvjesca>2026-11-30</DatumIzvjesca>"));
    assert.ok(xml.includes(`<OznakaIzvjesca>${formatJoppdReportLabel("2026-11-30")}</OznakaIzvjesca>`));
    assert.ok(xml.includes("<OIB>12345678901</OIB>"));
    assert.ok(xml.includes("<BrojOsoba>2</BrojOsoba>"));
    assert.ok(xml.includes("<BrojRedaka>4</BrojRedaka>"));
    // 30 + 40 + 15.25 + 10.5 = 95.75
    assert.ok(xml.includes("<NeoporeziviPrimiciUkupno>95.75</NeoporeziviPrimiciUkupno>"));
    assert.ok(xml.includes("<P4>11122233344</P4>"));
    assert.ok(xml.includes("<P4>55566677788</P4>"));
    assert.ok(xml.includes("<P151>17</P151>"));
    assert.ok(xml.includes("<P151>18</P151>"));
    assert.ok(xml.includes("<P151>19</P151>"));
    assert.ok(xml.includes("<P152>15.25</P152>"));
  });

  it("generira CSV s UTF-8 BOM-om i svim recima", () => {
    const records = buildJoppdRecords(
      [
        makeOrder({
          id: 1,
          employee_id: 1,
          per_diem_total_eur: 30,
          mileage_total_eur: 0,
          expenses_total_eur: 0,
        }),
      ],
      [],
      EMPLOYEES,
      "2026-11"
    );

    const csv = generateJoppdCsv(records);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.includes("Rbr;Zaposlenik;OIB;Šifra primitka"));
    assert.ok(csv.includes("1;Marko Marić;11122233344;17;"));
    assert.ok(csv.includes(";30.00;1;PN-2026-001"));
  });
});
