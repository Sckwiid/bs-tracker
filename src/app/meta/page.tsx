import type { Metadata } from "next";

import { getBrawlifyTierList } from "@/lib/brawlApi";

export const metadata: Metadata = {
  title: "Meta Brawl Stars - Tier List Winrate",
  description: "Tier list dynamique basée sur les winrates globaux (Brawlify API).",
  alternates: {
    canonical: "/meta"
  },
  openGraph: {
    title: "Meta Brawl Stars - Tier List Winrate",
    description: "Tier list dynamique basée sur les winrates globaux (Brawlify API).",
    images: [
      {
        url: "https://cdn.brawlify.com/brawlers/borderless/belle.png",
        alt: "Meta Tier List"
      }
    ]
  }
};

export const revalidate = 1800;

const tierColor: Record<"S" | "A" | "B" | "C", string> = {
  S: "border-emerald-400 text-emerald-300",
  A: "border-cyan-400 text-cyan-300",
  B: "border-amber-400 text-amber-300",
  C: "border-rose-400 text-rose-300"
};

export default async function MetaPage() {
  try {
    const tierList = await getBrawlifyTierList(40);

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-6">
          <h1 className="font-[var(--font-title)] text-3xl text-white">Meta Tier List</h1>
          <p className="mt-2 text-sm text-slate-300">
            Classement des brawlers selon leur winrate global, mis à jour depuis Brawlify.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tierList.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${tierColor[entry.tier]}`}>
                  Tier {entry.tier}
                </span>
                <span className="text-sm font-semibold text-neon-cyan">{entry.winrate}%</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-slate-700 bg-surface-900">
                  {entry.imageUrl ? <img src={entry.imageUrl} alt={entry.name} className="h-full w-full object-cover" /> : null}
                </div>
                <div>
                  <h2 className="font-semibold text-white">{entry.name}</h2>
                  <p className="text-xs text-slate-400">Winrate global</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    );
  } catch (error) {
    return (
      <section className="rounded-2xl border border-amber-500/50 bg-surface-900/80 p-6">
        <h1 className="text-2xl font-bold text-white">Meta indisponible</h1>
        <p className="mt-2 text-sm text-amber-200">
          {error instanceof Error ? error.message : "Impossible de charger la tier list."}
        </p>
      </section>
    );
  }
}
