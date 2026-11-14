import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import module from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "..");

const NEXT_SERVER_SHIM = `data:text/javascript,${encodeURIComponent(`
export class NextResponse extends Response {
  static json(body, init = {}) {
    const headers = new Headers(init.headers || {});
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return new Response(JSON.stringify(body), {
      ...init,
      status: init.status ?? 200,
      headers,
    });
  }
}
`)}`;

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return { url: NEXT_SERVER_SHIM, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const targetPath = path.join(SRC_ROOT, specifier.slice(2));
      const withTs = targetPath.endsWith(".ts")
        ? targetPath
        : `${targetPath}.ts`;
      if (fs.existsSync(withTs)) {
        return { url: pathToFileURL(withTs).href, shortCircuit: true };
      }
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !path.extname(specifier) &&
      context.parentURL?.startsWith("file://")
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const candidateTs = path.resolve(parentDir, `${specifier}.ts`);
      if (fs.existsSync(candidateTs)) {
        return { url: pathToFileURL(candidateTs).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
import {
  ALL_PERMISSIONS,
  checkLoginRateLimit,
  clearAllLoginRateLimits,
  createSessionCookieHeader,
  createSessionToken,
  DEFAULT_USER_PERMISSIONS,
  extractTokenFromRequest,
  getSessionSecret,
  hashPassword,
   hasPermission,
  LOGIN_MAX_FAILED_ATTEMPTS,
  normalizeOrderStatus,
  normalizePermissions,
  recordFailedLogin,
  resetLoginRateLimit,
  SESSION_MAX_AGE_MS,
  verifyPassword,
  verifySessionToken,
} from "./auth.ts";
import {
  calculatePerDiem,
  calculateTravelOrder,
} from "./croatian-rules.ts";
import {
  authenticateUser,
  buildAuthSession,
  createCompany,
  createEmployee,
  createLocoTrip,
  createTravelOrder,
  createUser,
  createVehicle,
  deleteCompany,
  deleteEmployee,
  deleteLocoTrip,
  deleteTravelOrder,
  deleteUser,
  deleteVehicle,
  exportCompanyBackup,
  exportFullSystemBackup,
  getCompanySettings,
  getEmployeeById,
  getLocoTripById,
  getSessionFromRequest,
  getTravelOrderById,
  getVehicleById,
  listCompanies,
  listEmployees,
  listLocoTrips,
  listTravelOrders,
  listUsers,
  listVehicles,
  restoreBackup,
  updateCompanySettings,
  updateEmployee,
  updateLocoTripStatus,
  updateTravelOrder,
  updateUser,
  updateVehicle,
} from "./db.ts";
import { calculateForeignPerDiem } from "./foreign-per-diems.ts";
import {
  escapeCsvCell,
  escapeXml,
  generateJoppdCsv,
  generateJoppdXml,
} from "./joppd.ts";

describe("Autentikacija, Više-tvrtki (Multi-Tenancy), RBAC i Backup/Restore", () => {
  it("ispravno hashira i verificira lozinke te potpisuje sesije", () => {
    const hash = hashPassword("tajnaLozinka123!");
    assert.equal(verifyPassword("tajnaLozinka123!", hash), true);
    assert.equal(verifyPassword("pogresnaLozinka", hash), false);
    assert.equal(verifyPassword("tajnaLozinka123!", "neispravan_format"), false);
    assert.equal(verifyPassword("tajnaLozinka123!", "salt:zzzz"), false);

    const token = createSessionToken({ userId: 1, activeCompanyId: 2 });
    const verified = verifySessionToken(token);
    assert.ok(verified);
    assert.equal(verified.userId, 1);
    assert.equal(verified.activeCompanyId, 2);
  });

  it("odbija krivotvorene, izmijenjene i istekle sesijske tokene (Token Tampering & Forgery Protection)", () => {
    const validToken = createSessionToken({ userId: 3, activeCompanyId: 1 });
    const [encoded, signature] = validToken.split(".");

    // 1. Tampered payload (changing userId from 3 to 1 / global_admin while keeping signature)
    const tamperedPayload = Buffer.from(
      JSON.stringify({ userId: 1, activeCompanyId: 1, iat: Date.now() }),
      "utf8"
    ).toString("base64url");
    assert.equal(verifySessionToken(`${tamperedPayload}.${signature}`), null);

    // 2. Tampered activeCompanyId (switching from Company 1 to Company 2)
    const tamperedCompanyPayload = Buffer.from(
      JSON.stringify({ userId: 3, activeCompanyId: 2, iat: Date.now() }),
      "utf8"
    ).toString("base64url");
    assert.equal(
      verifySessionToken(`${tamperedCompanyPayload}.${signature}`),
      null
    );

    // 3. Injected role/permissions in payload signed with valid secret
    const injectedPayload = Buffer.from(
      JSON.stringify({
        userId: 3,
        activeCompanyId: 1,
        iat: Date.now(),
        role: "global_admin",
      }),
      "utf8"
    ).toString("base64url");
    const injectedSig = crypto
      .createHmac("sha256", getSessionSecret())
      .update(injectedPayload)
      .digest("base64url");
    assert.equal(verifySessionToken(`${injectedPayload}.${injectedSig}`), null);

    // 4. Forged HMAC signature with attacker secret
    const forgedSig = crypto
      .createHmac("sha256", "attacker-wrong-secret-key-1234567890")
      .update(encoded)
      .digest("base64url");
    assert.equal(verifySessionToken(`${encoded}.${forgedSig}`), null);

    // 5. Expired token (older than 7 days)
    const expiredToken = createSessionToken({
      userId: 1,
      activeCompanyId: 1,
      iat: Date.now() - SESSION_MAX_AGE_MS - 10_000,
    });
    assert.equal(verifySessionToken(expiredToken), null);

    // 6. Malformed tokens
    assert.equal(verifySessionToken(""), null);
    assert.equal(verifySessionToken("samo-jedan-dio"), null);
    assert.equal(verifySessionToken("a.b.c"), null);
    assert.equal(verifySessionToken("!!!.???"), null);

    // 7. Cookie header security flags (HttpOnly, SameSite=Lax, no unconditional Secure over HTTP)
    const cookieHeader = createSessionCookieHeader(validToken);
    assert.ok(cookieHeader.includes("HttpOnly"));
    assert.ok(cookieHeader.includes("SameSite=Lax"));
    assert.ok(!cookieHeader.includes("; Secure"));
  });

  it("štiti prijavu od brute-force napada (Rate Limiting - maks 10 pokušaja u 15 min)", () => {
    clearAllLoginRateLimits();
    const ip = "192.168.1.99";
    const email = "korisnik@firma1.hr";

    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i++) {
      const check = checkLoginRateLimit(ip, email);
      assert.equal(check.allowed, true);
      recordFailedLogin(ip, email);
    }

    const blocked = checkLoginRateLimit(ip, email);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remainingAttempts, 0);
    assert.ok(blocked.retryAfterSeconds > 0);

    // Other users/IPs are not blocked
    assert.equal(checkLoginRateLimit("10.0.0.1", email).allowed, true);

    // Reset after successful login
    resetLoginRateLimit(ip, email);
    assert.equal(checkLoginRateLimit(ip, email).allowed, true);
    clearAllLoginRateLimits();
  });

  it("uspješno prijavljuje sve zadane demo račune (global_admin, company_admin, user)", () => {
    const globalAdmin = authenticateUser("admin@sustav.hr", "admin123");
    assert.ok(globalAdmin);
    assert.equal(globalAdmin.role, "global_admin");
    assert.equal(globalAdmin.permissions.canBackupRestore, true);

    const firma1Admin = authenticateUser("direktor@firma1.hr", "firma123");
    assert.ok(firma1Admin);
    assert.equal(firma1Admin.role, "company_admin");
    assert.equal(firma1Admin.company_id, 1);
    assert.equal(firma1Admin.permissions.canApproveTravelOrders, true);

    const firma1User = authenticateUser("korisnik@firma1.hr", "korisnik123");
    assert.ok(firma1User);
    assert.equal(firma1User.role, "user");
    assert.equal(firma1User.company_id, 1);
    assert.equal(firma1User.permissions.canManageTravelOrders, true);
    assert.equal(firma1User.permissions.canApproveTravelOrders, false);

    const firma2Admin = authenticateUser("direktor@firma2.hr", "firma234");
    assert.ok(firma2Admin);
    assert.equal(firma2Admin.role, "company_admin");
    assert.equal(firma2Admin.company_id, 2);
  });

  it("izolira podatke između Tvrtke 1 i Tvrtke 2 i sprječava Cross-Tenant IDOR", () => {
    const emp1 = listEmployees(1);
    const emp2 = listEmployees(2);
    assert.ok(emp1.length >= 3);
    assert.ok(emp2.length >= 2);
    assert.ok(emp1.every((e) => e.company_id === 1));
    assert.ok(emp2.every((e) => e.company_id === 2));

    const ord1 = listTravelOrders(1);
    const ord2 = listTravelOrders(2);
    assert.ok(ord1.length >= 2);
    assert.ok(ord2.length >= 1);
    assert.ok(ord1.every((o) => o.company_id === 1));
    assert.ok(ord2.every((o) => o.company_id === 2));

    const veh1 = listVehicles(1);
    const veh2 = listVehicles(2);
    assert.ok(veh1.every((v) => v.company_id === 1));
    assert.ok(veh2.every((v) => v.company_id === 2));

    const loco1 = listLocoTrips(1);
    const loco2 = listLocoTrips(2);
    assert.ok(loco1.every((l) => l.company_id === 1));
    assert.ok(loco2.every((l) => l.company_id === 2));

    // Cross-Tenant IDOR checks: Company 1 cannot read, update, or delete Company 2's records
    const c2OrderId = ord2[0].id;
    const c2EmpId = emp2[0].id;
    const c2VehId = veh2[0].id;
    const c2LocoId = loco2[0].id;

    assert.equal(getTravelOrderById(c2OrderId, 1), null);
    assert.equal(getEmployeeById(c2EmpId, 1), null);
    assert.equal(getVehicleById(c2VehId, 1), null);
    assert.equal(getLocoTripById(c2LocoId, 1), null);

    assert.equal(deleteTravelOrder(c2OrderId, 1), false);
    assert.equal(deleteEmployee(c2EmpId, 1), false);
    assert.equal(deleteVehicle(c2VehId, 1), false);
    assert.equal(deleteLocoTrip(c2LocoId, 1), false);
    assert.equal(updateLocoTripStatus(c2LocoId, "ISPLACENO", 1), false);

    assert.equal(
      updateEmployee(
        c2EmpId,
        {
          full_name: "Hakirani Zaposlenik",
          oib: "00000000000",
          job_title: "Haker",
          address: "Nepoznata",
          active: 1,
        },
        1
      ),
      null
    );

    assert.equal(
      updateVehicle(
        c2VehId,
        {
          ownership_type: "SLUZBENO",
          make_model: "Hakirano Vozilo",
          license_plate: "ZG-0000-XX",
          employee_id: null,
          current_odometer: 999999,
          active: 1,
        },
        1
      ),
      null
    );

    // Cross-tenant foreign key injection check: Company 1 cannot create an order or loco trip referencing Company 2's employee
    assert.throws(() => {
      createTravelOrder(
        {
          status: "NACRT",
          issue_date: "2026-11-15",
          employee_id: c2EmpId,
          purpose: "Test cross-tenant FK",
          origin: "Zagreb",
          destination: "Split",
          distance_km: 400,
          departure_at: "2026-11-16T08:00",
          return_at: "2026-11-16T20:00",
          transport_type: "SLUZBENO_VOZILO",
          vehicle_id: null,
          odometer_start: 0,
          odometer_end: 0,
          total_km: 0,
          one_meal_days: 0,
          two_meals_days: 0,
          advance_payment_eur: 0,
          trip_report: "",
          per_diem_total_eur: 30,
          mileage_total_eur: 0,
          expenses_total_eur: 0,
          total_amount_eur: 30,
          balance_due_eur: 30,
          approved_by: "Ivan Horvat",
          expenses: [],
        },
        1
      );
    }, /ne pripada aktivnoj tvrtki/);

    // Verify Company 2's records are completely untouched
    assert.ok(getTravelOrderById(c2OrderId, 2));
    assert.equal(getEmployeeById(c2EmpId, 2)?.full_name, emp2[0].full_name);
    assert.equal(getVehicleById(c2VehId, 2)?.make_model, veh2[0].make_model);
    assert.ok(getLocoTripById(c2LocoId, 2));
  });

  it("sprječava company_admin i user uloge u prebacivanju na drugu tvrtku putem headera ili URL parametra", () => {
    const firma1Admin = authenticateUser("direktor@firma1.hr", "firma123")!;
    const token = createSessionToken({
      userId: firma1Admin.id,
      activeCompanyId: 1,
    });

    const reqWithHeaderAndQuery = new Request(
      "http://localhost:3000/api/employees?companyId=2",
      {
        headers: {
          cookie: `pn_session=${token}`,
          "x-company-id": "2",
        },
      }
    );

    const resolvedSession = getSessionFromRequest(reqWithHeaderAndQuery);
    assert.ok(resolvedSession);
    assert.equal(resolvedSession.activeCompanyId, 1);
    assert.equal(resolvedSession.activeCompany.id, 1);
  });

  it("trenutačno primjenjuje opoziv ovlasti i deaktivaciju korisnika na postojeću sesiju bez ponovne prijave", () => {
    const subUser = createUser({
      email: "live.session.test@firma1.hr",
      password: "lozinka123",
      full_name: "Testni Korisnik Sesije",
      role: "user",
      company_id: 1,
      permissions: {
        ...DEFAULT_USER_PERMISSIONS,
        canApproveTravelOrders: false,
        canManageLoco: false,
      },
    });

    try {
      const token = createSessionToken({
        userId: subUser.id,
        activeCompanyId: 1,
      });
      const makeReq = () =>
        new Request("http://localhost:3000/api/travel-orders", {
          headers: { cookie: `pn_session=${token}` },
        });

      // 1. Initial session permissions
      const s1 = getSessionFromRequest(makeReq());
      assert.ok(s1);
      assert.equal(hasPermission(s1, "canApproveTravelOrders"), false);
      assert.equal(hasPermission(s1, "canManageLoco"), false);

      // 2. Grant permissions while user keeps the exact same token
      updateUser(subUser.id, {
        permissions: {
          ...s1.user.permissions,
          canApproveTravelOrders: true,
          canManageLoco: true,
        },
      });

      const s2 = getSessionFromRequest(makeReq());
      assert.ok(s2);
      assert.equal(hasPermission(s2, "canApproveTravelOrders"), true);
      assert.equal(hasPermission(s2, "canManageLoco"), true);

      // 3. Deactivate user (active: 0) -> existing session token is immediately rejected
      updateUser(subUser.id, { active: 0 });
      const s3 = getSessionFromRequest(makeReq());
      assert.equal(s3, null);
    } finally {
      deleteUser(subUser.id);
    }
  });

  it("izvršava cjeloviti E2E poslovni tijek (Global Admin -> Company Admin -> Sub-user tuzemni i DE inozemni nalog -> Odobravanje -> Loko -> Backup/Restore)", () => {
    // 1. Global Admin creates a new company
    const testCompany = createCompany({
      name: "Testna Tvrtka d.o.o.",
      oib: "11122233344",
      address: "Ulica grada Vukovara 10",
      city: "10000 Zagreb",
      iban: "HR1123400091100999888",
      director_name: "Petar Perić",
      order_prefix: "TT",
    });

    let companyAdminId = 0;
    let subUserId = 0;

    try {
      assert.ok(testCompany.id > 2);
      assert.equal(listEmployees(testCompany.id).length, 0);
      assert.equal(listTravelOrders(testCompany.id).length, 0);

      // Create company_admin for Testna Tvrtka d.o.o.
      const compAdmin = createUser({
        email: "direktor@testna-tvrtka.hr",
        password: "direktor123",
        full_name: "Petar Perić",
        role: "company_admin",
        company_id: testCompany.id,
      });
      companyAdminId = compAdmin.id;
      assert.equal(compAdmin.company_id, testCompany.id);
      assert.deepEqual(compAdmin.permissions, ALL_PERMISSIONS);

      // 2. Company Admin updates settings, creates employee, vehicle, and sub-user
      const updatedSettings = updateCompanySettings(
        {
          name: "Testna Tvrtka d.o.o.",
          oib: "11122233344",
          address: "Strojarska cesta 20",
          city: "10000 Zagreb",
          iban: "HR1123400091100999888",
          director_name: "Petar Perić",
          order_prefix: "TT",
          per_diem_full: 30,
          per_diem_half: 15,
          mileage_rate: 0.5,
          min_distance_km: 30,
          meal_deduction_one_pct: 30,
          meal_deduction_two_pct: 60,
        },
        testCompany.id
      );
      assert.equal(updatedSettings.address, "Strojarska cesta 20");

      const emp = createEmployee(
        {
          full_name: "Ivan Babić",
          oib: "99887766554",
          job_title: "Inženjer prodaje",
          address: "Savska 50, Zagreb",
        },
        testCompany.id
      );
      assert.equal(emp.company_id, testCompany.id);

      const veh = createVehicle(
        {
          ownership_type: "PRIVATNO",
          make_model: "Mazda 3 2.0",
          license_plate: "ZG-1234-TT",
          employee_id: emp.id,
          current_odometer: 10000,
        },
        testCompany.id
      );
      assert.equal(veh.company_id, testCompany.id);

      const subUser = createUser({
        email: "referent@testna-tvrtka.hr",
        password: "referent123",
        full_name: "Maja Referent",
        role: "user",
        company_id: testCompany.id,
        permissions: {
          canManageTravelOrders: true,
          canApproveTravelOrders: false,
          canManageLoco: false,
          canManageMasterData: false,
          canViewAnalytics: true,
          canManageJoppd: false,
          canBackupRestore: false,
        },
      });
      subUserId = subUser.id;
      assert.equal(subUser.permissions.canManageTravelOrders, true);
      assert.equal(subUser.permissions.canApproveTravelOrders, false);
      assert.equal(subUser.permissions.canManageLoco, false);

      // 3. Sub-user creates domestic travel order & foreign (DE) travel order
      const domCalc = calculateTravelOrder(
        {
          issue_date: "2026-11-10",
          purpose: "Prezentacija sustava klijentu u Zadru",
          distance_km: 285,
          departure_at: "2026-11-11T07:00",
          return_at: "2026-11-11T21:00",
          transport_type: "PRIVATNO_VOZILO",
          odometer_start: 10000,
          odometer_end: 10570,
          one_meal_days: 0,
          two_meals_days: 0,
          advance_payment_eur: 0,
          expenses: [],
        },
        updatedSettings
      );
      assert.equal(domCalc.perDiem.netPerDiemEur, 30);
      assert.equal(domCalc.mileageTotalEur, 285);
      assert.equal(domCalc.totalAmountEur, 315);

      const domOrder = createTravelOrder(
        {
          status: normalizeOrderStatus("DRAFT")!,
          issue_date: "2026-11-10",
          employee_id: emp.id,
          purpose: "Prezentacija sustava klijentu u Zadru",
          origin: "Zagreb",
          destination: "Zadar",
          country_code: "HR",
          distance_km: 285,
          departure_at: "2026-11-11T07:00",
          return_at: "2026-11-11T21:00",
          transport_type: "PRIVATNO_VOZILO",
          vehicle_id: veh.id,
          odometer_start: 10000,
          odometer_end: 10570,
          total_km: domCalc.totalKm,
          one_meal_days: 0,
          two_meals_days: 0,
          advance_payment_eur: 0,
          trip_report: "Prezentacija uspješno održana.",
          per_diem_total_eur: domCalc.perDiem.netPerDiemEur,
          mileage_total_eur: domCalc.mileageTotalEur,
          expenses_total_eur: 0,
          total_amount_eur: domCalc.totalAmountEur,
          balance_due_eur: domCalc.balanceDueEur,
          approved_by: updatedSettings.director_name,
          expenses: [],
        },
        testCompany.id
      );
      assert.equal(domOrder.order_number, "TT-2026-001");
      assert.equal(domOrder.status, "NACRT");

      // Foreign travel order to Germany (DE - 70 EUR/day)
      const deCalc = calculateForeignPerDiem({
        countryCode: "DE",
        departureAt: "2026-11-12T06:00",
        returnAt: "2026-11-12T22:00",
        oneMealDays: 0,
        twoMealsDays: 0,
        domesticPerDiemEur: updatedSettings.per_diem_full,
      });
      assert.equal(deCalc.totalNetEur, 70);

      const deOrder = createTravelOrder(
        {
          status: "NACRT",
          issue_date: "2026-11-11",
          employee_id: emp.id,
          purpose: "Posjet sajmu u Münchenu i sastanak s dobavljačem",
          origin: "Zagreb",
          destination: "München",
          country_code: "DE",
          distance_km: 550,
          departure_at: "2026-11-12T06:00",
          return_at: "2026-11-12T22:00",
          transport_type: "SLUZBENO_VOZILO",
          vehicle_id: null,
          odometer_start: 0,
          odometer_end: 0,
          total_km: 0,
          one_meal_days: 0,
          two_meals_days: 0,
          advance_payment_eur: 0,
          trip_report: "",
          per_diem_total_eur: deCalc.totalNetEur,
          mileage_total_eur: 0,
          expenses_total_eur: 0,
          total_amount_eur: deCalc.totalNetEur,
          balance_due_eur: deCalc.totalNetEur,
          approved_by: updatedSettings.director_name,
          expenses: [],
        },
        testCompany.id
      );
      assert.equal(deOrder.country_code, "DE");
      assert.equal(deOrder.per_diem_total_eur, 70);

      // Status lifecycle transitions: DRAFT -> APPROVED -> LIQUIDATED -> PAID
      for (const rawStatus of ["APPROVED", "LIQUIDATED", "PAID"]) {
        const mapped = normalizeOrderStatus(rawStatus)!;
        const updatedOrd = updateTravelOrder(
          domOrder.id,
          {
            ...domOrder,
            status: mapped,
          },
          testCompany.id
        );
        assert.ok(updatedOrd);
        assert.equal(updatedOrd.status, mapped);
      }

      // Loco trip creation
      const loco = createLocoTrip(
        {
          trip_date: "2026-11-14",
          employee_id: emp.id,
          vehicle_id: veh.id,
          origin: "Strojarska 20",
          destination: "FINA Vukovarska",
          purpose: "Predaja dokumentacije",
          odometer_start: 10570,
          odometer_end: 10582,
          distance_km: 12,
          rate_eur: 0.5,
          amount_eur: 6,
          status: "EVIDENTIRANO",
        },
        testCompany.id
      );
      assert.equal(loco.amount_eur, 6);

      // 4. Backup & Restore verification + non-global-admin escalation block
      const companyBackup = exportCompanyBackup(
        testCompany.id,
        compAdmin.email
      );
      assert.equal(companyBackup.companyData.travelOrders.length, 2);

      // Delete one order and restore with replace & merge
      deleteTravelOrder(deOrder.id, testCompany.id);
      assert.equal(listTravelOrders(testCompany.id).length, 1);

      restoreBackup(companyBackup, {
        mode: "replace",
        targetCompanyId: testCompany.id,
        isGlobalAdmin: false,
      });
      assert.equal(listTravelOrders(testCompany.id).length, 2);

      restoreBackup(companyBackup, {
        mode: "merge",
        targetCompanyId: testCompany.id,
        isGlobalAdmin: false,
      });
      assert.equal(listTravelOrders(testCompany.id).length, 2);

      // Non-global admin attempting to restore scope: "all" or globalUsers must be rejected
      assert.throws(() => {
        restoreBackup(
          {
            ...companyBackup,
            scope: "all",
            allCompaniesData: [companyBackup.companyData],
          },
          {
            mode: "replace",
            targetCompanyId: testCompany.id,
            isGlobalAdmin: false,
          }
        );
      }, /FORBIDDEN/);
    } finally {
      if (subUserId) deleteUser(subUserId);
      if (companyAdminId) deleteUser(companyAdminId);
      deleteCompany(testCompany.id);
    }
  });

  it("štiti JOPPD XML i CSV izvoz od XML/Formula Injection napada", () => {
    const xmlEscaped = escapeXml(`<script>alert("xss")</script> & 'test'`);
    assert.equal(
      xmlEscaped,
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &apos;test&apos;"
    );

    // CSV formula injection prefixes (=, +, -, @) must be neutralized with leading single quote
    assert.equal(escapeCsvCell("=CMD|' /C calc'!A0"), "'=CMD|' /C calc'!A0");
    assert.equal(escapeCsvCell("+SUM(A1:A10)"), "'+SUM(A1:A10)");
    assert.equal(escapeCsvCell("@SUM(1+1)"), "'@SUM(1+1)");
    assert.equal(escapeCsvCell("-1+1"), "'-1+1");
    // Negative numbers remain unprefixed
    assert.equal(escapeCsvCell("-125,50"), "-125,50");

    const settings = getCompanySettings(1);
    const xml = generateJoppdXml(
      { ...settings, name: "Tvrtka <Test> & Co." },
      [
        {
          employeeId: 1,
          employeeName: 'Ivan <Horvat> "Jr."',
          employeeOib: "12345678901",
          code: "17",
          description: "Dnevnice",
          amountEur: 30,
          sourceCount: 1,
          sourceRefs: ["PN-2026-001"],
        },
      ],
      "2026-11-14"
    );
    assert.ok(xml.includes("Tvrtka &lt;Test&gt; &amp; Co."));
    assert.ok(xml.includes("Ivan &lt;Horvat&gt; &quot;Jr.&quot;"));

    const csv = generateJoppdCsv([
      {
        employeeId: 1,
        employeeName: "=1+1;Drop",
        employeeOib: "12345678901",
        code: "17",
        description: "Dnevnice",
        amountEur: 30,
        sourceCount: 1,
        sourceRefs: ["PN-2026-001"],
      },
    ]);
    assert.ok(csv.includes('"\'=1+1;Drop"'));
  });

  it("izvršava cjeloviti HTTP API audit svih ruta: neautenticirani pristup (401), RBAC zabrane (403), IDOR zaštita (404), Rate Limiting (429) i E2E scenariji", async () => {
    const loginRoute = await import("../app/api/auth/login/route.ts");
    const meRoute = await import("../app/api/auth/me/route.ts");
    const usersRoute = await import("../app/api/users/route.ts");
    const userByIdRoute = await import("../app/api/users/[id]/route.ts");
    const companiesRoute = await import("../app/api/companies/route.ts");
    const companyByIdRoute = await import("../app/api/companies/[id]/route.ts");
    const employeesRoute = await import("../app/api/employees/route.ts");
    const employeeByIdRoute = await import("../app/api/employees/[id]/route.ts");
    const vehiclesRoute = await import("../app/api/vehicles/route.ts");
    const vehicleByIdRoute = await import("../app/api/vehicles/[id]/route.ts");
    const settingsRoute = await import("../app/api/settings/route.ts");
    const ordersRoute = await import("../app/api/travel-orders/route.ts");
    const orderByIdRoute = await import("../app/api/travel-orders/[id]/route.ts");
    const locoRoute = await import("../app/api/loco-trips/route.ts");
    const locoByIdRoute = await import("../app/api/loco-trips/[id]/route.ts");
    const backupRoute = await import("../app/api/backup/route.ts");
    const restoreRoute = await import("../app/api/restore/route.ts");

    type RouteMod = Record<
      string,
      (req: Request, ctx?: { params: Promise<{ id: string }> }) => Promise<Response>
    >;

    async function apiCall(
      urlPath: string,
      opts: {
        method?: string;
        cookie?: string;
        headers?: Record<string, string>;
        body?: unknown;
      } = {}
    ) {
      const method = (opts.method || "GET").toUpperCase();
      const fullUrl = `http://localhost:3000${urlPath}`;
      const parsedUrl = new URL(fullUrl);
      const pathname = parsedUrl.pathname;

      const reqHeaders: Record<string, string> = { ...(opts.headers || {}) };
      if (opts.cookie) reqHeaders["cookie"] = opts.cookie;
      if (opts.body !== undefined) {
        reqHeaders["content-type"] = "application/json";
      }

      const req = new Request(fullUrl, {
        method,
        headers: reqHeaders,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });

      let mod: RouteMod | null = null;
      let idParam: string | null = null;

      if (pathname === "/api/auth/login") mod = loginRoute as unknown as RouteMod;
      else if (pathname === "/api/auth/me") mod = meRoute as unknown as RouteMod;
      else if (pathname === "/api/users") mod = usersRoute as unknown as RouteMod;
      else if (/^\/api\/users\/(\d+)$/.test(pathname)) {
        mod = userByIdRoute as unknown as RouteMod;
        idParam = pathname.split("/").pop()!;
      } else if (pathname === "/api/companies") {
        mod = companiesRoute as unknown as RouteMod;
      } else if (/^\/api\/companies\/(\d+)$/.test(pathname)) {
        mod = companyByIdRoute as unknown as RouteMod;
        idParam = pathname.split("/").pop()!;
      } else if (pathname === "/api/employees") {
        mod = employeesRoute as unknown as RouteMod;
      } else if (/^\/api\/employees\/(\d+)$/.test(pathname)) {
        mod = employeeByIdRoute as unknown as RouteMod;
        idParam = pathname.split("/").pop()!;
      } else if (pathname === "/api/vehicles") {
        mod = vehiclesRoute as unknown as RouteMod;
      } else if (/^\/api\/vehicles\/(\d+)$/.test(pathname)) {
        mod = vehicleByIdRoute as unknown as RouteMod;
        idParam = pathname.split("/").pop()!;
      } else if (pathname === "/api/settings") {
        mod = settingsRoute as unknown as RouteMod;
      } else if (pathname === "/api/travel-orders") {
        mod = ordersRoute as unknown as RouteMod;
      } else if (/^\/api\/travel-orders\/(\d+)$/.test(pathname)) {
        mod = orderByIdRoute as unknown as RouteMod;
        idParam = pathname.split("/").pop()!;
      } else if (pathname === "/api/loco-trips") {
        mod = locoRoute as unknown as RouteMod;
      } else if (/^\/api\/loco-trips\/(\d+)$/.test(pathname)) {
        mod = locoByIdRoute as unknown as RouteMod;
        idParam = pathname.split("/").pop()!;
      } else if (pathname === "/api/backup") {
        mod = backupRoute as unknown as RouteMod;
      } else if (pathname === "/api/restore") {
        mod = restoreRoute as unknown as RouteMod;
      }

      assert.ok(mod, `Unknown route: ${pathname}`);
      const handler = mod[method];
      assert.ok(handler, `Method ${method} not exported on ${pathname}`);

      const res = await handler(
        req,
        idParam ? { params: Promise.resolve({ id: idParam }) } : undefined
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      const setCookie = res.headers.get("set-cookie") || "";
      const match = /pn_session=([^;]+)/.exec(setCookie);
      const sessionCookie = match ? `pn_session=${match[1]}` : "";

      return {
        status: res.status,
        headers: res.headers,
        data,
        sessionCookie,
      };
    }

    async function apiLogin(
      email: string,
      password: string,
      headers: Record<string, string> = {}
    ) {
      return apiCall("/api/auth/login", {
        method: "POST",
        headers,
        body: { email, password },
      });
    }

    // 1. Unauthenticated API Access Audit (All 46 endpoints must return 401)
    const unauthMatrix: Array<[string, string, unknown?]> = [
      ["GET", "/api/auth/me"],
      ["POST", "/api/auth/me", { full_name: "Test" }],
      ["PATCH", "/api/auth/me", { full_name: "Test" }],
      ["GET", "/api/employees"],
      ["POST", "/api/employees", { full_name: "X", oib: "12345678901", job_title: "Y", address: "Z" }],
      ["GET", "/api/employees/1"],
      ["PUT", "/api/employees/1", { full_name: "X" }],
      ["PATCH", "/api/employees/1", { full_name: "X" }],
      ["DELETE", "/api/employees/1"],
      ["GET", "/api/vehicles"],
      ["POST", "/api/vehicles", { ownership_type: "SLUZBENO", make_model: "X", license_plate: "ZG-1" }],
      ["GET", "/api/vehicles/1"],
      ["PUT", "/api/vehicles/1", { make_model: "X" }],
      ["PATCH", "/api/vehicles/1", { make_model: "X" }],
      ["DELETE", "/api/vehicles/1"],
      ["GET", "/api/travel-orders"],
      ["POST", "/api/travel-orders", {}],
      ["GET", "/api/travel-orders/1"],
      ["PUT", "/api/travel-orders/1", {}],
      ["PATCH", "/api/travel-orders/1", {}],
      ["DELETE", "/api/travel-orders/1"],
      ["GET", "/api/loco-trips"],
      ["POST", "/api/loco-trips", {}],
      ["GET", "/api/loco-trips/1"],
      ["PUT", "/api/loco-trips/1", {}],
      ["PATCH", "/api/loco-trips/1", {}],
      ["DELETE", "/api/loco-trips/1"],
      ["GET", "/api/settings"],
      ["POST", "/api/settings", {}],
      ["PUT", "/api/settings", {}],
      ["PATCH", "/api/settings", {}],
      ["DELETE", "/api/settings"],
      ["GET", "/api/companies"],
      ["POST", "/api/companies", {}],
      ["GET", "/api/companies/1"],
      ["PUT", "/api/companies/1", {}],
      ["PATCH", "/api/companies/1", {}],
      ["DELETE", "/api/companies/1"],
      ["GET", "/api/users"],
      ["POST", "/api/users", {}],
      ["GET", "/api/users/1"],
      ["PUT", "/api/users/1", {}],
      ["PATCH", "/api/users/1", {}],
      ["DELETE", "/api/users/1"],
      ["GET", "/api/backup"],
      ["POST", "/api/restore", {}],
    ];

    for (const [method, url, body] of unauthMatrix) {
      const res = await apiCall(url, { method, body });
      assert.equal(
        res.status,
        401,
        `Expected 401 on unauthenticated ${method} ${url}, got ${res.status}`
      );
    }

    // 2. Brute-force Login Rate Limiting via POST /api/auth/login (429 after 10 failed attempts)
    clearAllLoginRateLimits();
    const attackerIp = "203.0.113.99";
    for (let i = 1; i <= 9; i++) {
      const failRes = await apiLogin("korisnik@firma1.hr", "pogresnaLozinka!", {
        "x-forwarded-for": attackerIp,
      });
      assert.equal(failRes.status, 401);
    }
    const tenthRes = await apiLogin("korisnik@firma1.hr", "pogresnaLozinka!", {
      "x-forwarded-for": attackerIp,
    });
    assert.equal(tenthRes.status, 429);
    assert.ok(tenthRes.headers.get("retry-after"));
    clearAllLoginRateLimits();

    // 3. Log in with the 4 demo accounts
    const globalLogin = await apiLogin("admin@sustav.hr", "admin123");
    assert.equal(globalLogin.status, 200);
    const globalCookie = globalLogin.sessionCookie;

    const c1AdminLogin = await apiLogin("direktor@firma1.hr", "firma123");
    assert.equal(c1AdminLogin.status, 200);
    const c1AdminCookie = c1AdminLogin.sessionCookie;

    const c1UserLogin = await apiLogin("korisnik@firma1.hr", "korisnik123");
    assert.equal(c1UserLogin.status, 200);
    const c1UserCookie = c1UserLogin.sessionCookie;

    const c2AdminLogin = await apiLogin("direktor@firma2.hr", "firma234");
    assert.equal(c2AdminLogin.status, 200);
    const c2AdminCookie = c2AdminLogin.sessionCookie;

    let tempCompanyId: number | null = null;
    const createdUserIds: number[] = [];

    try {
      // 4. Negative RBAC Security Testing
      // 4a. Without canApproveTravelOrders: cannot create order with status APPROVED or PAID
      const postApproved = await apiCall("/api/travel-orders", {
        method: "POST",
        cookie: c1UserCookie,
        body: {
          employee_id: 1,
          issue_date: "2026-11-14",
          purpose: "Sastanak u Rijeci",
          origin: "Zagreb",
          destination: "Rijeka",
          distance_km: 165,
          departure_at: "2026-11-15T08:00",
          return_at: "2026-11-15T20:00",
          transport_type: "SLUZBENO_VOZILO",
          status: "APPROVED",
        },
      });
      assert.equal(postApproved.status, 403);

      const postPaid = await apiCall("/api/travel-orders", {
        method: "POST",
        cookie: c1UserCookie,
        body: {
          employee_id: 1,
          issue_date: "2026-11-14",
          purpose: "Sastanak u Rijeci",
          origin: "Zagreb",
          destination: "Rijeka",
          distance_km: 165,
          departure_at: "2026-11-15T08:00",
          return_at: "2026-11-15T20:00",
          transport_type: "SLUZBENO_VOZILO",
          status: "PAID",
        },
      });
      assert.equal(postPaid.status, 403);

      // Create valid DRAFT order as korisnik@firma1.hr
      const draftOrderRes = await apiCall("/api/travel-orders", {
        method: "POST",
        cookie: c1UserCookie,
        body: {
          employee_id: 1,
          issue_date: "2026-11-14",
          purpose: "Sastanak u Rijeci",
          origin: "Zagreb",
          destination: "Rijeka",
          distance_km: 165,
          departure_at: "2026-11-15T08:00",
          return_at: "2026-11-15T21:00",
          transport_type: "SLUZBENO_VOZILO",
        },
      });
      assert.equal(draftOrderRes.status, 201);
      const draftId = draftOrderRes.data.id;

      // User with canManageTravelOrders can edit non-status fields of DRAFT order
      const editDraft = await apiCall(`/api/travel-orders/${draftId}`, {
        method: "PATCH",
        cookie: c1UserCookie,
        body: { purpose: "Dopunjena svrha sastanka u Rijeci" },
      });
      assert.equal(editDraft.status, 200);
      assert.equal(editDraft.data.purpose, "Dopunjena svrha sastanka u Rijeci");

      // User without canApproveTravelOrders CANNOT PATCH status to APPROVED
      const patchApprove = await apiCall(`/api/travel-orders/${draftId}`, {
        method: "PATCH",
        cookie: c1UserCookie,
        body: { status: "APPROVED" },
      });
      assert.equal(patchApprove.status, 403);

      // 4b. Approver-only user (canApproveTravelOrders: true, canManageTravelOrders: false)
      const approverUserRes = await apiCall("/api/users", {
        method: "POST",
        cookie: c1AdminCookie,
        body: {
          email: "voditelj.test@firma1.hr",
          password: "voditelj123",
          full_name: "Voditelj Odobravanja",
          role: "user",
          company_id: 1,
          permissions: {
            canManageTravelOrders: false,
            canApproveTravelOrders: true,
            canManageLoco: false,
            canManageMasterData: false,
            canViewAnalytics: true,
            canManageJoppd: false,
            canBackupRestore: false,
          },
        },
      });
      assert.equal(approverUserRes.status, 201);
      createdUserIds.push(approverUserRes.data.id);

      const approverCookie = (
        await apiLogin("voditelj.test@firma1.hr", "voditelj123")
      ).sessionCookie;

      // Approver-only user cannot create, delete, or edit non-status fields of a travel order
      assert.equal(
        (
          await apiCall("/api/travel-orders", {
            method: "POST",
            cookie: approverCookie,
            body: {
              employee_id: 1,
              issue_date: "2026-11-14",
              purpose: "Novi nalog",
              origin: "Zagreb",
              destination: "Split",
              distance_km: 400,
              departure_at: "2026-11-15T08:00",
              return_at: "2026-11-15T20:00",
            },
          })
        ).status,
        403
      );
      assert.equal(
        (
          await apiCall(`/api/travel-orders/${draftId}`, {
            method: "PATCH",
            cookie: approverCookie,
            body: { status: "APPROVED", purpose: "Nedopuštena izmjena" },
          })
        ).status,
        403
      );
      assert.equal(
        (
          await apiCall(`/api/travel-orders/${draftId}`, {
            method: "DELETE",
            cookie: approverCookie,
          })
        ).status,
        403
      );

      // Approver-only user CAN approve status-only via PATCH
      const approveOnlyRes = await apiCall(`/api/travel-orders/${draftId}`, {
        method: "PATCH",
        cookie: approverCookie,
        body: { status: "APPROVED" },
      });
      assert.equal(approveOnlyRes.status, 200);
      assert.equal(approveOnlyRes.data.status, "ODOBREN");

      // Clean up draftId
      await apiCall(`/api/travel-orders/${draftId}`, {
        method: "DELETE",
        cookie: c1AdminCookie,
      });

      // 4c. Zero-permission user -> 403 on all write & backup endpoints
      const zeroUserRes = await apiCall("/api/users", {
        method: "POST",
        cookie: c1AdminCookie,
        body: {
          email: "zero.test@firma1.hr",
          password: "zero123",
          full_name: "Zero Korisnik",
          role: "user",
          company_id: 1,
          permissions: {
            canManageTravelOrders: false,
            canApproveTravelOrders: false,
            canManageLoco: false,
            canManageMasterData: false,
            canViewAnalytics: false,
            canManageJoppd: false,
            canBackupRestore: false,
          },
        },
      });
      assert.equal(zeroUserRes.status, 201);
      createdUserIds.push(zeroUserRes.data.id);
      const zeroCookie = (await apiLogin("zero.test@firma1.hr", "zero123"))
        .sessionCookie;

      const zeroMatrix: Array<[string, string, unknown?]> = [
        ["POST", "/api/travel-orders", { employee_id: 1 }],
        ["PATCH", "/api/travel-orders/1", { status: "APPROVED" }],
        ["PUT", "/api/travel-orders/1", { status: "APPROVED" }],
        ["DELETE", "/api/travel-orders/1"],
        ["POST", "/api/loco-trips", { trip_date: "2026-11-14" }],
        ["PUT", "/api/loco-trips/1", { status: "ISPLACENO" }],
        ["PATCH", "/api/loco-trips/1", { status: "ISPLACENO" }],
        ["DELETE", "/api/loco-trips/1"],
        ["POST", "/api/employees", { full_name: "X", oib: "123", job_title: "Y" }],
        ["PUT", "/api/employees/1", { full_name: "X" }],
        ["PATCH", "/api/employees/1", { full_name: "X" }],
        ["DELETE", "/api/employees/1"],
        ["POST", "/api/vehicles", { ownership_type: "SLUZBENO", make_model: "X", license_plate: "ZG-1" }],
        ["PUT", "/api/vehicles/1", { make_model: "X" }],
        ["PATCH", "/api/vehicles/1", { make_model: "X" }],
        ["DELETE", "/api/vehicles/1"],
        ["POST", "/api/settings", { name: "X", oib: "123" }],
        ["PUT", "/api/settings", { name: "X", oib: "123" }],
        ["PATCH", "/api/settings", { name: "X" }],
        ["DELETE", "/api/settings"],
        ["PUT", "/api/companies/1", { name: "X" }],
        ["PATCH", "/api/companies/1", { name: "X" }],
        ["DELETE", "/api/companies/1"],
        ["GET", "/api/backup"],
        ["POST", "/api/restore", {}],
      ];

      for (const [method, url, body] of zeroMatrix) {
        const res = await apiCall(url, { method, cookie: zeroCookie, body });
        assert.equal(res.status, 403, `Expected 403 on ${method} ${url}`);
      }

      // 4d. User with all 7 module permissions still gets 403 on User/Company Admin endpoints
      const superRefRes = await apiCall("/api/users", {
        method: "POST",
        cookie: c1AdminCookie,
        body: {
          email: "superref.test@firma1.hr",
          password: "super123",
          full_name: "Super Referent",
          role: "user",
          company_id: 1,
          permissions: ALL_PERMISSIONS,
        },
      });
      assert.equal(superRefRes.status, 201);
      createdUserIds.push(superRefRes.data.id);
      const superRefCookie = (
        await apiLogin("superref.test@firma1.hr", "super123")
      ).sessionCookie;

      for (const [method, url, body] of [
        ["GET", "/api/users"],
        ["POST", "/api/users", { email: "a@b.hr", full_name: "A", password: "123" }],
        ["GET", "/api/users/1"],
        ["PATCH", "/api/users/3", { full_name: "X" }],
        ["DELETE", "/api/users/3"],
        ["POST", "/api/companies", { name: "Nova", oib: "12345678901" }],
        ["DELETE", "/api/companies/1"],
        ["POST", "/api/auth/me", { role: "global_admin" }],
      ] as Array<[string, string, unknown?]>) {
        const res = await apiCall(url, {
          method,
          cookie: superRefCookie,
          body,
        });
        assert.equal(res.status, 403);
      }

      // 4e. Company Admin of Company 1 Escalation & Cross-Tenant Checks
      for (const [method, url, body] of [
        ["GET", "/api/users?companyId=2"],
        ["GET", "/api/users/4"],
        ["PATCH", "/api/users/4", { full_name: "Hacked" }],
        ["DELETE", "/api/users/4"],
        ["POST", "/api/users", { email: "e1@f1.hr", full_name: "E1", password: "123", role: "global_admin" }],
        ["POST", "/api/users", { email: "e2@f2.hr", full_name: "E2", password: "123", role: "user", company_id: 2 }],
        ["PATCH", "/api/users/3", { role: "global_admin" }],
        ["PATCH", "/api/users/3", { company_id: 2 }],
        ["POST", "/api/auth/me", { activeCompanyId: 2 }],
        ["POST", "/api/auth/me", { role: "global_admin" }],
        ["GET", "/api/companies/2"],
        ["PATCH", "/api/companies/2", { name: "Hacked" }],
        ["DELETE", "/api/companies/2"],
        ["GET", "/api/backup?scope=all"],
        ["GET", "/api/backup?companyId=2"],
        ["POST", "/api/restore", { scope: "all", allCompaniesData: [] }],
        ["POST", "/api/restore", { targetCompanyId: 2, companyData: {} }],
      ] as Array<[string, string, unknown?]>) {
        const res = await apiCall(url, {
          method,
          cookie: c1AdminCookie,
          body,
        });
        assert.equal(res.status, 403, `Expected 403 on ${method} ${url}`);
      }

      // 5. Cross-Tenant IDOR Audit via API routes (Company 1 Admin attacking Company 2 IDs)
      const c2OrdId = (await apiCall("/api/travel-orders", { cookie: c2AdminCookie })).data[0].id;
      const c2EmpId = (await apiCall("/api/employees", { cookie: c2AdminCookie })).data[0].id;
      const c2VehId = (await apiCall("/api/vehicles", { cookie: c2AdminCookie })).data[0].id;
      const c2LocoId = (await apiCall("/api/loco-trips", { cookie: c2AdminCookie })).data[0].id;

      for (const [method, url, body] of [
        ["GET", `/api/travel-orders/${c2OrdId}`],
        ["PATCH", `/api/travel-orders/${c2OrdId}`, { status: "PAID" }],
        ["PUT", `/api/travel-orders/${c2OrdId}`, { status: "PAID" }],
        ["DELETE", `/api/travel-orders/${c2OrdId}`],
        ["GET", `/api/employees/${c2EmpId}`],
        ["PUT", `/api/employees/${c2EmpId}`, { full_name: "IDOR" }],
        ["PATCH", `/api/employees/${c2EmpId}`, { full_name: "IDOR" }],
        ["DELETE", `/api/employees/${c2EmpId}`],
        ["GET", `/api/vehicles/${c2VehId}`],
        ["PUT", `/api/vehicles/${c2VehId}`, { make_model: "IDOR" }],
        ["PATCH", `/api/vehicles/${c2VehId}`, { make_model: "IDOR" }],
        ["DELETE", `/api/vehicles/${c2VehId}`],
        ["GET", `/api/loco-trips/${c2LocoId}`],
        ["PATCH", `/api/loco-trips/${c2LocoId}`, { status: "ISPLACENO" }],
        ["PUT", `/api/loco-trips/${c2LocoId}`, { status: "ISPLACENO" }],
        ["DELETE", `/api/loco-trips/${c2LocoId}`],
      ] as Array<[string, string, unknown?]>) {
        const res = await apiCall(url, {
          method,
          cookie: c1AdminCookie,
          body,
        });
        assert.equal(res.status, 404, `Expected 404 on IDOR ${method} ${url}`);
      }

      // 6. Full E2E HTTP Workflow (Global Admin -> Company Admin -> Sub-user Dynamic Permissions & Deactivation -> Backup/Restore)
      const newCompRes = await apiCall("/api/companies", {
        method: "POST",
        cookie: globalCookie,
        body: {
          name: "E2E Testna Tvrtka d.o.o.",
          oib: "44455566677",
          address: "Vukovarska 200",
          city: "10000 Zagreb",
          iban: "HR4423400091100444555",
          director_name: "Nikola Babić",
          order_prefix: "ET",
        },
      });
      assert.equal(newCompRes.status, 201);
      tempCompanyId = newCompRes.data.id;

      const switchedGlobal = await apiCall("/api/auth/me", {
        method: "POST",
        cookie: globalCookie,
        body: { activeCompanyId: tempCompanyId },
      });
      assert.equal(switchedGlobal.status, 200);
      assert.equal(switchedGlobal.data.activeCompanyId, tempCompanyId);

      const newCompAdmin = await apiCall("/api/users", {
        method: "POST",
        cookie: switchedGlobal.sessionCookie,
        body: {
          email: "direktor@e2e-tvrtka.hr",
          password: "e2edirektor123",
          full_name: "Nikola Babić",
          role: "company_admin",
          company_id: tempCompanyId,
        },
      });
      assert.equal(newCompAdmin.status, 201);
      createdUserIds.push(newCompAdmin.data.id);

      const e2eAdminCookie = (
        await apiLogin("direktor@e2e-tvrtka.hr", "e2edirektor123")
      ).sessionCookie;

      const e2eEmp = await apiCall("/api/employees", {
        method: "POST",
        cookie: e2eAdminCookie,
        body: {
          full_name: "Davor Horvat",
          oib: "33322211100",
          job_title: "Konzultant",
          address: "Ilica 10, Zagreb",
        },
      });
      assert.equal(e2eEmp.status, 201);

      const e2eVeh = await apiCall("/api/vehicles", {
        method: "POST",
        cookie: e2eAdminCookie,
        body: {
          ownership_type: "PRIVATNO",
          make_model: "Škoda Karoq",
          license_plate: "ZG-9999-ET",
          employee_id: e2eEmp.data.id,
          current_odometer: 20000,
        },
      });
      assert.equal(e2eVeh.status, 201);

      const e2eSubUser = await apiCall("/api/users", {
        method: "POST",
        cookie: e2eAdminCookie,
        body: {
          email: "korisnik@e2e-tvrtka.hr",
          password: "e2ekorisnik123",
          full_name: "Davor Horvat",
          role: "user",
          company_id: tempCompanyId,
          permissions: {
            canManageTravelOrders: true,
            canApproveTravelOrders: false,
            canManageLoco: false,
            canManageMasterData: false,
            canViewAnalytics: true,
            canManageJoppd: false,
            canBackupRestore: false,
          },
        },
      });
      assert.equal(e2eSubUser.status, 201);
      createdUserIds.push(e2eSubUser.data.id);

      const e2eSubCookie = (
        await apiLogin("korisnik@e2e-tvrtka.hr", "e2ekorisnik123")
      ).sessionCookie;

      // Sub-user creates domestic order & foreign DE order
      const e2eDomOrd = await apiCall("/api/travel-orders", {
        method: "POST",
        cookie: e2eSubCookie,
        body: {
          employee_id: e2eEmp.data.id,
          issue_date: "2026-11-10",
          purpose: "Edukacija korisnika u Osijeku",
          origin: "Zagreb",
          destination: "Osijek",
          distance_km: 280,
          departure_at: "2026-11-11T06:00",
          return_at: "2026-11-11T21:00",
          transport_type: "PRIVATNO_VOZILO",
          vehicle_id: e2eVeh.data.id,
          odometer_start: 20000,
          odometer_end: 20560,
        },
      });
      assert.equal(e2eDomOrd.status, 201);
      assert.equal(e2eDomOrd.data.per_diem_total_eur, 30);
      assert.equal(e2eDomOrd.data.mileage_total_eur, 280);

      const e2eDeOrd = await apiCall("/api/travel-orders", {
        method: "POST",
        cookie: e2eSubCookie,
        body: {
          employee_id: e2eEmp.data.id,
          issue_date: "2026-11-12",
          purpose: "Sajam IT opreme u Berlinu",
          origin: "Zagreb",
          destination: "Berlin",
          country_code: "DE",
          distance_km: 950,
          departure_at: "2026-11-13T06:00",
          return_at: "2026-11-13T22:00",
          transport_type: "JAVNI_PRIJEVOZ",
        },
      });
      assert.equal(e2eDeOrd.status, 201);
      assert.equal(e2eDeOrd.data.per_diem_total_eur, 70);

      // Sub-user blocked from approving or creating loco trip
      assert.equal(
        (
          await apiCall(`/api/travel-orders/${e2eDomOrd.data.id}`, {
            method: "PATCH",
            cookie: e2eSubCookie,
            body: { status: "APPROVED" },
          })
        ).status,
        403
      );
      assert.equal(
        (
          await apiCall("/api/loco-trips", {
            method: "POST",
            cookie: e2eSubCookie,
            body: {
              trip_date: "2026-11-14",
              employee_id: e2eEmp.data.id,
              vehicle_id: e2eVeh.data.id,
              origin: "Ured",
              destination: "Klijent",
              purpose: "Sastanak",
              distance_km: 15,
            },
          })
        ).status,
        403
      );

      // Grant permissions dynamically
      await apiCall(`/api/users/${e2eSubUser.data.id}`, {
        method: "PATCH",
        cookie: e2eAdminCookie,
        body: {
          permissions: {
            canManageTravelOrders: true,
            canApproveTravelOrders: true,
            canManageLoco: true,
            canManageMasterData: false,
            canViewAnalytics: true,
            canManageJoppd: false,
            canBackupRestore: false,
          },
        },
      });

      // Existing sub-user session immediately transitions DRAFT -> APPROVED -> LIQUIDATED -> PAID
      for (const [stIn, stOut] of [
        ["APPROVED", "ODOBREN"],
        ["LIQUIDATED", "OBRACUNAT"],
        ["PAID", "ISPLACEN"],
      ]) {
        const res = await apiCall(`/api/travel-orders/${e2eDomOrd.data.id}`, {
          method: "PATCH",
          cookie: e2eSubCookie,
          body: { status: stIn },
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.status, stOut);
      }

      // Existing sub-user session creates loco trip
      const locoOk = await apiCall("/api/loco-trips", {
        method: "POST",
        cookie: e2eSubCookie,
        body: {
          trip_date: "2026-11-14",
          employee_id: e2eEmp.data.id,
          vehicle_id: e2eVeh.data.id,
          origin: "Ured",
          destination: "Klijent",
          purpose: "Sastanak",
          distance_km: 15,
        },
      });
      assert.equal(locoOk.status, 201);
      assert.equal(locoOk.data.amount_eur, 7.5);

      // Deactivate sub-user -> immediate 401 on existing session
      await apiCall(`/api/users/${e2eSubUser.data.id}`, {
        method: "PATCH",
        cookie: e2eAdminCookie,
        body: { active: 0 },
      });
      assert.equal(
        (await apiCall("/api/travel-orders", { cookie: e2eSubCookie })).status,
        401
      );

      // Backup & Restore via API routes
      const bkp = await apiCall("/api/backup", { cookie: e2eAdminCookie });
      assert.equal(bkp.status, 200);
      await apiCall(`/api/travel-orders/${e2eDomOrd.data.id}`, {
        method: "DELETE",
        cookie: e2eAdminCookie,
      });

      const restReplace = await apiCall("/api/restore", {
        method: "POST",
        cookie: e2eAdminCookie,
        body: { mode: "replace", backup: bkp.data },
      });
      assert.equal(restReplace.status, 200);
      assert.equal(restReplace.data.summary.ordersRestored, 2);

      const restMerge = await apiCall("/api/restore", {
        method: "POST",
        cookie: e2eAdminCookie,
        body: { mode: "merge", backup: bkp.data },
      });
      assert.equal(restMerge.status, 200);
    } finally {
      for (const uid of createdUserIds) {
        await apiCall(`/api/users/${uid}`, {
          method: "DELETE",
          cookie: globalCookie,
        });
      }
      if (tempCompanyId) {
        await apiCall(`/api/companies/${tempCompanyId}`, {
          method: "DELETE",
          cookie: globalCookie,
        });
      }

      // Verify clean demo state: 2 companies, 4 demo users
      assert.equal(listCompanies().length, 2);
      assert.equal(listUsers().length, 4);
    }
  });
});
