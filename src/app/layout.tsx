import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Putni nalozi — Evidencija i obračun po HR propisima",
  description:
    "Web aplikacija za putne naloge, dnevnice, loko vožnju i službeni ispis prema hrvatskom Pravilniku o porezu na dohodak.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hr" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
