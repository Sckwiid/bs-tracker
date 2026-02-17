import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { TagSearchForm } from "@/components/tag-search-form";
import { getTopPlayers } from "@/lib/brawlApi";
import { formatNumber } from "@/lib/utils";

export const revalidate = 90;
export const metadata: Metadata = {
  title: "BrawStar Tracker - Home",
  description: "Recherche par tag, top joueurs mondiaux et stats Brawl Stars en direct.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "BrawStar Tracker - Home",
    description: "Recherche par tag, top joueurs mondiaux et stats Brawl Stars en direct.",
    images: [
      {
        url: "https://cdn.brawlify.com/brawlers/borderless/shelly.png",
        alt: "BrawStar Tracker Home"
      }
    ]
  }
};

export default async function HomePage() {
  const topPlayers = await getTopPlayers(10).catch(() => []);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-cyan-500/30 bg-surface-800/70 p-6 shadow-glow">
        <p className="text-sm uppercase tracking-[0.25em] text-neon-cyan">Realtime API + Snapshots Supabase</p>
        <h1 className="mt-3 font-[var(--font-title)] text-3xl text-white sm:text-4xl">
          Brawl Stars Stats Ultra-Rapides
        </h1>
        <p className="mt-3 max-w-3xl text-slate-200">
          Recherche un tag pour charger les stats live depuis l&apos;API officielle et historiser automatiquement les
          changements en base.
        </p>
        <TagSearchForm className="mt-6" />
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-surface-800/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Top 10 joueurs mondiaux</h2>
          <span className="text-xs text-slate-400">Source: Brawl Stars API</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {topPlayers.map((player) => (
            <Link
              key={player.tag}
              href={`/player/${encodeURIComponent(player.tag)}`}
              className="flex items-center gap-3 rounded-xl border border-slate-700 bg-surface-900/70 p-3 transition hover:border-cyan-400/60"
            >
              <div className="text-xl font-black text-neon-cyan">#{player.rank}</div>
              <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-700">
                <Image
                  src={`https://cdn.brawlify.com/profile-icons/regular/${player.icon?.id ?? 28000000}.png`}
                  alt={player.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <p className="font-semibold text-white">{player.name}</p>
                <p className="text-sm text-slate-300">
                  {formatNumber(player.trophies)} trophées • {player.tag}
                </p>
              </div>
            </Link>
          ))}
          {topPlayers.length === 0 ? (
            <p className="text-sm text-rose-300">
              Impossible de charger le Top 10. Vérifie `BRAWL_API_TOKEN` dans l&apos;environnement.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
