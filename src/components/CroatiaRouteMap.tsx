"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Car,
  Compass,
  FastForward,
  MapPin,
  Navigation,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Route,
  Sparkles,
} from "lucide-react";
import {
  computeOptimalRoute,
  CROATIAN_CITIES,
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
    estimatedTollEur: number
  ) => void;
  mileageRateEur?: number;
}

// Coordinate projection: Croatia bounding box
// Lat: 42.35 (South - Dubrovnik) to 46.58 (North - Čakovec)
// Lng: 13.35 (West - Savudrija/Poreč) to 19.48 (East - Ilok/Vukovar)
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

// Realistic geographic polygon of Croatia (lat, lng pairs)
const CROATIA_MAINLAND_LATLNG: [number, number][] = [
  [45.48, 13.5], // Savudrija
  [45.23, 13.59], // Poreč
  [45.08, 13.63], // Rovinj
  [44.82, 13.86], // Premantura / Pula
  [45.05, 14.16], // Labin
  [45.34, 14.3], // Opatija
  [45.33, 14.45], // Rijeka
  [45.12, 14.79], // Novi Vinodolski
  [44.99, 14.9], // Senj
  [44.53, 15.07], // Karlobag
  [44.28, 15.45], // Starigrad
  [44.12, 15.22], // Zadar
  [43.93, 15.44], // Biograd
  [43.73, 15.89], // Šibenik
  [43.51, 15.96], // Primošten
  [43.51, 16.25], // Trogir
  [43.5, 16.44], // Split
  [43.44, 16.69], // Omiš
  [43.29, 17.02], // Makarska
  [43.05, 17.43], // Ploče
  [42.92, 17.62], // Neum corridor / Pelješac base
  [42.65, 18.09], // Dubrovnik
  [42.44, 18.52], // Konavle / Prevlaka
  [42.62, 18.45],
  [42.9, 17.85],
  [43.18, 17.65], // Metković / Imotski border
  [43.62, 16.92], // Trilj / Sinj border
  [44.05, 16.45], // Knin / Dinara
  [44.45, 16.12], // Donji Lapac
  [44.82, 15.78], // Bihać pocket W
  [45.18, 15.8], // Cetingrad / Slunj
  [45.22, 16.38], // Hrvatska Kostajnica
  [45.18, 16.9], // Jasenovac (Sava)
  [45.14, 17.25], // Nova Gradiška S
  [45.15, 18.01], // Slavonski Brod (Sava)
  [45.06, 18.69], // Županja
  [44.88, 19.02], // Bajakovo / Gunja
  [45.22, 19.38], // Ilok (Dunav)
  [45.35, 19.0], // Vukovar
  [45.55, 18.92], // Erdut
  [45.82, 18.85], // Batina (Baranja)
  [45.78, 18.15], // Donji Miholjac (Drava)
  [45.95, 17.35], // Terezino Polje
  [46.15, 17.05], // Gola / Koprivnica
  [46.42, 16.65], // Goričan / Međimurje E
  [46.52, 16.35], // Sveti Martin na Muri
  [46.28, 15.82], // Macelj / Đurmanec
  [45.85, 15.65], // Bregana / Samobor
  [45.55, 15.22], // Vinica / Karlovac W
  [45.56, 14.62], // Čabar / Gorski kotar N
  [45.48, 13.95], // Buzet N
];

const ISLANDS_LATLNG: [number, number][][] = [
  // Krk
  [
    [45.22, 14.53],
    [45.15, 14.68],
    [44.97, 14.72],
    [45.02, 14.48],
  ],
  // Cres & Lošinj
  [
    [45.15, 14.28],
    [44.95, 14.42],
    [44.62, 14.45],
    [44.68, 14.32],
  ],
  // Pag
  [
    [44.68, 14.75],
    [44.45, 15.05],
    [44.32, 15.18],
    [44.38, 14.92],
  ],
  // Dugi Otok
  [
    [44.16, 14.84],
    [43.88, 15.16],
    [43.86, 15.08],
    [44.12, 14.78],
  ],
  // Brač
  [
    [43.38, 16.45],
    [43.36, 16.86],
    [43.26, 16.82],
    [43.28, 16.46],
  ],
  // Hvar
  [
    [43.2, 16.42],
    [43.13, 17.12],
    [43.09, 17.08],
    [43.15, 16.4],
  ],
  // Korčula
  [
    [42.98, 16.65],
    [42.94, 17.16],
    [42.88, 17.12],
    [42.91, 16.64],
  ],
  // Pelješac
  [
    [43.02, 17.05],
    [42.82, 17.68],
    [42.77, 17.64],
    [42.96, 17.02],
  ],
];

