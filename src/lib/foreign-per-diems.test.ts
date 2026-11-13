import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateForeignPerDiem,
  FOREIGN_PER_DIEM_COUNTRIES,
  getForeignCountryByCode,
} from "./foreign-per-diems.ts";

describe("Inozemne dnevnice - Odluka Vlade RH i Pravilnik o porezu na dohodak", () => {
  it("sadrži najmanje 25 država s ispravnim službenim iznosima i valutama", () => {
    assert.ok(FOREIGN_PER_DIEM_COUNTRIES.length >= 25);

    const de = getForeignCountryByCode("DE");
    const si = getForeignCountryByCode("SI");
    const us = getForeignCountryByCode("US");
    const gb = getForeignCountryByCode("GB");
    const ch = getForeignCountryByCode("CH");
    const rs = getForeignCountryByCode("RS");

    assert.equal(de?.dailyRate, 70);
    assert.equal(de?.currency, "EUR");
    assert.equal(si?.dailyRate, 50);
    assert.equal(us?.dailyRate, 85);
    assert.equal(us?.currency, "USD");
    assert.equal(gb?.dailyRate, 70);
    assert.equal(gb?.currency, "GBP");
    assert.equal(ch?.dailyRate, 80);
    assert.equal(rs?.dailyRate, 40);
  });

  it("nema prava na dnevnicu za putovanje kraće od 8 sati", () => {
    const res = calculateForeignPerDiem({
      countryCode: "SI",
      departureAt: "2026-11-10T08:00",
      borderExitAt: "2026-11-10T08:30",
      borderReturnAt: "2026-11-10T14:30",
      returnAt: "2026-11-10T15:00",
    });

    assert.equal(res.totalHours, 7);
    assert.equal(res.foreignFullCount, 0);
    assert.equal(res.foreignHalfCount, 0);
    assert.equal(res.totalNetEur, 0);
  });

  it("obračunava pola inozemne dnevnice (50%) za boravak u inozemstvu od 8 do 12 sati", () => {
    const res = calculateForeignPerDiem({
      countryCode: "AT",
      departureAt: "2026-11-10T07:00",
      borderExitAt: "2026-11-10T08:00",
      borderReturnAt: "2026-11-10T18:00",
      returnAt: "2026-11-10T18:30",
    });

    assert.equal(res.foreignHours, 10);
    assert.equal(res.foreignFullCount, 0);
    assert.equal(res.foreignHalfCount, 1);
    assert.equal(res.grossForeignAmount, 35); // 50% od 70 EUR
    assert.equal(res.totalNetEur, 35);
  });

  it("obračunava punu inozemnu dnevnicu (100%) za boravak dulji od 12 sati", () => {
    const res = calculateForeignPerDiem({
      countryCode: "DE",
      departureAt: "2026-11-10T06:00",
      borderExitAt: "2026-11-10T07:00",
      borderReturnAt: "2026-11-10T20:00",
      returnAt: "2026-11-10T21:00",
    });

    assert.equal(res.foreignHours, 13);
    assert.equal(res.foreignFullCount, 1);
    assert.equal(res.foreignHalfCount, 0);
    assert.equal(res.netForeignAmount, 70);
    assert.equal(res.totalNetEur, 70);
  });

  it("primjenjuje pravilo prelaska granice: <8h u inozemstvu uz ukupno >12h daje tuzemnu dnevnicu", () => {
    const res = calculateForeignPerDiem({
      countryCode: "SI",
      departureAt: "2026-11-10T06:00",
      borderExitAt: "2026-11-10T10:00",
      borderReturnAt: "2026-11-10T16:30",
      returnAt: "2026-11-10T20:30",
    });

    assert.equal(res.totalHours, 14.5);
    assert.equal(res.foreignHours, 6.5);
    assert.equal(res.foreignFullCount, 0);
    assert.equal(res.foreignHalfCount, 0);
    assert.equal(res.domesticFullCount, 1);
    assert.equal(res.netDomesticEur, 30);
    assert.equal(res.totalNetEur, 30);
    assert.ok(res.warnings.some((w) => w.code === "FOREIGN_UNDER_8H"));
  });

  it("kombinira pola inozemne i pola tuzemne dnevnice kada je ukupno >12h, a inozemstvo 8-12h", () => {
    const res = calculateForeignPerDiem({
      countryCode: "HU",
      departureAt: "2026-11-10T05:00",
      borderExitAt: "2026-11-10T09:00",
      borderReturnAt: "2026-11-10T18:00",
      returnAt: "2026-11-10T22:00",
    });

    assert.equal(res.totalHours, 17);
    assert.equal(res.foreignHours, 9);
    assert.equal(res.foreignHalfCount, 1);
    assert.equal(res.domesticHalfCount, 1);
    assert.equal(res.netForeignAmountEur, 25); // 50% od 50 EUR
    assert.equal(res.netDomesticEur, 15); // 50% od 30 EUR
    assert.equal(res.totalNetEur, 40);
  });

  it("umanjuje dnevnicu za 30% (1 obrok) i 60% (2 obroka) na višednevnom putu", () => {
    // 52h u inozemstvu = 2 pune dnevnice (48h) + 4h (<8h) => 2 pune dnevnice po 70 EUR = 140 EUR
    // 1 dan s 2 obroka (-60% = -42 EUR) + 1 dan s 1 obrokom (-30% = -21 EUR) => neto 77 EUR
    const res = calculateForeignPerDiem({
      countryCode: "FR",
      departureAt: "2026-11-10T08:00",
      borderExitAt: "2026-11-10T08:00",
      borderReturnAt: "2026-11-12T12:00",
      returnAt: "2026-11-12T12:00",
      oneMealDays: 1,
      twoMealsDays: 1,
    });

    assert.equal(res.foreignFullCount, 2);
    assert.equal(res.grossForeignAmount, 140);
    assert.equal(res.twoMealsDeductionForeign, 42);
    assert.equal(res.oneMealDeductionForeign, 21);
    assert.equal(res.netForeignAmount, 77);
    assert.equal(res.totalNetEur, 77);
  });

  it("preračunava stranu valutu (USD, GBP) u EUR prema zadanom tečaju", () => {
    const res = calculateForeignPerDiem({
      countryCode: "US",
      departureAt: "2026-11-10T08:00",
      returnAt: "2026-11-11T10:00", // 26h => 1 puna dnevnica (85 USD)
      customExchangeRateToEur: 0.9,
    });

    assert.equal(res.country.currency, "USD");
    assert.equal(res.grossForeignAmount, 85);
    assert.equal(res.netForeignAmount, 85);
    assert.equal(res.netForeignAmountEur, 76.5);
    assert.equal(res.totalNetEur, 76.5);
  });

  it("vraća grešku ako je vrijeme prelaska granice izvan raspona polaska i povratka", () => {
    const res = calculateForeignPerDiem({
      countryCode: "DE",
      departureAt: "2026-11-10T10:00",
      borderExitAt: "2026-11-10T09:00",
      borderReturnAt: "2026-11-10T18:00",
      returnAt: "2026-11-10T20:00",
    });

    assert.equal(res.totalNetEur, 0);
    assert.ok(res.warnings.some((w) => w.code === "INVALID_BORDER_TIMES"));
  });
});
