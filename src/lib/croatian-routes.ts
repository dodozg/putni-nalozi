export interface CityNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  isHub?: boolean;
}

export interface RouteWaypoint {
  name: string;
  lat: number;
  lng: number;
  highway?: string;
}

export interface OptimalRouteResult {
  origin: CityNode;
  destination: CityNode;
  waypoints: RouteWaypoint[];
  smoothPath: { lat: number; lng: number }[];
  distanceKm: number;
  durationMinutes: number;
  estimatedTollEur: number;
  highwaysUsed: string[];
  routeSummary: string;
}

export interface MultiStopLeg {
  index: number;
  from: CityNode;
  to: CityNode;
  distanceKm: number;
  durationMinutes: number;
  estimatedTollEur: number;
  highwaysUsed: string[];
}

export interface MultiStopRouteResult {
  stops: CityNode[];
  legs: MultiStopLeg[];
  waypoints: RouteWaypoint[];
  smoothPath: { lat: number; lng: number }[];
  totalDistanceKm: number;
  maxDistanceFromOriginKm: number;
  totalDurationMinutes: number;
  totalTollEur: number;
  highwaysUsed: string[];
  relationString: string;
}

export const CROATIAN_CITIES: CityNode[] = [
  { id: "zagreb", name: "Zagreb", lat: 45.815, lng: 15.9819, region: "Središnja Hrvatska", isHub: true },
  { id: "split", name: "Split", lat: 43.5081, lng: 16.4402, region: "Dalmacija", isHub: true },
  { id: "rijeka", name: "Rijeka", lat: 45.3271, lng: 14.4422, region: "Kvarner", isHub: true },
  { id: "osijek", name: "Osijek", lat: 45.555, lng: 18.6955, region: "Slavonija", isHub: true },
  { id: "zadar", name: "Zadar", lat: 44.1194, lng: 15.2314, region: "Dalmacija", isHub: true },
  { id: "pula", name: "Pula", lat: 44.8666, lng: 13.8496, region: "Istra", isHub: true },
  { id: "slavonski_brod", name: "Slavonski Brod", lat: 45.1603, lng: 18.0156, region: "Slavonija" },
  { id: "karlovac", name: "Karlovac", lat: 45.4929, lng: 15.5553, region: "Središnja Hrvatska" },
  { id: "varazdin", name: "Varaždin", lat: 46.3057, lng: 16.3366, region: "Sjeverna Hrvatska", isHub: true },
  { id: "sibenik", name: "Šibenik", lat: 43.735, lng: 15.8952, region: "Dalmacija" },
  { id: "dubrovnik", name: "Dubrovnik", lat: 42.6507, lng: 18.0944, region: "Dalmacija", isHub: true },
  { id: "sisak", name: "Sisak", lat: 45.4658, lng: 16.3725, region: "Središnja Hrvatska" },
  { id: "velika_gorica", name: "Velika Gorica", lat: 45.7142, lng: 16.0752, region: "Središnja Hrvatska" },
  { id: "vinkovci", name: "Vinkovci", lat: 45.2883, lng: 18.8047, region: "Slavonija" },
  { id: "vukovar", name: "Vukovar", lat: 45.3516, lng: 19.0003, region: "Slavonija" },
  { id: "bjelovar", name: "Bjelovar", lat: 45.8986, lng: 16.8425, region: "Središnja Hrvatska" },
  { id: "koprivnica", name: "Koprivnica", lat: 46.1628, lng: 16.8275, region: "Sjeverna Hrvatska" },
  { id: "cakovec", name: "Čakovec", lat: 46.3844, lng: 16.4339, region: "Sjeverna Hrvatska" },
  { id: "krapina", name: "Krapina", lat: 46.1608, lng: 15.8789, region: "Sjeverna Hrvatska" },
  { id: "gospic", name: "Gospić", lat: 44.5469, lng: 15.3747, region: "Lika" },
  { id: "pozega", name: "Požega", lat: 45.3403, lng: 17.6753, region: "Slavonija" },
  { id: "virovitica", name: "Virovitica", lat: 45.8319, lng: 17.3836, region: "Slavonija" },
  { id: "makarska", name: "Makarska", lat: 43.2969, lng: 17.0178, region: "Dalmacija" },
  { id: "rovinj", name: "Rovinj", lat: 45.0812, lng: 13.6387, region: "Istra" },
  { id: "porec", name: "Poreč", lat: 45.2272, lng: 13.5947, region: "Istra" },
  { id: "opatija", name: "Opatija", lat: 45.3378, lng: 14.3053, region: "Kvarner" },
  { id: "ploce", name: "Ploče", lat: 43.0581, lng: 17.4328, region: "Dalmacija" },
];

