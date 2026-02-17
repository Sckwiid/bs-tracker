import type { Metadata } from "next";
import Link from "next/link";
import { Orbitron, Rajdhani } from "next/font/google";

import "@/app/globals.css";
import { AffiliationBanner } from "@/components/affiliation-banner";

const titleFont = Orbitron({
  subsets: ["latin"],
  variable: "--font-title"
});

const bodyFont = Rajdhani({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"]
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "BrawStar Tracker",
  description: "Stats Brawl Stars en live + historique snapshots Supabase.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "BrawStar Tracker",
    description: "Stats Brawl Stars en live + historique snapshots Supabase.",
    images: [
      {
        url: "https://cdn.brawlify.com/brawlers/borderless/shelly.png",
        alt: "BrawStar Tracker"
      }
    ]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${titleFont.variable} ${bodyFont.variable}`}>
      <body className="font-[var(--font-body)] antialiased">
        <div className="grain min-h-screen">
          <header className="border-b border-cyan-400/20 bg-surface-900/70 backdrop-blur">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link href="/" className="font-[var(--font-title)] text-xl tracking-wider text-neon-cyan">
                BRAWSTAR TRACKER
              </Link>
              <div className="flex gap-4 text-sm font-semibold text-slate-200">
                <Link href="/" className="transition hover:text-neon-cyan">
                  Home
                </Link>
                <Link href="/esport" className="transition hover:text-neon-cyan">
                  E-sport Hub
                </Link>
                <Link href="/coach" className="transition hover:text-neon-cyan">
                  IA Coach
                </Link>
                <Link href="/meta" className="transition hover:text-neon-cyan">
                  Meta
                </Link>
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8 pb-20">{children}</main>
          <AffiliationBanner />
        </div>
      </body>
    </html>
  );
}
