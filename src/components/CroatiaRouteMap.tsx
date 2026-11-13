"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Car,
  Compass,
  FastForward,
  MapPin,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Route,
  Sparkles,
  X,
} from "lucide-react";
import {
  computeMultiStopRoute,
  CROATIAN_CITIES,
  parseRelationStops,
} from "@/lib/croatian-routes";
import { formatEur, round2 } from "@/lib/croatian-rules";
import type { TravelOrder } from "@/lib/types";

interface CroatiaRouteMapProps {
  orders: TravelOrder[];
  selectedOrderId?: number | null;
  onSelectOrder?: (order: TravelOrder) => void;
  onCreateOrderWithRoute?: (
    origin: string,
    destination: string,
    distanceKm: number,
    estimatedTollEur: number,
    totalDrivenKm?: number
  ) => void;
  mileageRateEur?: number;
}

const VIEW_W = 860;
const VIEW_H = 540;
const LAT_MIN = 42.3;
const LAT_MAX = 46.62;
const LNG_MIN = 13.3;
const LNG_MAX = 19.45;

function project(lat: number, lng: number): { x: number; y: number } {
  const padX = 52;
  const padY = 42;
  const usableW = VIEW_W - padX * 2;
  const usableH = VIEW_H - padY * 2;

  const x = padX + ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * usableW;
  const y = padY + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * usableH;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

const CROATIA_MAINLAND_LATLNG: [number, number][] = [
  [45.48, 13.5],
  [45.23, 13.59],
  [45.08, 13.63],
  [44.82, 13.86],
  [45.05, 14.16],
  [45.34, 14.3],
  [45.33, 14.45],
  [45.12, 14.79],
  [44.99, 14.9],
  [44.53, 15.07],
  [44.28, 15.45],
  [44.12, 15.22],
  [43.93, 15.44],
  [43.73, 15.89],
  [43.51, 15.96],
  [43.51, 16.25],
  [43.5, 16.44],
  [43.44, 16.69],
  [43.29, 17.02],
  [43.05, 17.43],
  [42.92, 17.62],
  [42.65, 18.09],
  [42.44, 18.52],
  [42.62, 18.45],
  [42.9, 17.85],
  [43.18, 17.65],
  [43.62, 16.92],
  [44.05, 16.45],
  [44.45, 16.12],
  [44.82, 15.78],
  [45.18, 15.8],
  [45.22, 16.38],
  [45.18, 16.9],
  [45.14, 17.25],
  [45.15, 18.01],
  [45.06, 18.69],
  [44.88, 19.02],
  [45.22, 19.38],
  [45.35, 19.0],
  [45.55, 18.92],
  [45.82, 18.85],
  [45.78, 18.15],
  [45.95, 17.35],
  [46.15, 17.05],
  [46.42, 16.65],
  [46.52, 16.35],
  [46.28, 15.82],
  [45.85, 15.65],
  [45.55, 15.22],
  [45.56, 14.62],
  [45.48, 13.95],
];

const ISLANDS_LATLNG: [number, number][][] = [
  [
    [45.22, 14.53],
    [45.15, 14.68],
    [44.97, 14.72],
    [45.02, 14.48],
  ],
  [
    [45.15, 14.28],
    [44.95, 14.42],
    [44.62, 14.45],
    [44.68, 14.32],
  ],
  [
    [44.68, 14.75],
    [44.45, 15.05],
    [44.32, 15.18],
    [44.38, 14.92],
  ],
  [
    [44.16, 14.84],
    [43.88, 15.16],
    [43.86, 15.08],
    [44.12, 14.78],
  ],
  [
    [43.38, 16.45],
    [43.36, 16.86],
    [43.26, 16.82],
    [43.28, 16.46],
  ],
  [
    [43.2, 16.42],
    [43.13, 17.12],
    [43.09, 17.08],
    [43.15, 16.4],
  ],
  [
    [42.98, 16.65],
    [42.94, 17.16],
    [42.88, 17.12],
    [42.91, 16.64],
  ],
  [
    [43.02, 17.05],
    [42.82, 17.68],
    [42.77, 17.64],
    [42.96, 17.02],
  ],
];

const HIGHWAY_NETWORK: { name: string; pts: [number, number][] }[] = [
  {
    name: "A1",
    pts: [
      [45.815, 15.982],
      [45.493, 15.555],
      [45.415, 15.285],
      [44.968, 15.062],
      [44.547, 15.375],
      [44.185, 15.425],
      [43.775, 15.965],
      [43.582, 16.595],
      [43.095, 17.445],
    ],
  },
  {
    name: "A6",
    pts: [
      [45.415, 15.285],
      [45.398, 14.802],
      [45.327, 14.442],
    ],
  },
  {
    name: "A3",
    pts: [
      [45.815, 15.982],
      [45.475, 16.782],
      [45.255, 17.382],
      [45.16, 18.016],
      [45.172, 18.295],
      [45.06, 18.69],
    ],
  },
  {
    name: "A5",
    pts: [
      [45.172, 18.295],
      [45.308, 18.41],
      [45.555, 18.695],
    ],
  },
  {
    name: "A4",
    pts: [
      [45.815, 15.982],
      [46.165, 16.335],
      [46.306, 16.337],
      [46.384, 16.434],
    ],
  },
  {
    name: "A8/A9",
    pts: [
      [45.327, 14.442],
      [45.285, 14.215],
      [45.122, 13.842],
      [44.867, 13.85],
    ],
  },
];

function pointsToSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

export default function CroatiaRouteMap({
  orders,
  selectedOrderId,
  onSelectOrder,
  onCreateOrderWithRoute,
  mileageRateEur = 0.5,
}: CroatiaRouteMapProps) {
  const firstOrder = orders[0];
  const [stops, setStops] = useState<string[]>(() =>
    firstOrder
      ? parseRelationStops(firstOrder.origin, firstOrder.destination)
      : ["Zagreb", "Split"]
  );
  const [roundTripForTwoStops, setRoundTripForTwoStops] =
    useState<boolean>(true);
  const [cityToAdd, setCityToAdd] = useState<string>("Dubrovnik");

  // Animation states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);

  // Sync when selectedOrderId changes from parent
  useEffect(() => {
    if (!selectedOrderId) return;
    const found = orders.find((o) => o.id === selectedOrderId);
    if (found) {
      const parsed = parseRelationStops(found.origin, found.destination);
      setStops(parsed);
      setProgress(0);
      setIsPlaying(true);
    }
  }, [selectedOrderId, orders]);

  const isMultiStop = stops.length > 2;

  // Build effective stop chain (if 2 stops and roundTrip is active, append origin at end)
  const effectiveStops = useMemo(() => {
    if (stops.length === 2 && roundTripForTwoStops && stops[0] !== stops[1]) {
      return [stops[0], stops[1], stops[0]];
    }
    return stops;
  }, [stops, roundTripForTwoStops]);

  const tour = useMemo(
    () => computeMultiStopRoute(effectiveStops),
    [effectiveStops]
  );

  const projectedSmooth = useMemo(
    () => tour.smoothPath.map((p) => project(p.lat, p.lng)),
    [tour]
  );

  // Animation loop via requestAnimationFrame
  const lastFrameRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying || projectedSmooth.length < 2) {
      lastFrameRef.current = null;
      return;
    }

    let rafId: number;
    const baseMs = Math.max(9000, tour.legs.length * 4500);
    const durationMs = baseMs / speedMultiplier;

    const step = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }
      const dt = timestamp - lastFrameRef.current;
      lastFrameRef.current = timestamp;

      setProgress((prev) => {
        const next = prev + dt / durationMs;
        return next >= 1 ? 0 : next;
      });

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, speedMultiplier, projectedSmooth.length, tour.legs.length]);

  const vehicleState = useMemo(() => {
    if (projectedSmooth.length === 0) {
      return { x: 0, y: 0, angle: 0, currentLegIdx: 0 };
    }
    if (projectedSmooth.length === 1) {
      return {
        x: projectedSmooth[0].x,
        y: projectedSmooth[0].y,
        angle: 0,
        currentLegIdx: 0,
      };
    }

    const exactIdx = progress * (projectedSmooth.length - 1);
    const idx = Math.min(Math.floor(exactIdx), projectedSmooth.length - 2);
    const frac = exactIdx - idx;

    const p1 = projectedSmooth[idx];
    const p2 = projectedSmooth[idx + 1];

    const x = p1.x + (p2.x - p1.x) * frac;
    const y = p1.y + (p2.y - p1.y) * frac;
    const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
    const currentLegIdx = Math.min(
      tour.legs.length - 1,
      Math.floor(progress * tour.legs.length)
    );

    return { x, y, angle, currentLegIdx };
  }, [projectedSmooth, progress, tour.legs.length]);

  const activeTrailPath = useMemo(() => {
    if (projectedSmooth.length < 2) return "";
    const count = Math.max(2, Math.ceil(progress * projectedSmooth.length));
    return pointsToSvgPath(projectedSmooth.slice(0, count));
  }, [projectedSmooth, progress]);

  const fullRouteSvgPath = useMemo(
    () => pointsToSvgPath(projectedSmooth),
    [projectedSmooth]
  );

  const mainlandPolygonPoints = useMemo(
    () =>
      CROATIA_MAINLAND_LATLNG.map(([lat, lng]) => {
        const p = project(lat, lng);
        return `${p.x},${p.y}`;
      }).join(" "),
    []
  );

  const totalDistanceKm = tour.totalDistanceKm;
  const currentDrivenKm = Math.round(totalDistanceKm * progress);
  const totalTollEur = round2(tour.totalTollEur);
  const totalMileageEur = round2(totalDistanceKm * mileageRateEur);
  const currentMileageEur = round2(currentDrivenKm * mileageRateEur);

  const currentLeg = tour.legs[vehicleState.currentLegIdx] || tour.legs[0];

  const updateStopAt = (idx: number, newCity: string) => {
    setStops((prev) => prev.map((c, i) => (i === idx ? newCity : c)));
    setProgress(0);
  };

  const removeStopAt = (idx: number) => {
    if (stops.length <= 2) return;
    setStops((prev) => prev.filter((_, i) => i !== idx));
    setProgress(0);
  };

  const addStopToTour = (cityName: string) => {
    setStops((prev) => [...prev, cityName]);
    setProgress(0);
  };

  const loadPresetCircularTour = () => {
    setStops([
      "Zagreb",
      "Split",
      "Dubrovnik",
      "Rijeka",
      "Slavonski Brod",
      "Zagreb",
    ]);
    setProgress(0);
    setIsPlaying(true);
  };

  // Map city ID -> 1-based stop indices for numbered badges on map
  const stopIndicesByCityId = useMemo(() => {
    const map = new Map<string, number[]>();
    tour.stops.forEach((s, i) => {
      const list = map.get(s.id) || [];
      if (!list.includes(i + 1)) list.push(i + 1);
      map.set(s.id, list);
    });
    return map;
  }, [tour.stops]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Top Bar */}
      <div className="px-6 py-4 border-b border-slate-200/80 space-y-3 bg-gradient-to-r from-slate-50 via-white to-blue-50/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {orders.length === 1
                    ? `Karta i animacija rute — ${orders[0].order_number}`
                    : "Interaktivna karta i višelokacijski planer rute"}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                  <Sparkles className="w-3 h-3" />
                  Kružna i višednevna putovanja
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Dodajte više gradova u nizu za zakonski ispravan obračun kružnog
                putnog naloga po etapama
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadPresetCircularTour}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-800 transition"
            >
              <Route className="w-3.5 h-3.5" />
              Primjer: ZG–ST–DU–RI–SB–ZG
            </button>

            {!isMultiStop && (
              <button
                type="button"
                onClick={() => {
                  setRoundTripForTwoStops((r) => !r);
                  setProgress(0);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition ${
                  roundTripForTwoStops
                    ? "bg-blue-50 border-blue-200 text-blue-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                {roundTripForTwoStops ? "Povratno (Tam–Natrag)" : "Jedan smjer"}
              </button>
            )}

            {onCreateOrderWithRoute && (
              <button
                type="button"
                onClick={() => {
                  const originStr = tour.stops[0]?.name || "Zagreb";
                  const destRelationStr = tour.stops
                    .slice(1)
                    .map((s) => s.name)
                    .join(" – ");
                  onCreateOrderWithRoute(
                    originStr,
                    destRelationStr,
                    tour.maxDistanceFromOriginKm,
                    totalTollEur,
                    totalDistanceKm
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Kreiraj nalog za ovu rutu ({totalDistanceKm} km)
              </button>
            )}
          </div>
        </div>

        {/* Multi-Stop Chain Builder Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Točke putovanja:
          </span>

          {stops.map((stopName, idx) => (
            <React.Fragment key={idx}>
              <div className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200 pl-2 pr-1.5 py-1 shadow-2xs">
                <span
                  className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${
                    idx === 0
                      ? "bg-emerald-600"
                      : idx === stops.length - 1
                      ? "bg-blue-600"
                      : "bg-indigo-600"
                  }`}
                >
                  {idx + 1}
                </span>
                <select
                  value={stopName}
                  onChange={(e) => updateStopAt(idx, e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none pr-1"
                >
                  {CROATIAN_CITIES.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {stops.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeStopAt(idx)}
                    className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                    title="Ukloni lokaciju"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {idx < stops.length - 1 && (
                <span className="text-slate-400 text-xs font-bold">&rarr;</span>
              )}
            </React.Fragment>
          ))}

          {/* Add next stop control */}
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 border border-dashed border-slate-300 px-2 py-1 ml-1">
            <select
              value={cityToAdd}
              onChange={(e) => setCityToAdd(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none"
            >
              {CROATIAN_CITIES.map((c) => (
                <option key={c.id} value={c.name}>
                  + {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => addStopToTour(cityToAdd)}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-2 py-0.5 text-[11px] font-semibold transition"
            >
              Dodaj etapu
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Map Canvas + Telemetry Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* SVG Cartographic Canvas */}
        <div className="lg:col-span-8 relative bg-gradient-to-br from-slate-950 via-[#0b1528] to-slate-900 overflow-hidden select-none">
          {/* Top-left floating route badge */}
          <div className="absolute top-4 left-4 z-10 max-w-[65%]">
            <div className="rounded-2xl bg-slate-900/85 backdrop-blur-md border border-white/10 px-3.5 py-2 text-xs text-white shadow-lg flex flex-wrap items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span className="font-bold tracking-wide truncate">
                {tour.relationString}
              </span>
              <span className="rounded-md bg-cyan-500/20 border border-cyan-400/30 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
                {tour.highwaysUsed.join(" • ")}
              </span>
            </div>
          </div>

          {/* Top-right live leg pill */}
          <div className="absolute top-4 right-4 z-10 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-white/10 px-3.5 py-2 text-xs text-white shadow-lg flex items-center gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Trenutna etapa ({vehicleState.currentLegIdx + 1}/
                {tour.legs.length})
              </div>
              <div className="font-semibold text-cyan-300">
                {currentLeg
                  ? `${currentLeg.from.name} → ${currentLeg.to.name} (${currentLeg.distanceKm} km)`
                  : "—"}
              </div>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-right font-mono">
              <div className="text-[10px] text-slate-400">STATUS</div>
              <div className="font-bold text-emerald-400">
                {isPlaying ? "U VOŽNJI" : "PAUZA"}
              </div>
            </div>
          </div>

          {/* Interactive SVG Map */}
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="w-full h-[380px] sm:h-[450px] block"
          >
            <defs>
              <radialGradient id="seaGlow" cx="50%" cy="55%" r="65%">
                <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#020617" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="landGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <rect width={VIEW_W} height={VIEW_H} fill="url(#seaGlow)" />
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line
                key={`h-${i}`}
                x1={0}
                y1={i * 70}
                x2={VIEW_W}
                y2={i * 70}
                stroke="rgba(148, 163, 184, 0.06)"
                strokeDasharray="4 4"
              />
            ))}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <line
                key={`v-${i}`}
                x1={i * 75}
                y1={0}
                x2={i * 75}
                y2={VIEW_H}
                stroke="rgba(148, 163, 184, 0.06)"
                strokeDasharray="4 4"
              />
            ))}

            <text
              x={210}
              y={420}
              fill="rgba(56, 189, 248, 0.16)"
              fontSize="16"
              fontWeight="700"
              letterSpacing="6"
              transform="rotate(-28 210 420)"
            >
              JADRANSKO MORE
            </text>

            {/* Croatia Mainland Silhouette */}
            <polygon
              points={mainlandPolygonPoints}
              fill="url(#landGrad)"
              stroke="rgba(56, 189, 248, 0.32)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />

            {/* Adriatic Islands */}
            {ISLANDS_LATLNG.map((island, idx) => (
              <polygon
                key={idx}
                points={island
                  .map(([lat, lng]) => {
                    const p = project(lat, lng);
                    return `${p.x},${p.y}`;
                  })
                  .join(" ")}
                fill="#1e293b"
                stroke="rgba(56, 189, 248, 0.25)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            ))}

            {/* Background Croatian Motorway Network */}
            {HIGHWAY_NETWORK.map((hw) => {
              const d = pointsToSvgPath(
                hw.pts.map(([lat, lng]) => project(lat, lng))
              );
              return (
                <path
                  key={hw.name}
                  d={d}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.18)"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
              );
            })}

            {/* Full Optimal Route Base Track */}
            <path
              d={fullRouteSvgPath}
              fill="none"
              stroke="rgba(56, 189, 248, 0.28)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Animated Dashed Highway Flow */}
            <path
              d={fullRouteSvgPath}
              fill="none"
              stroke="url(#routeGrad)"
              strokeWidth="2.5"
              strokeDasharray="8 6"
              strokeLinecap="round"
            />

            {/* Active Driven Trail (Glowing) */}
            <path
              d={activeTrailPath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neonGlow)"
            />

            {/* Interactive City Nodes */}
            {CROATIAN_CITIES.map((city) => {
              const p = project(city.lat, city.lng);
              const stopNums = stopIndicesByCityId.get(city.id);
              const isHighlighted = Boolean(stopNums && stopNums.length > 0);
              const isFirst = stopNums?.[0] === 1;

              return (
                <g
                  key={city.id}
                  onClick={() => addStopToTour(city.name)}
                  className="cursor-pointer group"
                >
                  {isHighlighted && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={14}
                      fill={
                        isFirst
                          ? "rgba(16, 185, 129, 0.25)"
                          : "rgba(56, 189, 248, 0.25)"
                      }
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHighlighted ? 7.5 : city.isHub ? 4 : 2.8}
                    fill={
                      isFirst
                        ? "#10b981"
                        : isHighlighted
                        ? "#0284c7"
                        : city.isHub
                        ? "#94a3b8"
                        : "#475569"
                    }
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                  {isHighlighted && stopNums && (
                    <text
                      x={p.x}
                      y={p.y + 3}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8.5"
                      fontWeight="800"
                    >
                      {stopNums.join(",")}
                    </text>
                  )}
                  {(isHighlighted || city.isHub) && (
                    <text
                      x={p.x}
                      y={p.y - (isHighlighted ? 12 : 7)}
                      textAnchor="middle"
                      fill={isHighlighted ? "#ffffff" : "#cbd5e1"}
                      fontSize={isHighlighted ? "11.5" : "9.5"}
                      fontWeight={isHighlighted ? "700" : "500"}
                    >
                      {city.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Animated Vehicle Marker */}
            <g
              transform={`translate(${vehicleState.x}, ${vehicleState.y}) rotate(${vehicleState.angle})`}
            >
              <circle cx={0} cy={0} r={16} fill="rgba(34, 211, 238, 0.2)" />
              <rect
                x={-11}
                y={-6}
                width={22}
                height={12}
                rx={4}
                fill="#ffffff"
                stroke="#0284c7"
                strokeWidth="2"
              />
              <rect
                x={2}
                y={-4}
                width={5}
                height={8}
                rx={1.5}
                fill="#0f172a"
              />
              <circle cx={10} cy={-3.5} r={1.3} fill="#fde047" />
              <circle cx={10} cy={3.5} r={1.3} fill="#fde047" />
            </g>
          </svg>

          {/* Bottom Playback Scrubber Bar */}
          <div className="bg-slate-900/95 border-t border-white/10 px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-white">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="w-9 h-9 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center font-bold shadow transition"
                title={isPlaying ? "Pauziraj" : "Pokreni animaciju"}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setProgress(0)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center transition"
                title="Ponovi od početka"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setSpeedMultiplier((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))
                }
                className="inline-flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/15 px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-300 transition"
                title="Brzina animacije"
              >
                <FastForward className="w-3.5 h-3.5" />
                {speedMultiplier}x
              </button>
            </div>

            {/* Scrubber Slider */}
            <div className="flex-1 min-w-[160px] flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400 w-16 text-right">
                {currentDrivenKm} km
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(progress * 100)}
                onChange={(e) => {
                  setIsPlaying(false);
                  setProgress(Number(e.target.value) / 100);
                }}
                className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
              />
              <span className="text-xs font-mono text-slate-300 w-16">
                {totalDistanceKm} km
              </span>
            </div>

            <div className="text-xs font-mono text-cyan-300">
              Naknada: <strong>{formatEur(currentMileageEur)}</strong> /{" "}
              {formatEur(totalMileageEur)}
            </div>
          </div>
        </div>

        {/* Right Col: Multi-Stop Breakdown & Saved Orders */}
        <div className="lg:col-span-4 p-6 bg-slate-50/60 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Obračun višelokacijske rute ({tour.legs.length} etape)
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5 leading-snug">
                {tour.relationString}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Koridori:{" "}
                <strong className="text-slate-700">
                  {tour.highwaysUsed.join(" / ")}
                </strong>
              </p>
            </div>

            {/* Telemetry Metric Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500">
                  Ukupna kilometraža
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                  {totalDistanceKm} km
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  {tour.maxDistanceFromOriginKm >= 30
                    ? `✓ Najdalja točka ${tour.maxDistanceFromOriginKm} km (≥30 km)`
                    : "Loko vožnja (<30 km)"}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500">
                  Naknada ({mileageRateEur.toFixed(2)} €/km)
                </div>
                <div className="text-lg font-bold font-mono text-blue-700 mt-0.5">
                  {formatEur(totalMileageEur)}
                </div>
                <div className="text-[11px] text-slate-400">
                  Zbroj svih etapa
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500">
                  Ukupno vrijeme vožnje
                </div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {Math.floor(tour.totalDurationMinutes / 60)} h{" "}
                  {tour.totalDurationMinutes % 60} min
                </div>
                <div className="text-[11px] text-slate-400">
                  Aktivna vožnja
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500">
                  Cestarine ukupno (HAC)
                </div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {formatEur(totalTollEur)}
                </div>
                <div className="text-[11px] text-slate-400">
                  Sve dionice zbrojeno
                </div>
              </div>
            </div>

            {/* Leg-by-leg specification */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80">
              <div className="text-xs font-semibold text-slate-700 mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5 text-blue-600" />
                  Specifikacija po dionicama (etapama)
                </span>
                <span className="text-[10px] text-slate-400">
                  Klik na grad na karti dodaje etapu
                </span>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {tour.legs.map((leg, idx) => {
                  const isCurrent = idx === vehicleState.currentLegIdx;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between text-xs p-2 rounded-xl border transition ${
                        isCurrent
                          ? "bg-blue-50/80 border-blue-200 font-semibold text-slate-900"
                          : "bg-slate-50/60 border-slate-100 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? "bg-blue-600 text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {leg.index}
                        </span>
                        <span className="truncate">
                          {leg.from.name} &rarr; {leg.to.name}
                        </span>
                      </div>
                      <div className="text-right font-mono shrink-0 ml-2">
                        <div>{leg.distanceKm} km</div>
                        {leg.estimatedTollEur > 0 && (
                          <div className="text-[10px] text-slate-400">
                            cestarina {formatEur(leg.estimatedTollEur)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick-Select from Existing Travel Orders */}
          {orders.length > 1 && (
            <div className="pt-3 border-t border-slate-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Prikaži rutu postojećeg naloga
              </div>
              <div className="flex flex-wrap gap-1.5">
                {orders.slice(0, 4).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      const parsed = parseRelationStops(
                        o.origin,
                        o.destination
                      );
                      setStops(parsed);
                      setProgress(0);
                      setIsPlaying(true);
                      onSelectOrder?.(o);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                  >
                    <Car className="w-3 h-3 text-blue-600" />
                    <span>{o.order_number}:</span>
                    <span className="font-semibold truncate max-w-[160px]">
                      {o.origin} &rarr; {o.destination}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
