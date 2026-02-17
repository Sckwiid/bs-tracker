import type { Metadata } from "next";
import Link from "next/link";

import { CompareTool } from "@/components/compare-tool";
import { TopEarningsBoard } from "@/components/top-earnings-board";
import { PRO_PLAYERS } from "@/data/esport-pros";
import { getPlayer } from "@/lib/brawlApi";
import { getTopProPlayersByEarnings } from "@/lib/supabase";
import { formatNumber } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "E-sport Hub Brawl Stars",
  description: "Profils pros, top earnings Matcherino et comparaison face-à-face.",
  alternates: {
    canonical: "/esport"
  },
  openGraph: {
    title: "E-sport Hub Brawl Stars",
    description: "Profils pros, top earnings Matcherino et comparaison face-à-face.",
    images: [
      {
        url: "https://cdn.brawlify.com/brawlers/borderless/fang.png",
        alt: "E-sport Hub Brawl Stars"
      }
    ]
  }
};

interface DisplayPro {
  tag: string;
  handle: string;
  team: string;
  matcherinoUrl: string;
  earningsUsd: number;
}

export default async function EsportPage() {
  let topEarnings = await getTopProPlayersByEarnings(10).catch(() => []);

  const displayPros: DisplayPro[] =
    topEarnings.length > 0
      ? topEarnings.map((pro) => ({
          tag: pro.player_tag,
          handle: pro.display_name,
          team: pro.team,
          matcherinoUrl: pro.matcherino_url ?? "https://matcherino.com/",
          earningsUsd: Number(pro.matcherino_earnings_usd ?? 0)
        }))
      : PRO_PLAYERS.map((pro) => ({
          tag: pro.tag,
          handle: pro.handle,
          team: pro.team,
          matcherinoUrl: pro.matcherinoUrl,
          earningsUsd: pro.earningsUsd
        }));

  const players = await Promise.all(
    displayPros.map(async (pro) => {
      try {
        const live = await getPlayer(pro.tag);
        return { ...pro, live };
      } catch {
        return { ...pro, live: null };
      }
    })
  );

  if (topEarnings.length === 0) {
    topEarnings = displayPros.map((pro) => ({
      id: `fallback-${pro.tag}`,
      player_tag: pro.tag,
      display_name: pro.handle,
      team: pro.team,
      mercato_status: "signed",
      matcherino_url: pro.matcherinoUrl,
      matcherino_earnings_usd: pro.earningsUsd,
      is_active: true,
      notes: null,
      created_at: "",
      updated_at: ""
    }));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-700/70 bg-surface-800/80 p-6">
        <h1 className="font-[var(--font-title)] text-3xl text-white">E-sport Hub</h1>
        <p className="mt-2 text-sm text-slate-300">
          Profils pros vérifiés, earnings Matcherino et comparaison face-à-face.
        </p>
      </section>

      <TopEarningsBoard
        entries={topEarnings.map((pro) => ({
          tag: pro.player_tag,
          displayName: pro.display_name,
          team: pro.team,
          earningsUsd: Number(pro.matcherino_earnings_usd ?? 0),
          matcherinoUrl: pro.matcherino_url
        }))}
      />

      <section className="grid gap-3 md:grid-cols-3">
        {players.map((pro) => (
          <article key={pro.tag} className="rounded-xl border border-slate-700 bg-surface-900/70 p-4">
            <p className="text-xs uppercase tracking-widest text-neon-cyan">{pro.team}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{pro.handle}</h2>
            <p className="text-sm text-slate-300">{pro.tag}</p>
            <p className="mt-2 text-sm text-slate-200">Earnings Matcherino: ${formatNumber(pro.earningsUsd)}</p>
            <p className="text-sm text-slate-200">
              Trophées live: {pro.live ? formatNumber(pro.live.trophies) : "indisponible"}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <a href={pro.matcherinoUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-neon-lime underline">
                Matcherino
              </a>
              <Link href={`/player/${encodeURIComponent(pro.tag)}`} className="text-sm text-neon-cyan underline">
                Voir profil
              </Link>
            </div>
          </article>
        ))}
      </section>

      <CompareTool />
    </div>
  );
}
