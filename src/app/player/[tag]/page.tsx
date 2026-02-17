import type { Metadata } from "next";
import Link from "next/link";

import { PlayerTabs } from "@/components/player-tabs";
import { BrawlApiError, getPlayer } from "@/lib/brawlApi";
import { fetchAndStorePlayerSnapshot } from "@/lib/snapshots";
import { formatNumber, normalizeTag, toBrawlerSlug } from "@/lib/utils";
import { BrawlerStat, Player } from "@/types/brawl";

interface PlayerPageProps {
  params: { tag: string };
}

function gradeFromTrophies(trophies: number): string {
  if (trophies >= 70000) return "Master";
  if (trophies >= 55000) return "Diamond";
  if (trophies >= 40000) return "Gold";
  if (trophies >= 25000) return "Silver";
  return "Bronze";
}

function brawlerName(name: BrawlerStat["name"], fallback: number): string {
  if (!name) return `brawler-${fallback}`;
  if (typeof name === "string") return name;
  return Object.values(name)[0] ?? `brawler-${fallback}`;
}

function favoriteBrawlerIcon(player: Player): string {
  const top = [...player.brawlers].sort((a, b) => b.trophies - a.trophies)[0];
  if (!top) {
    return "https://cdn.brawlify.com/brawlers/borderless/shelly.png";
  }
  const name = brawlerName(top.name, top.id);
  return `https://cdn.brawlify.com/brawlers/borderless/${toBrawlerSlug(name)}.png`;
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const tag = normalizeTag(decodeURIComponent(params.tag));
  try {
    const player = await getPlayer(tag);
    const image = favoriteBrawlerIcon(player);
    return {
      title: `${player.name} (${player.tag}) - Stats Brawl Stars`,
      description: `${player.name}: ${player.trophies} trophées, record ${player.highestTrophies}, club ${player.club?.name ?? "sans club"}.`,
      alternates: {
        canonical: `/player/${encodeURIComponent(tag)}`
      },
      openGraph: {
        title: `${player.name} (${player.tag}) - Stats Brawl Stars`,
        description: `${player.name}: ${player.trophies} trophées, record ${player.highestTrophies}.`,
        images: [
          {
            url: image,
            alt: `Brawler préféré de ${player.name}`
          }
        ]
      }
    };
  } catch {
    return {
      title: `${tag} - Profil Brawl Stars`,
      description: `Statistiques live et historique de ${tag}.`,
      alternates: {
        canonical: `/player/${encodeURIComponent(tag)}`
      },
      openGraph: {
        title: `${tag} - Profil Brawl Stars`,
        description: `Statistiques live et historique de ${tag}.`,
        images: [
          {
            url: "https://cdn.brawlify.com/brawlers/borderless/shelly.png",
            alt: "BrawStar Tracker"
          }
        ]
      }
    };
  }
}

export const revalidate = 20;

export default async function PlayerPage({ params }: PlayerPageProps) {
  const tag = normalizeTag(decodeURIComponent(params.tag));

  try {
    const bundle = await fetchAndStorePlayerSnapshot(tag);
    const player = bundle.player;
    const currentGrade = gradeFromTrophies(player.trophies);
    const maxGrade = gradeFromTrophies(player.highestTrophies);

    return (
      <div className="space-y-6">
        <header className="rounded-2xl border border-slate-700/70 bg-surface-900/75 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-neon-cyan">{player.tag}</p>
              <h1 className="flex items-center gap-2 font-[var(--font-title)] text-3xl text-white">
                <span>{player.name}</span>
                {bundle.isProVerified ? (
                  <span className="rounded-full border border-neon-cyan/70 bg-neon-cyan/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-neon-cyan">
                    PRO-VERIFIE
                  </span>
                ) : null}
              </h1>
              <p className="mt-1 text-sm text-slate-300">Club: {player.club?.name ?? "Sans club"}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-surface-900 p-3 text-right text-sm">
              <p className="text-slate-300">Snapshot: {bundle.changed ? "mis à jour" : "inchangé"}</p>
              <p className="font-semibold text-neon-cyan">{bundle.history.length} points d&apos;historique</p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-slate-700 bg-surface-900/75 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Ladder</p>
            <p className="mt-2 text-3xl font-bold text-neon-cyan">{formatNumber(player.trophies)}</p>
            <p className="text-sm text-slate-300">Trophées actuels</p>
            <p className="text-sm text-slate-300">Record: {formatNumber(player.highestTrophies)}</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-surface-900/75 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Ranked</p>
            <p className="mt-2 text-2xl font-bold text-white">{currentGrade}</p>
            <p className="text-sm text-slate-300">Grade actuel (proxy trophées)</p>
            <p className="text-sm text-slate-300">Grade max: {maxGrade}</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-surface-900/75 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Performance</p>
            <p className="mt-2 text-2xl font-bold text-neon-cyan">{bundle.winrate25.winrate}%</p>
            <p className="text-sm text-slate-300">Winrate sur 25 matchs</p>
            <p className="text-sm text-slate-300">Temps estimé: {Math.round(bundle.estimatedPlaytimeMinutes)} min</p>
          </article>
        </section>

        <PlayerTabs
          topBrawlers={bundle.topBrawlers}
          allBrawlers={player.brawlers}
          winrate25={bundle.winrate25}
          estimatedPlaytimeMinutes={bundle.estimatedPlaytimeMinutes}
          history={bundle.history}
          proVerified={bundle.isProVerified}
        />

        <p className="text-sm text-slate-400">
          Retour <Link href="/" className="text-neon-cyan underline">Home</Link>
        </p>
      </div>
    );
  } catch (error) {
    if (error instanceof BrawlApiError && error.code === "PLAYER_NOT_FOUND") {
      return (
        <section className="rounded-2xl border border-rose-500/40 bg-surface-900/80 p-6">
          <h1 className="text-2xl font-bold text-white">Joueur introuvable</h1>
          <p className="mt-2 text-sm text-rose-200">Le tag {tag} n&apos;existe pas ou n&apos;est pas accessible.</p>
          <Link href="/" className="mt-4 inline-block text-neon-cyan underline">
            Revenir à l&apos;accueil
          </Link>
        </section>
      );
    }

    if (error instanceof BrawlApiError && error.code === "MAINTENANCE") {
      return (
        <section className="rounded-2xl border border-amber-500/50 bg-surface-900/80 p-6">
          <h1 className="text-2xl font-bold text-white">API en maintenance</h1>
          <p className="mt-2 text-sm text-amber-200">Le service Brawl Stars est temporairement indisponible.</p>
          <Link href="/" className="mt-4 inline-block text-neon-cyan underline">
            Revenir à l&apos;accueil
          </Link>
        </section>
      );
    }

    return (
      <section className="rounded-2xl border border-rose-500/40 bg-surface-900/80 p-6">
        <h1 className="text-2xl font-bold text-white">Erreur de chargement</h1>
        <p className="mt-2 text-sm text-rose-200">{error instanceof Error ? error.message : "Erreur inconnue."}</p>
      </section>
    );
  }
}
