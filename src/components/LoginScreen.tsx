"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/demo-seed";
import type { AuthSession } from "@/lib/types";

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
}

interface DemoAccount {
  label: string;
  roleBadge: string;
  roleColor: string;
  companyName: string;
  email: string;
  password: string;
  description: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Globalni Admin",
    roleBadge: "Globalni Admin",
    roleColor: "bg-purple-100 text-purple-800 border-purple-200",
    companyName: "Sve tvrtke u sustavu",
    email: "admin@sustav.hr",
    password: "admin123",
    description:
      "Upravlja svim tvrtkama, prebacuje aktivnu tvrtku, kreira korisnike i radi cjeloviti backup sustava.",
  },
  {
    label: "Lokalni Admin Firme 1",
    roleBadge: "Administrator tvrtke",
    roleColor: "bg-blue-100 text-blue-800 border-blue-200",
    companyName: "Adriatik Tehnologije d.o.o.",
    email: "direktor@firma1.hr",
    password: "firma123",
    description:
      "Direktor / šef računovodstva Firme 1. Upravlja podkorisnicima svoje tvrtke, pravima pristupa i nalozima.",
  },
  {
    label: "Podkorisnik Firme 1",
    roleBadge: "Korisnik (Djelatnik)",
    roleColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    companyName: "Adriatik Tehnologije d.o.o.",
    email: "korisnik@firma1.hr",
    password: "korisnik123",
    description:
      "Djelatnik Firme 1 s ograničenim ovlastima (unos putnih naloga i loko vožnji, bez odobravanja i JOPPD-a).",
  },
  {
    label: "Lokalni Admin Firme 2",
    roleBadge: "Administrator tvrtke",
    roleColor: "bg-amber-100 text-amber-800 border-amber-200",
    companyName: "Slavonija Logistika d.o.o.",
    email: "direktor@firma2.hr",
    password: "firma234",
    description:
      "Direktor druge tvrtke s potpuno odvojenim radnicima, vozilima, putnim nalozima i postavkama.",
  },
];

const SHOW_DEMO_ACCOUNTS =
  process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_HIDE_DEMO_ACCOUNTS !== "true");

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState(
    SHOW_DEMO_ACCOUNTS ? "admin@sustav.hr" : ""
  );
  const [password, setPassword] = useState(
    SHOW_DEMO_ACCOUNTS ? "admin123" : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const performLogin = async (loginEmail: string, loginPass: string) => {
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Neispravni podaci za prijavu.");
        setLoading(false);
        return;
      }
      onLoginSuccess(data as AuthSession);
    } catch {
      setError("Greška pri povezivanju sa poslužiteljem.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Unesite e-mail adresu i lozinku.");
      return;
    }
    await performLogin(email, password);
  };

  const handleQuickDemoLogin = async (acc: DemoAccount) => {
    setEmail(acc.email);
    setPassword(acc.password);
    await performLogin(acc.email, acc.password);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle Decorative Gradient Blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />

      <div
        className={`${
          SHOW_DEMO_ACCOUNTS
            ? "max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            : "max-w-md"
        } w-full mx-auto relative z-10`}
      >
        {/* Left Column: Login Card */}
        <div
          className={`${
            SHOW_DEMO_ACCOUNTS ? "lg:col-span-5" : ""
          } bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-600/25 shrink-0">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Prijava u sustav Putni Nalozi
              </h1>
              <p className="text-xs text-slate-500">
                Višekorisnički sustav za obračun službenih putovanja RH
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/80 px-3 py-2 text-xs text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Multi-tenant izolacija podataka po tvrtkama i granularne ovlasti
            </span>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs font-medium text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                E-mail adresa korisnika
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ime.prezime@tvrtka.hr"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/60 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Lozinka
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/60 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 focus:outline-none transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white font-semibold text-sm py-2.5 px-4 shadow-sm shadow-blue-600/20 transition cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? "Prijava u tijeku..." : "Prijavi se u sustav"}</span>
            </button>
          </form>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700">
              Razine pristupa u sustavu:
            </div>
            <p>
              • <strong>Globalni Admin:</strong> sve tvrtke, svi korisnici,
              prebacivanje konteksta tvrtke, cjeloviti backup.
            </p>
            <p>
              • <strong>Administrator tvrtke:</strong> upravlja radnicima,
              podkorisnicima i pravima pristupa unutar svoje tvrtke.
            </p>
            <p>
              • <strong>Korisnik:</strong> pristupa samo modulima koje mu je
              odobrio administrator tvrtke.
            </p>
          </div>
        </div>

        {/* Right Column: 1-Click Demo Accounts (Development / Demo Mode Only) */}
        {SHOW_DEMO_ACCOUNTS && (
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Brza prijava jednim klikom</span>
                </div>
                <h2 className="text-lg font-bold text-white">
                  Demo računi za testiranje uloga i tvrtki
                </h2>
                <p className="text-xs text-slate-400">
                  Kliknite na bilo koji račun ispod za trenutnu prijavu i
                  testiranje višekorisničkog rada i izolacije tvrtki.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = email === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={loading}
                    onClick={() => handleQuickDemoLogin(acc)}
                    className={`text-left rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 cursor-pointer group ${
                      isSelected
                        ? "bg-slate-800/90 border-blue-500/80 ring-1 ring-blue-500/40"
                        : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${acc.roleColor}`}
                        >
                          <UserCheck className="w-3 h-3" />
                          {acc.roleBadge}
                        </span>
                        <span className="text-[11px] font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                          Prijavi se &rarr;
                        </span>
                      </div>

                      <div>
                        <div className="font-bold text-sm text-white">
                          {acc.label}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{acc.companyName}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        {acc.description}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                      <span className="truncate text-slate-300">{acc.email}</span>
                      <span className="inline-flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-800 shrink-0">
                        <KeyRound className="w-3 h-3" />
                        {acc.password}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl bg-slate-950/80 border border-slate-800/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-blue-400 shrink-0" />
                <span>
                  Možete se u svakom trenutku odjaviti u gornjem desnom kutu i
                  prebaciti na drugi demo račun.
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Spremno za rad
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