// Highway junctions for realistic Croatian corridor routing
const JUNCTIONS: Record<string, RouteWaypoint> = {
  bosiljevo: { name: "Čvor Bosiljevo (A1/A6)", lat: 45.415, lng: 15.285, highway: "A1/A6" },
  delnice: { name: "Delnice (A6)", lat: 45.398, lng: 14.802, highway: "A6" },
  zuta_lokva: { name: "Žuta Lokva (A1)", lat: 44.968, lng: 15.062, highway: "A1" },
  sveti_rok: { name: "Tunel Sveti Rok (A1)", lat: 44.325, lng: 15.652, highway: "A1" },
  dugopolje: { name: "Čvor Dugopolje (A1)", lat: 43.582, lng: 16.595, highway: "A1" },
  kutina: { name: "Kutina (A3)", lat: 45.475, lng: 16.782, highway: "A3" },
  nova_gradiska: { name: "Nova Gradiška (A3)", lat: 45.255, lng: 17.382, highway: "A3" },
  sredanci: { name: "Čvor Sredanci (A3/A5)", lat: 45.172, lng: 18.295, highway: "A3/A5" },
  kanfanar: { name: "Čvor Kanfanar (A8/A9)", lat: 45.122, lng: 13.842, highway: "A8/A9" },
  peljeski_most: { name: "Pelješki most", lat: 42.931, lng: 17.532, highway: "D8" },
};

// Known exact Croatian road distances (one-way km) and tolls (EUR) from Zagreb
const KNOWN_ROUTES: Record<
  string,
  { km: number; min: number; toll: number; via: RouteWaypoint[]; highways: string[] }
