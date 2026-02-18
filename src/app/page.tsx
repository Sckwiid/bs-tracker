import type { Metadata } from "next";

import { LeaderboardCarousel } from "@/components/LeaderboardCarousel";
import { TagSearchForm } from "@/components/tag-search-form";
import { BrawlApiError, getPlayer, getTopPlayers } from "@/lib/brawlApi";
import { extractRankedElo } from "@/lib/metrics";
import { getTopProPlayersByEarnings } from "@/lib/supabase";
import { formatRank } from "@/lib/utils";

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

  let trophyLeaders: Array<{ tag: string; name: string; rank: number; trophies: number; iconId?: number | null }> = [];
  let rankedLeaders: Array<{
    tag: string;
    name: string;
    rank: number;
    elo: number;
    rankLabel: string;
    iconId?: number | null;
  }> = [];
  let esportLeaders: Array<{
    tag: string;
    displayName: string;
    team: string;
    earningsUsd: number;
    matcherinoUrl: string | null;
    iconId?: number | null;
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

  if (topPlayers.length > 0) {
    try {
      const rankedProfiles = await Promise.all(
        topPlayers.map(async (entry) => {
          try {
            const profile = await getPlayer(entry.tag);
            const raw = profile as unknown as Record<string, unknown>;
            const highestRankedRaw = raw.highestRankedTrophies ?? raw.rankedTrophies ?? 0;
            const highestRanked =
              typeof highestRankedRaw === "number"
                ? highestRankedRaw
                : Number.isFinite(Number(highestRankedRaw))
                  ? Number(highestRankedRaw)
                  : 0;
            const computedElo = extractRankedElo(profile);
            const elo = computedElo > 0 ? computedElo : Math.max(0, highestRanked);
            return {
              tag: entry.tag,
              name: profile.name || entry.name,
              elo,
              iconId: profile.icon?.id ?? entry.icon?.id ?? 28000000
            };
          } catch {
            return {
              tag: entry.tag,
              name: entry.name,
              elo: 0,
              iconId: entry.icon?.id ?? 28000000
            };
          }
        })
      );

      rankedLeaders = rankedProfiles
        .sort((a, b) => b.elo - a.elo)
        .slice(0, 10)
        .map((player, index) => ({
          ...player,
          rank: index + 1,
          rankLabel: player.elo > 0 ? formatRank(player.elo) : "Unranked"
        }));
    } catch (error) {
      rankedError = error instanceof Error ? error.message : "Classement indisponible.";
    }
  } else if (!topPlayersError) {
    rankedError = "Classement indisponible.";
  }

  try {
    const topEarnings = await getTopProPlayersByEarnings(10);
    if (topEarnings.length === 0) {
      esportError = "Aucune donnée earnings en base `pro_players`.";
    } else {
      const withIcons = await Promise.all(
        topEarnings.map(async (pro) => {
          try {
            const live = await getPlayer(pro.player_tag);
            return { pro, iconId: live.icon?.id ?? 28000000 };
          } catch {
            return { pro, iconId: 28000000 };
          }
        })
      );

      esportLeaders = withIcons.map(({ pro, iconId }) => ({
        tag: pro.player_tag,
        displayName: pro.display_name,
        team: pro.team,
        earningsUsd: Number(pro.matcherino_earnings_usd ?? 0),
        matcherinoUrl: pro.matcherino_url,
        iconId
      }));
    }
  } catch (error) {
    esportError = error instanceof Error ? error.message : "Top esport indisponible.";
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
