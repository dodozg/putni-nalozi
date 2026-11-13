import type {
  CompanySettings,
  Employee,
  LocoStatus,
  LocoTrip,
  OrderStatus,
  TravelOrder,
} from "./types";

export type JoppdCode = "17" | "18" | "19";

export const JOPPD_CODE_DESCRIPTIONS: Record<JoppdCode, string> = {
  "17": "Dnevnice za službena putovanja u tuzemstvu i inozemstvu",
  "18": "Naknade za korištenje privatnog automobila u službene svrhe (0,50 €/km)",
  "19": "Troškovi noćenja na službenom putu, cestarine i javni prijevoz",
};

export interface JoppdRecord {
  employeeId: number;
  employeeName: string;
  employeeOib: string;
  code: JoppdCode;
  description: string;
  amountEur: number;
  sourceCount: number;
  sourceRefs: string[];
}

export interface BuildJoppdOptions {
  orderStatuses?: OrderStatus[];
  locoStatuses?: LocoStatus[];
}

const DEFAULT_ORDER_STATUSES: OrderStatus[] = ["OBRACUNAT", "ISPLACEN"];
const DEFAULT_LOCO_STATUSES: LocoStatus[] = ["ISPLACENO"];

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeXml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? "");
  if (str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Računa JOPPD oznaku izvješća u formatu YYDDD (godina + redni dan u godini).
 */
export function formatJoppdReportLabel(reportDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(reportDate || "");
  if (!match) return "26001";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.floor((current - start) / (1000 * 60 * 60 * 24)) + 1;
  const yy = String(year).slice(-2);
  const ddd = String(Math.max(1, dayOfYear)).padStart(3, "0");
  return `${yy}${ddd}`;
}

/**
 * Grupira obračunate/isplaćene neoporezive primitke iz putnih naloga i loko vožnje
 * po zaposleniku i JOPPD šifri primitka (17, 18, 19).
 */
export function buildJoppdRecords(
  orders: TravelOrder[],
  locoTrips: LocoTrip[],
  employees: Employee[],
  monthFilter?: string,
  options?: BuildJoppdOptions
): JoppdRecord[] {
  const allowedOrderStatuses = new Set<OrderStatus>(
    options?.orderStatuses ?? DEFAULT_ORDER_STATUSES
  );
  const allowedLocoStatuses = new Set<LocoStatus>(
    options?.locoStatuses ?? DEFAULT_LOCO_STATUSES
  );
  const normalizedMonth =
    monthFilter && monthFilter !== "ALL" ? monthFilter.trim() : "";

  const employeeMap = new Map<number, Employee>();
  for (const emp of employees) {
    employeeMap.set(emp.id, emp);
  }

  const grouped = new Map<string, JoppdRecord>();

  const addAmount = (
    employeeId: number,
    fallbackName: string | undefined,
    fallbackOib: string | undefined,
    code: JoppdCode,
    amount: number,
    ref: string
  ) => {
    const cleanAmount = round2(Number(amount) || 0);
    if (cleanAmount <= 0) return;

    const emp = employeeMap.get(employeeId);
    const employeeName = emp?.full_name || fallbackName || `Zaposlenik #${employeeId}`;
    const employeeOib = emp?.oib || fallbackOib || "";
    const key = `${employeeId}::${code}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.amountEur = round2(existing.amountEur + cleanAmount);
      existing.sourceCount += 1;
      if (ref && !existing.sourceRefs.includes(ref)) {
        existing.sourceRefs.push(ref);
      }
    } else {
      grouped.set(key, {
        employeeId,
        employeeName,
        employeeOib,
        code,
        description: JOPPD_CODE_DESCRIPTIONS[code],
        amountEur: cleanAmount,
        sourceCount: 1,
        sourceRefs: ref ? [ref] : [],
      });
    }
  };

  for (const order of orders) {
    if (!allowedOrderStatuses.has(order.status)) continue;
    if (normalizedMonth) {
      const orderMonth = (order.issue_date || order.departure_at || "").slice(0, 7);
      if (orderMonth !== normalizedMonth) continue;
    }

    const ref = order.order_number || `PN-${order.id}`;

    // Šifra 17: Dnevnice
    if ((order.per_diem_total_eur || 0) > 0) {
      addAmount(
        order.employee_id,
        order.employee_name,
        order.employee_oib,
        "17",
        order.per_diem_total_eur,
        ref
      );
    }

    // Šifra 18: Naknada za korištenje privatnog automobila (0,50 €/km)
    if ((order.mileage_total_eur || 0) > 0) {
      addAmount(
        order.employee_id,
        order.employee_name,
        order.employee_oib,
        "18",
        order.mileage_total_eur,
        ref
      );
    }

    // Šifra 19: Noćenja, cestarine, javni prijevoz, parking i ostali putni troškovi
    if ((order.expenses_total_eur || 0) > 0) {
      addAmount(
        order.employee_id,
        order.employee_name,
        order.employee_oib,
        "19",
        order.expenses_total_eur,
        ref
      );
    }
  }

  for (const trip of locoTrips) {
    if (!allowedLocoStatuses.has(trip.status)) continue;
    if (normalizedMonth) {
      const tripMonth = (trip.trip_date || "").slice(0, 7);
      if (tripMonth !== normalizedMonth) continue;
    }

    const ref = `LOKO-${trip.id}`;

    // Šifra 18: Loko vožnja privatnim automobilom (0,50 €/km)
    if ((trip.amount_eur || 0) > 0) {
      addAmount(
        trip.employee_id,
        trip.employee_name,
        trip.employee_oib,
        "18",
        trip.amount_eur,
        ref
      );
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const nameCmp = a.employeeName.localeCompare(b.employeeName, "hr");
    if (nameCmp !== 0) return nameCmp;
    return a.code.localeCompare(b.code);
  });
}

/**
 * Generira valjanu XML strukturu hrvatskog JOPPD obrasca (Stranica A + Stranica B).
 */
export function generateJoppdXml(
  settings: CompanySettings,
  records: JoppdRecord[],
  reportDate: string
): string {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(reportDate)
    ? reportDate
    : new Date().toISOString().slice(0, 10);
  const oznakaIzvjesca = formatJoppdReportLabel(safeDate);
  const uniqueEmployees = new Set(
    records.map((r) => r.employeeOib || String(r.employeeId))
  );
  const totalAmount = round2(
    records.reduce((sum, r) => sum + (Number(r.amountEur) || 0), 0)
  );

  const rowsXml = records
    .map((rec, index) => {
      const rbr = index + 1;
      const amountStr = round2(rec.amountEur).toFixed(2);
      return `      <P>
        <P1>${rbr}</P1>
        <P2>01333</P2>
        <P3>01333</P3>
        <P4>${escapeXml(rec.employeeOib)}</P4>
        <P5>${escapeXml(rec.employeeName)}</P5>
        <P151>${escapeXml(rec.code)}</P151>
        <P152>${amountStr}</P152>
        <P161>1</P161>
        <P162>${amountStr}</P162>
      </P>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ObrazacJOPPD xmlns="http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacJOPPD/v1-1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Metapodaci>
    <Naslov>Izvješće o primicima, porezu na dohodak i prirezu te doprinosima za obvezna osiguranja</Naslov>
    <Autor>${escapeXml(settings.name)}</Autor>
    <Datum>${safeDate}T00:00:00</Datum>
    <Format>text/xml</Format>
    <Jezik>hr-HR</Jezik>
    <Identifikator>${oznakaIzvjesca}</Identifikator>
    <Uskladjenost>ObrazacJOPPD-v1-1</Uskladjenost>
    <Tip>Elektronički obrazac</Tip>
    <Adresant>Ministarstvo Financija, Porezna uprava, Zagreb</Adresant>
  </Metapodaci>
  <StranaA>
    <DatumIzvjesca>${safeDate}</DatumIzvjesca>
    <OznakaIzvjesca>${oznakaIzvjesca}</OznakaIzvjesca>
    <VrstaIzvjesca>1</VrstaIzvjesca>
    <PodnositeljIzvjesca>
      <Naziv>${escapeXml(settings.name)}</Naziv>
      <OIB>${escapeXml(settings.oib)}</OIB>
      <Adresa>
        <Mjesto>${escapeXml(settings.city)}</Mjesto>
        <Ulica>${escapeXml(settings.address)}</Ulica>
      </Adresa>
      <Oznaka>1</Oznaka>
    </PodnositeljIzvjesca>
    <BrojOsoba>${uniqueEmployees.size}</BrojOsoba>
    <BrojRedaka>${records.length}</BrojRedaka>
    <NeoporeziviPrimiciUkupno>${totalAmount.toFixed(2)}</NeoporeziviPrimiciUkupno>
    <IzvjesceSastavio>
      <Ime>${escapeXml(settings.director_name)}</Ime>
    </IzvjesceSastavio>
  </StranaA>
  <StranaB>
    <Primatelji>
${rowsXml}
    </Primatelji>
  </StranaB>
</ObrazacJOPPD>
`;
}

/**
 * Generira CSV tablicu JOPPD pregleda s UTF-8 BOM-om za ispravan prikaz u Excelu.
 */
export function generateJoppdCsv(records: JoppdRecord[]): string {
  const header = [
    "Rbr",
    "Zaposlenik",
    "OIB",
    "Šifra primitka",
    "Opis neoporezivog primitka",
    "Iznos (EUR)",
    "Broj dokumenata",
    "Dokumenti",
  ]
    .map(escapeCsvCell)
    .join(";");

  const lines = records.map((rec, index) =>
    [
      index + 1,
      rec.employeeName,
      rec.employeeOib,
      rec.code,
      rec.description,
      round2(rec.amountEur).toFixed(2),
      rec.sourceCount,
      rec.sourceRefs.join(", "),
    ]
      .map(escapeCsvCell)
      .join(";")
  );

  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}
