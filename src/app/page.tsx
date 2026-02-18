import type { Metadata } from "next";

import { LeaderboardCarousel } from "@/components/LeaderboardCarousel";
import { TagSearchForm } from "@/components/tag-search-form";
import {
  BrawlApiError,
  type LeaderboardTrend,
  compareAndPersistLeaderboard,
  getTopEsportLeaders,
  getTopPlayers,
  getTopRankedPlayers
} from "@/lib/brawlApi";
import { formatRank, normalizeTag } from "@/lib/utils";

export const revalidate = 90;
export const dynamic = "force-dynamic";
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
  let topPlayers: Awaited<ReturnType<typeof getTopPlayers>> = [];
  let topPlayersError: string | null = null;
  let rankedError: string | null = null;
  let esportError: string | null = null;

  let trophyLeaders: Array<{
    tag: string;
    name: string;
    rank: number;
    trophies: number;
    iconId?: number | null;
    trend?: LeaderboardTrend;
  }> = [];
  let rankedLeaders: Array<{
    tag: string;
    name: string;
    rank: number;
    elo: number;
    rankLabel: string;
    iconId?: number | null;
    trend?: LeaderboardTrend;
  }> = [];
  let esportLeaders: Array<{
    tag: string;
    displayName: string;
    team: string;
    earningsUsd: number;
    matcherinoUrl: string | null;
    iconId?: number | null;
    trend?: LeaderboardTrend;
  }> = [];

  try {
    topPlayers = await getTopPlayers(10);
    trophyLeaders = topPlayers.map((player) => ({
      tag: player.tag,
      name: player.name,
      rank: player.rank,
      trophies: player.trophies,
      iconId: player.icon?.id ?? 28000000
    }));
  } catch (error) {
    if (error instanceof BrawlApiError) {
      topPlayersError = `Top 10 indisponible (HTTP ${error.status}).`;
    } else if (error instanceof Error) {
      topPlayersError = `Top 10 indisponible (${error.message}).`;
    } else {
      topPlayersError = "Top 10 indisponible (erreur inconnue).";
    }
  }

  try {
    const ranked = await getTopRankedPlayers(10);
    rankedLeaders = ranked.map((player) => ({
      tag: player.tag,
      name: player.name,
      rank: player.rank,
      elo: player.score,
      rankLabel: player.score > 0 ? formatRank(player.score) : "Unranked",
      iconId: player.icon?.id ?? 28000000
    }));
  } catch (error) {
    rankedError = error instanceof Error ? error.message : "Classement indisponible.";
  }

  try {
    const topEarnings = await getTopEsportLeaders(10);
    if (topEarnings.length === 0) {
      esportError = "Aucune donnée earnings en base `pro_players`.";
    } else {
      esportLeaders = topEarnings.map((pro) => ({
        tag: pro.tag,
        displayName: pro.displayName,
        team: pro.team,
        earningsUsd: Number(pro.earningsUsd ?? 0),
        matcherinoUrl: pro.matcherinoUrl,
        iconId: pro.iconId ?? 28000000
      }));
    }
  } catch (error) {
    esportError = error instanceof Error ? error.message : "Top esport indisponible.";
  }

  try {
    const worldTrend = await compareAndPersistLeaderboard(
      "world",
      trophyLeaders.map((entry) => ({ playerTag: entry.tag, value: entry.trophies }))
    );
    trophyLeaders = trophyLeaders.map((entry) => ({
      ...entry,
      trend: worldTrend[normalizeTag(entry.tag)]
    }));
  } catch {
    // Ignore trend failure, keep leaderboard visible.
  }

  try {
    const rankedTrend = await compareAndPersistLeaderboard(
      "ranked",
      rankedLeaders.map((entry) => ({ playerTag: entry.tag, value: entry.elo }))
    );
    rankedLeaders = rankedLeaders.map((entry) => ({
      ...entry,
      trend: rankedTrend[normalizeTag(entry.tag)]
    }));
  } catch {
    // Ignore trend failure, keep leaderboard visible.
  }

  try {
    const esportTrend = await compareAndPersistLeaderboard(
      "esport",
      esportLeaders.map((entry) => ({ playerTag: entry.tag, value: entry.earningsUsd }))
    );
    esportLeaders = esportLeaders.map((entry) => ({
      ...entry,
      trend: esportTrend[normalizeTag(entry.tag)]
    }));
  } catch {
    // Ignore trend failure, keep leaderboard visible.
  }

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

      <LeaderboardCarousel
        trophyLeaders={trophyLeaders}
        rankedLeaders={rankedLeaders}
        esportLeaders={esportLeaders}
        errors={{
          trophy:
            topPlayersError ??
            "Top 10 indisponible. Vérifie BRAWL_API_TOKEN, l'accès proxy et la disponibilité de l'API.",
          ranked: rankedError,
          esport: esportError
        }}
      />
    </div>
  );
}