> = {
  "zagreb-rijeka": {
    km: 165,
    min: 110,
    toll: 9.3,
    via: [
      { name: "Karlovac", lat: 45.4929, lng: 15.5553, highway: "A1" },
      JUNCTIONS.bosiljevo,
      JUNCTIONS.delnice,
    ],
    highways: ["A1", "A6"],
  },
  "zagreb-split": {
    km: 410,
    min: 235,
    toll: 24.0,
    via: [
      { name: "Karlovac", lat: 45.4929, lng: 15.5553, highway: "A1" },
      JUNCTIONS.bosiljevo,
      JUNCTIONS.zuta_lokva,
      { name: "Gospić", lat: 44.5469, lng: 15.3747, highway: "A1" },
      { name: "Zadar (čvor)", lat: 44.185, lng: 15.425, highway: "A1" },
      { name: "Šibenik (čvor)", lat: 43.775, lng: 15.965, highway: "A1" },
      JUNCTIONS.dugopolje,
    ],
    highways: ["A1"],
  },
  "zagreb-zadar": {
    km: 286,
    min: 165,
    toll: 16.0,
    via: [
      { name: "Karlovac", lat: 45.4929, lng: 15.5553, highway: "A1" },
      JUNCTIONS.bosiljevo,
      JUNCTIONS.zuta_lokva,
      { name: "Gospić", lat: 44.5469, lng: 15.3747, highway: "A1" },
      JUNCTIONS.sveti_rok,
    ],
    highways: ["A1"],
  },
  "zagreb-sibenik": {
    km: 342,
    min: 195,
    toll: 20.1,
    via: [
      { name: "Karlovac", lat: 45.4929, lng: 15.5553, highway: "A1" },
      JUNCTIONS.bosiljevo,
      JUNCTIONS.zuta_lokva,
      { name: "Gospić", lat: 44.5469, lng: 15.3747, highway: "A1" },
      { name: "Zadar (čvor)", lat: 44.185, lng: 15.425, highway: "A1" },
    ],
    highways: ["A1"],
  },
  "zagreb-dubrovnik": {
    km: 602,
    min: 360,
    toll: 30.6,
    via: [
      { name: "Karlovac", lat: 45.4929, lng: 15.5553, highway: "A1" },
      JUNCTIONS.bosiljevo,
      JUNCTIONS.zuta_lokva,
      { name: "Gospić", lat: 44.5469, lng: 15.3747, highway: "A1" },
      { name: "Zadar (čvor)", lat: 44.185, lng: 15.425, highway: "A1" },
      JUNCTIONS.dugopolje,
      { name: "Ploče (A1)", lat: 43.095, lng: 17.445, highway: "A1" },
      JUNCTIONS.peljeski_most,
    ],
    highways: ["A1", "D8"],
  },
  "zagreb-osijek": {
    km: 282,
    min: 165,
    toll: 16.2,
    via: [
      JUNCTIONS.kutina,
      JUNCTIONS.nova_gradiska,
      { name: "Slavonski Brod", lat: 45.1603, lng: 18.0156, highway: "A3" },
      JUNCTIONS.sredanci,
      { name: "Đakovo (A5)", lat: 45.308, lng: 18.41, highway: "A5" },
    ],
    highways: ["A3", "A5"],
  },
  "zagreb-pula": {
    km: 268,
    min: 170,
    toll: 18.5,
    via: [
      { name: "Karlovac", lat: 45.4929, lng: 15.5553, highway: "A1" },
      JUNCTIONS.bosiljevo,
      { name: "Rijeka", lat: 45.3271, lng: 14.4422, highway: "A6/A7" },
      { name: "Tunel Učka (A8)", lat: 45.285, lng: 14.215, highway: "A8" },
      JUNCTIONS.kanfanar,
    ],
    highways: ["A1", "A6", "A8", "A9"],
  },
  "zagreb-varazdin": {
    km: 86,
    min: 55,
    toll: 3.7,
    via: [{ name: "Novi Marof (A4)", lat: 46.165, lng: 16.335, highway: "A4" }],
    highways: ["A4"],
  },
  "zagreb-slavonski_brod": {
    km: 192,
    min: 115,
    toll: 11.1,
    via: [JUNCTIONS.kutina, JUNCTIONS.nova_gradiska],
    highways: ["A3"],
  },
  "split-dubrovnik": {
    km: 214,
    min: 155,
    toll: 6.6,
    via: [
      JUNCTIONS.dugopolje,
      { name: "Makarska (A1)", lat: 43.35, lng: 17.08, highway: "A1" },
      { name: "Ploče (A1)", lat: 43.095, lng: 17.445, highway: "A1" },
      JUNCTIONS.peljeski_most,
    ],
    highways: ["A1", "D8"],
  },
  "dubrovnik-rijeka": {
    km: 588,
    min: 375,
    toll: 29.8,
    via: [
      JUNCTIONS.peljeski_most,
      { name: "Ploče (A1)", lat: 43.095, lng: 17.445, highway: "A1" },
      JUNCTIONS.dugopolje,
      { name: "Zadar (čvor)", lat: 44.185, lng: 15.425, highway: "A1" },
      JUNCTIONS.sveti_rok,
      JUNCTIONS.zuta_lokva,
      { name: "Senj (D8)", lat: 44.99, lng: 14.9, highway: "D8/A7" },
    ],
    highways: ["D8", "A1", "A7"],
  },
  "rijeka-slavonski_brod": {
    km: 356,
    min: 215,
    toll: 20.4,
    via: [
      JUNCTIONS.delnice,
      JUNCTIONS.bosiljevo,
      { name: "Karlovac", lat: 45.4929, lng: 15.5553, highway: "A1" },
      { name: "Zagreb (obilaznica)", lat: 45.775, lng: 15.98, highway: "A3" },
      JUNCTIONS.kutina,
      JUNCTIONS.nova_gradiska,
    ],
    highways: ["A6", "A1", "A3"],
  },
};

function normalizeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/č|ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/đ/g, "d");
}