// Background highway network for visual context
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
  const [originName, setOriginName] = useState<string>(
    firstOrder?.origin || "Zagreb"
  );
  const [destName, setDestName] = useState<string>(
    firstOrder?.destination || "Split"
  );
  const [roundTrip, setRoundTrip] = useState<boolean>(true);

  // Animation states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0); // 0..1

  // Sync when selectedOrderId changes from parent
  useEffect(() => {
    if (!selectedOrderId) return;
    const found = orders.find((o) => o.id === selectedOrderId);
    if (found) {
      setOriginName(found.origin);
      setDestName(found.destination);
      setProgress(0);
      setIsPlaying(true);
    }
  }, [selectedOrderId, orders]);

  const route = useMemo(
    () => computeOptimalRoute(originName, destName),
    [originName, destName]
  );

  // Projected smooth path (if roundTrip is active, we go 0->1 outbound, or full loop)
  const projectedSmooth = useMemo(
    () => route.smoothPath.map((p) => project(p.lat, p.lng)),
    [route]
  );

  const fullAnimPoints = useMemo(() => {
    if (!roundTrip || projectedSmooth.length < 2) return projectedSmooth;
    return [...projectedSmooth, ...[...projectedSmooth].reverse().slice(1)];
  }, [projectedSmooth, roundTrip]);

  // Animation loop via requestAnimationFrame
  const lastFrameRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying || fullAnimPoints.length < 2) {
      lastFrameRef.current = null;
      return;
    }

    let rafId: number;
    const durationMs = (roundTrip ? 14000 : 8000) / speedMultiplier;

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
  }, [isPlaying, speedMultiplier, roundTrip, fullAnimPoints.length]);

  // Calculate vehicle position & heading angle at current progress
  const vehicleState = useMemo(() => {
    if (fullAnimPoints.length === 0) {
      return { x: 0, y: 0, angle: 0, isReturnLeg: false };
    }
    if (fullAnimPoints.length === 1) {
      return {
        x: fullAnimPoints[0].x,
        y: fullAnimPoints[0].y,
        angle: 0,
        isReturnLeg: false,
      };
    }

    const exactIdx = progress * (fullAnimPoints.length - 1);
    const idx = Math.min(
      Math.floor(exactIdx),
      fullAnimPoints.length - 2
    );
    const frac = exactIdx - idx;

    const p1 = fullAnimPoints[idx];
    const p2 = fullAnimPoints[idx + 1];

    const x = p1.x + (p2.x - p1.x) * frac;
    const y = p1.y + (p2.y - p1.y) * frac;
    const angle = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
    const isReturnLeg = roundTrip && progress > 0.5;

    return { x, y, angle, isReturnLeg };
  }, [fullAnimPoints, progress, roundTrip]);

  // Partial path up to current car position for the glowing trail
  const activeTrailPath = useMemo(() => {
    if (projectedSmooth.length < 2) return "";
    // On outbound leg (0..0.5 in roundTrip, or 0..1 in one-way)
    const outboundProgress = roundTrip
      ? progress <= 0.5
        ? progress * 2
        : 1
      : progress;
    const count = Math.max(
      2,
      Math.ceil(outboundProgress * projectedSmooth.length)
    );
    return pointsToSvgPath(projectedSmooth.slice(0, count));
  }, [projectedSmooth, progress, roundTrip]);

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

  const totalDistanceKm = roundTrip ? route.distanceKm * 2 : route.distanceKm;
  const currentDrivenKm = Math.round(totalDistanceKm * progress);
  const totalTollEur = round2(
    roundTrip ? route.estimatedTollEur * 2 : route.estimatedTollEur
  );
  const totalMileageEur = round2(totalDistanceKm * mileageRateEur);
  const currentMileageEur = round2(currentDrivenKm * mileageRateEur);

  const hours = Math.floor(
    ((roundTrip ? route.durationMinutes * 2 : route.durationMinutes) *
      progress) /
      60
  );
  const mins = Math.round(
    ((roundTrip ? route.durationMinutes * 2 : route.durationMinutes) *
      progress) %
      60
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Top Bar */}
      <div className="px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-blue-50/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Interaktivna karta i optimalna ruta
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                <Sparkles className="w-3 h-3" />
                HAC Koridori
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Automatski izračun kilometraže, cestarine i simulacija službenog
              putovanja
            </p>
          </div>
        </div>

        {/* Route Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 border border-slate-200">
            <select
              value={originName}
              onChange={(e) => {
                setOriginName(e.target.value);
                setProgress(0);
              }}
              className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-200 focus:outline-none"
            >
              {CROATIAN_CITIES.map((c) => (
                <option key={c.id} value={c.name}>
                  Polazište: {c.name}
                </option>
              ))}
            </select>
            <span className="text-slate-400 text-xs font-bold px-1">&rarr;</span>
            <select
              value={destName}
              onChange={(e) => {
                setDestName(e.target.value);
                setProgress(0);
              }}
              className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-200 focus:outline-none"
            >
              {CROATIAN_CITIES.map((c) => (
                <option key={c.id} value={c.name}>
                  Odredište: {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setRoundTrip((r) => !r);
              setProgress(0);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition ${
              roundTrip
                ? "bg-blue-50 border-blue-200 text-blue-800"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            {roundTrip ? "Povratno (Tam–Natrag)" : "Jedan smjer"}
          </button>

          {onCreateOrderWithRoute && (
            <button
              type="button"
              onClick={() =>
                onCreateOrderWithRoute(
                  route.origin.name,
                  route.destination.name,
                  route.distanceKm,
                  totalTollEur
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Kreiraj nalog za ovu rutu
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Map Canvas + Telemetry Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* SVG Cartographic Canvas */}
        <div className="lg:col-span-8 relative bg-gradient-to-br from-slate-950 via-[#0b1528] to-slate-900 overflow-hidden select-none">
          {/* Top-left floating route badge */}
          <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
            <div className="rounded-2xl bg-slate-900/85 backdrop-blur-md border border-white/10 px-3.5 py-2 text-xs text-white shadow-lg flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-bold tracking-wide">
                {route.origin.name}
              </span>
              <span className="text-cyan-400">
                {roundTrip ? "⇄" : "→"}
              </span>
              <span className="font-bold tracking-wide">
                {route.destination.name}
              </span>
              <span className="rounded-md bg-cyan-500/20 border border-cyan-400/30 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300">
                {route.highwaysUsed.join(" • ")}
              </span>
            </div>
          </div>

          {/* Top-right live speed & direction pill */}
          <div className="absolute top-4 right-4 z-10 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-white/10 px-3.5 py-2 text-xs text-white shadow-lg flex items-center gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Smjer vožnje
              </div>
              <div className="font-semibold text-cyan-300">
                {vehicleState.isReturnLeg
                  ? `Povratak (${route.destination.name} → ${route.origin.name})`
                  : `Polazak (${route.origin.name} → ${route.destination.name})`}
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
            className="w-full h-[380px] sm:h-[440px] block"
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

            {/* Subtle Lat/Lng Cartographic Grid */}
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

            {/* Adriatic Sea Label */}
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

            {/* Waypoint Dots along Active Route */}
            {route.waypoints.slice(1, -1).map((wp, idx) => {
              const p = project(wp.lat, wp.lng);
              return (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={3.5}
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                  <text
                    x={p.x + 7}
                    y={p.y + 3}
                    fill="rgba(226, 232, 240, 0.72)"
                    fontSize="9.5"
                    fontWeight="500"
                  >
                    {wp.name}
                  </text>
                </g>
              );
            })}

            {/* Interactive City Nodes */}
            {CROATIAN_CITIES.map((city) => {
              const p = project(city.lat, city.lng);
              const isOrigin = city.id === route.origin.id;
              const isDest = city.id === route.destination.id;
              const isHighlighted = isOrigin || isDest;

              return (
                <g
                  key={city.id}
                  onClick={() => {
                    if (!isOrigin) {
                      setDestName(city.name);
                      setProgress(0);
                    }
                  }}
                  className="cursor-pointer group"
                >
                  {isHighlighted && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={13}
                      fill={
                        isOrigin
                          ? "rgba(16, 185, 129, 0.22)"
                          : "rgba(56, 189, 248, 0.25)"
                      }
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isHighlighted ? 6 : city.isHub ? 4 : 2.8}
                    fill={
                      isOrigin
                        ? "#10b981"
                        : isDest
                        ? "#38bdf8"
                        : city.isHub
                        ? "#94a3b8"
                        : "#475569"
                    }
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                  {(isHighlighted || city.isHub) && (
                    <text
                      x={p.x}
                      y={p.y - (isHighlighted ? 11 : 7)}
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
              {/* Radar Pulse */}
              <circle
                cx={0}
                cy={0}
                r={16}
                fill="rgba(34, 211, 238, 0.2)"
              />
              {/* Vehicle Body */}
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
              {/* Windshield */}
              <rect
                x={2}
                y={-4}
                width={5}
                height={8}
                rx={1.5}
                fill="#0f172a"
              />
              {/* Headlights */}
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
              <span className="text-xs font-mono text-slate-400 w-14 text-right">
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

        {/* Right Col: Route Telemetry, Waypoints & Saved Orders Quick-Switch */}
        <div className="lg:col-span-4 p-6 bg-slate-50/60 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Analiza optimalne rute
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                {route.origin.name} &rarr; {route.destination.name}
              </h3>
              <p className="text-xs text-slate-500">
                Preporučeni koridor:{" "}
                <strong className="text-slate-700">
                  Autocesta {route.highwaysUsed.join(" / ")}
                </strong>
              </p>
            </div>

            {/* Telemetry Metric Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500">
                  Udaljenost ({roundTrip ? "povratno" : "1 smjer"})
                </div>
                <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                  {totalDistanceKm} km
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  {route.distanceKm >= 30
                    ? "✓ Pravo na dnevnicu (≥30 km)"
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
                  Neoporezivo za privatni auto
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500">
                  Vrijeme vožnje
                </div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {Math.floor(
                    (roundTrip
                      ? route.durationMinutes * 2
                      : route.durationMinutes) / 60
                  )}{" "}
                  h{" "}
                  {(roundTrip
                    ? route.durationMinutes * 2
                    : route.durationMinutes) % 60}{" "}
                  min
                </div>
                <div className="text-[11px] text-slate-400">
                  Trenutno: {hours}h {mins}m
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs">
                <div className="text-[11px] text-slate-500">
                  Procjena cestarine (HAC)
                </div>
                <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {formatEur(totalTollEur)}
                </div>
                <div className="text-[11px] text-slate-400">
                  Osobno vozilo (I. skupina)
                </div>
              </div>
            </div>

            {/* Key Route Waypoints Timeline */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80">
              <div className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5 text-blue-600" />
                Ključne točke na ruti ({route.waypoints.length})
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {route.waypoints.map((wp, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === route.waypoints.length - 1;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isFirst
                              ? "bg-emerald-500"
                              : isLast
                              ? "bg-blue-600"
                              : "bg-slate-300"
                          }`}
                        />
                        <span
                          className={
                            isFirst || isLast
                              ? "font-semibold text-slate-900"
                              : "text-slate-600"
                          }
                        >
                          {wp.name}
                        </span>
                      </div>
                      {wp.highway && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          {wp.highway}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick-Select from Existing Travel Orders */}
          {orders.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Prikaži rutu postojećeg naloga
              </div>
              <div className="flex flex-wrap gap-1.5">
                {orders.slice(0, 4).map((o) => {
                  const active =
                    normalizeCity(o.origin) === normalizeCity(originName) &&
                    normalizeCity(o.destination) === normalizeCity(destName);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setOriginName(o.origin);
                        setDestName(o.destination);
                        setProgress(0);
                        setIsPlaying(true);
                        onSelectOrder?.(o);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium border transition ${
                        active
                          ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Car className="w-3 h-3" />
                      <span>{o.order_number}:</span>
                      <span className="font-semibold">
                        {o.origin} &rarr; {o.destination}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizeCity(s: string): string {
  return (s || "").trim().toLowerCase();
}
