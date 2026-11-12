import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePerDiem,
  calculateTravelOrder,
  DEFAULT_CROATIAN_RATES,
} from "./croatian-rules.ts";
import type { CompanySettings } from "./types.ts";

const SETTINGS: CompanySettings = {
  id: 1,
  name: "Test d.o.o.",
  oib: "12345678901",
  address: "Ilica 1",
  city: "10000 Zagreb",
  iban: "HR1234567890123456789",
  director_name: "Ivan Horvat",
  order_prefix: "PN",
  ...DEFAULT_CROATIAN_RATES,
};

describe("Hrvatski propisi - obračun dnevnica i putnih naloga", () => {
  it("nema prava na dnevnicu ako je udaljenost manja od 30 km", () => {
    const res = calculatePerDiem(
      "2026-11-10T07:00",
      "2026-11-10T21:00",
      25,
      0,
      0,
      SETTINGS
    );
    assert.equal(res.eligibleForPerDiem, false);
    assert.equal(res.netPerDiemEur, 0);
  });

  it("nema prava na dnevnicu za putovanje kraće od 8 sati", () => {
    const res = calculatePerDiem(
      "2026-11-10T08:00",
      "2026-11-10T15:30",
      120,
      0,
      0,
      SETTINGS
    );
    assert.equal(res.totalHours, 7.5);
    assert.equal(res.netPerDiemEur, 0);
  });

  it("obračunava pola dnevnice (15,00 €) za putovanje od 8 do 12 sati", () => {
    const res = calculatePerDiem(
      "2026-11-10T08:00",
      "2026-11-10T18:00",
      120,
      0,
      0,
      SETTINGS
    );
    assert.equal(res.totalHours, 10);
    assert.equal(res.rawHalfCount, 1);
    assert.equal(res.netPerDiemEur, 15);
  });

  it("obračunava punu dnevnicu (30,00 €) za putovanje dulje od 12 sati", () => {
    const res = calculatePerDiem(
      "2026-11-10T06:00",
      "2026-11-10T20:00",
      165,
      0,
      0,
      SETTINGS
    );
    assert.equal(res.totalHours, 14);
    assert.equal(res.rawFullCount, 1);
    assert.equal(res.netPerDiemEur, 30);
  });

  it("obračunava višednevno putovanje i umanjenje 30% za 1 obrok / 60% za 2 obroka", () => {
    // 34.5h = 1 full day (24h) + 10.5h (half day) => 30 + 15 = 45€ gross
    // 1 day with 1 meal (-30% of 30€ = -9€) => 36€ net
    const res = calculatePerDiem(
      "2026-11-04T07:30",
      "2026-11-05T18:00",
      165,
      1,
      0,
      SETTINGS
    );
    assert.equal(res.grossPerDiemEur, 45);
    assert.equal(res.oneMealDeductionEur, 9);
    assert.equal(res.netPerDiemEur, 36);
  });

  it("upozorava na gorivo uz privatno vozilo i datum izdavanja nakon polaska", () => {
    const calc = calculateTravelOrder(
      {
        issue_date: "2026-11-12",
        purpose: "Sastanak s klijentom u Splitu",
        distance_km: 410,
        departure_at: "2026-11-10T07:00",
        return_at: "2026-11-10T21:00",
        transport_type: "PRIVATNO_VOZILO",
        odometer_start: 10000,
        odometer_end: 10820,
        one_meal_days: 0,
        two_meals_days: 0,
        advance_payment_eur: 50,
        expenses: [
          {
            category: "GORIVO",
            description: "INA",
            receipt_number: "123",
            expense_date: "2026-11-10",
            amount_eur: 40,
          },
        ],
      },
      SETTINGS
    );

    assert.equal(calc.totalKm, 820);
    assert.equal(calc.mileageTotalEur, 410); // 820 * 0.50
    const codes = calc.warnings.map((w) => w.code);
    assert.ok(codes.includes("ISSUE_AFTER_DEPARTURE"));
    assert.ok(codes.includes("FUEL_WITH_PRIVATE_CAR"));
  });
});