export function findCityNode(nameOrQuery: string): CityNode {
  const q = normalizeName(nameOrQuery);
  if (!q) return CROATIAN_CITIES[0];

  const exact = CROATIAN_CITIES.find(
    (c) => normalizeName(c.name) === q || c.id === q
  );
  if (exact) return exact;

  const partial = CROATIAN_CITIES.find(
    (c) =>
      q.includes(normalizeName(c.name)) || normalizeName(c.name).includes(q)
  );
  if (partial) return partial;

  return CROATIAN_CITIES[0];
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Catmull-Rom spline interpolation for smooth highway curves
function generateSmoothCurve(
  pts: { lat: number; lng: number }[],
  segmentsPerSpan = 18
): { lat: number; lng: number }[] {
  if (pts.length < 2) return pts;
  const result: { lat: number; lng: number }[] = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;

      const lat =
        0.5 *
        (2 * p1.lat +
          (-p0.lat + p2.lat) * t +
          (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2 +
          (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3);
      const lng =
        0.5 *
        (2 * p1.lng +
          (-p0.lng + p2.lng) * t +
          (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2 +
          (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3);

      result.push({ lat, lng });
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

export function computeOptimalRoute(
  originName: string,
  destinationName: string
): OptimalRouteResult {
  const origin = findCityNode(originName);
  const destination = findCityNode(destinationName);

  if (origin.id === destination.id) {
    return {
      origin,
      destination,
      waypoints: [{ name: origin.name, lat: origin.lat, lng: origin.lng }],
      smoothPath: [{ lat: origin.lat, lng: origin.lng }],
      distanceKm: 15,
      durationMinutes: 25,
      estimatedTollEur: 0,
      highwaysUsed: ["Gradska prometnica"],
      routeSummary: `Lokalna vožnja (${origin.name})`,
    };
  }

  const directKey = `${origin.id}-${destination.id}`;
  const reverseKey = `${destination.id}-${origin.id}`;

  let viaWaypoints: RouteWaypoint[] = [];
  let distanceKm = 0;
  let durationMinutes = 0;
  let estimatedTollEur = 0;
  let highwaysUsed: string[] = [];

  if (KNOWN_ROUTES[directKey]) {
    const k = KNOWN_ROUTES[directKey];
    viaWaypoints = k.via;
    distanceKm = k.km;
    durationMinutes = k.min;
    estimatedTollEur = k.toll;
    highwaysUsed = k.highways;
  } else if (KNOWN_ROUTES[reverseKey]) {
    const k = KNOWN_ROUTES[reverseKey];
    viaWaypoints = [...k.via].reverse();
    distanceKm = k.km;
    durationMinutes = k.min;
    estimatedTollEur = k.toll;
    highwaysUsed = [...k.highways].reverse();
  } else {
    // Intelligent Croatian corridor routing (avoid cutting straight across BiH)
    const airKm = haversineKm(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );

    const involvesDalmatia =
      origin.region === "Dalmacija" || destination.region === "Dalmacija";
    const involvesSlavonia =
      origin.region === "Slavonija" || destination.region === "Slavonija";
    const involvesIstriaKvarner =
      origin.region === "Istra" ||
      origin.region === "Kvarner" ||
      destination.region === "Istra" ||
      destination.region === "Kvarner";

    if (involvesDalmatia && involvesSlavonia) {
      // Slavonia <-> Dalmatia goes via Zagreb & Bosiljevo on A3 + A1 inside HR
      const zg = CROATIAN_CITIES[0];
      viaWaypoints =
        origin.region === "Slavonija"
          ? [
              JUNCTIONS.nova_gradiska,
              { name: zg.name, lat: zg.lat, lng: zg.lng, highway: "A3/A1" },
              JUNCTIONS.bosiljevo,
              JUNCTIONS.sveti_rok,
            ]
          : [
              JUNCTIONS.sveti_rok,
              JUNCTIONS.bosiljevo,
              { name: zg.name, lat: zg.lat, lng: zg.lng, highway: "A1/A3" },
              JUNCTIONS.nova_gradiska,
            ];
      highwaysUsed = ["A3", "A1"];
      distanceKm = Math.round(airKm * 1.62);
    } else if (involvesDalmatia && involvesIstriaKvarner) {
      viaWaypoints =
        origin.region === "Dalmacija"
          ? [JUNCTIONS.sveti_rok, JUNCTIONS.zuta_lokva, JUNCTIONS.bosiljevo]
          : [JUNCTIONS.bosiljevo, JUNCTIONS.zuta_lokva, JUNCTIONS.sveti_rok];
      highwaysUsed = ["A1", "A6"];
      distanceKm = Math.round(airKm * 1.38);
    } else if (involvesDalmatia) {
      viaWaypoints =
        origin.lat > destination.lat
          ? [JUNCTIONS.bosiljevo, JUNCTIONS.zuta_lokva, JUNCTIONS.sveti_rok]
          : [JUNCTIONS.sveti_rok, JUNCTIONS.zuta_lokva, JUNCTIONS.bosiljevo];
      highwaysUsed = ["A1"];
      distanceKm = Math.round(airKm * 1.32);
    } else if (involvesSlavonia) {
      viaWaypoints = [JUNCTIONS.kutina, JUNCTIONS.nova_gradiska];
      highwaysUsed = ["A3"];
      distanceKm = Math.round(airKm * 1.22);
    } else {
      highwaysUsed = ["A1", "D1"];
      distanceKm = Math.max(15, Math.round(airKm * 1.26));
    }

    durationMinutes = Math.max(20, Math.round((distanceKm / 95) * 60));
    estimatedTollEur =
      distanceKm >= 40 ? Math.round(distanceKm * 0.058 * 10) / 10 : 0;
  }

  const allWaypoints: RouteWaypoint[] = [
    { name: origin.name, lat: origin.lat, lng: origin.lng },
    ...viaWaypoints,
    { name: destination.name, lat: destination.lat, lng: destination.lng },
  ];

  const smoothPath = generateSmoothCurve(
    allWaypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
    20
  );

  return {
    origin,
    destination,
    waypoints: allWaypoints,
    smoothPath,
    distanceKm,
    durationMinutes,
    estimatedTollEur,
    highwaysUsed,
    routeSummary: `${origin.name} → ${destination.name} (${highwaysUsed.join(
      " / "
    )})`,
  };
}

export function parseRelationStops(
  originStr: string,
  destinationStr: string
): string[] {
  const splitTokens = (s: string) =>
    (s || "")
      .split(/\s*(?:→|->|–|—|-|,|;|\|)\s*/)
      .map((t) => t.trim())
      .filter(Boolean);

  const origParts = splitTokens(originStr);
  const destParts = splitTokens(destinationStr);
  const combined = [...origParts, ...destParts];
  return combined.length >= 2 ? combined : ["Zagreb", "Split"];
}

export function computeMultiStopRoute(
  stopNames: string[]
): MultiStopRouteResult {
  const validNames =
    stopNames.filter((s) => s && s.trim()).length >= 2
      ? stopNames.filter((s) => s && s.trim())
      : ["Zagreb", "Split"];

  const stops = validNames.map((n) => findCityNode(n));
  const legs: MultiStopLeg[] = [];
  const allWaypoints: RouteWaypoint[] = [];
  const combinedSmooth: { lat: number; lng: number }[] = [];
  const highwaySet = new Set<string>();

  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  let totalTollEur = 0;
  let maxDistanceFromOriginKm = 0;

  const firstStop = stops[0];

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    const seg = computeOptimalRoute(from.name, to.name);

    legs.push({
      index: i + 1,
      from: seg.origin,
      to: seg.destination,
      distanceKm: seg.distanceKm,
      durationMinutes: seg.durationMinutes,
      estimatedTollEur: seg.estimatedTollEur,
      highwaysUsed: seg.highwaysUsed,
    });

    totalDistanceKm += seg.distanceKm;
    totalDurationMinutes += seg.durationMinutes;
    totalTollEur = Math.round((totalTollEur + seg.estimatedTollEur) * 100) / 100;

    // Track furthest distance from origin for the 30 km legal rule
    const distFromFirst =
      from.id === firstStop.id
        ? seg.distanceKm
        : computeOptimalRoute(firstStop.name, to.name).distanceKm;
    if (distFromFirst > maxDistanceFromOriginKm) {
      maxDistanceFromOriginKm = distFromFirst;
    }

    for (const hw of seg.highwaysUsed) {
      highwaySet.add(hw);
    }

    if (i === 0) {
      allWaypoints.push(...seg.waypoints);
      combinedSmooth.push(...seg.smoothPath);
    } else {
      allWaypoints.push(...seg.waypoints.slice(1));
      combinedSmooth.push(...seg.smoothPath.slice(1));
    }
  }

  return {
    stops,
    legs,
    waypoints: allWaypoints,
    smoothPath: combinedSmooth,
    totalDistanceKm,
    maxDistanceFromOriginKm,
    totalDurationMinutes,
    totalTollEur,
    highwaysUsed: Array.from(highwaySet),
    relationString: stops.map((s) => s.name).join(" – "),
  };
}

