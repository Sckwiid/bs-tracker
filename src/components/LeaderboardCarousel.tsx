"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatNumber } from "@/lib/utils";

interface LeaderboardTrend {
  direction: "up" | "down" | "stable" | "new";
  places: number;
  hasHistory: boolean;
}

type BoardIndex = 0 | 1 | 2;

interface TrophyEntry {
  tag: string;
  name: string;
  rank: number;
  trophies: number;
  iconId?: number | null;
  trend?: LeaderboardTrend;
}

interface RankedEntry {
  tag: string;
  name: string;
  rank: number;
  elo: number;
  rankLabel: string;
  iconId?: number | null;
  trend?: LeaderboardTrend;
}

interface EsportEntry {
  tag: string;
  displayName: string;
  team: string;
  earningsUsd: number;
  matcherinoUrl: string | null;
  iconId?: number | null;
  trend?: LeaderboardTrend;
}

interface LeaderboardCarouselProps {
  trophyLeaders: TrophyEntry[];
  rankedLeaders: RankedEntry[];
  esportLeaders: EsportEntry[];
  errors?: {
    trophy?: string | null;
    ranked?: string | null;
    esport?: string | null;
  };
}

const DEFAULT_ICON_URL = "https://cdn.brawlify.com/profile-icons/regular/28000000.png";

function iconUrl(iconId?: number | null): string {
  return `https://cdn.brawlify.com/profile-icons/regular/${iconId ?? 28000000}.png`;
}

function PlayerIcon({ iconId, alt }: { iconId?: number | null; alt: string }) {
  return (
    <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-700">
      <img
        src={iconUrl(iconId)}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={(event) => {
          const image = event.currentTarget;
          if (image.dataset.fallbackApplied === "1") return;
          image.dataset.fallbackApplied = "1";
          image.src = DEFAULT_ICON_URL;
        }}
      />
    </div>
  );
}

function boardLabel(index: BoardIndex): string {
  if (index === 0) return "Top 10 Joueurs Classés";
  if (index === 1) return "Top 10 Joueurs Mondiaux";
  return "Top 10 Gains Esport";
}

function TrendBadge({ trend }: { trend?: LeaderboardTrend }) {
  if (!trend || !trend.hasHistory) return null;
  if (trend.direction === "up") {
    return <span className="text-xs font-semibold text-[#98ff3f]">↑ {trend.places}</span>;
  }
  if (trend.direction === "down") {
    return <span className="text-xs font-semibold text-rose-400">↓ {trend.places}</span>;
  }
  return <span className="text-xs font-semibold text-slate-400">-</span>;
}

export function LeaderboardCarousel({ trophyLeaders, rankedLeaders, esportLeaders, errors }: LeaderboardCarouselProps) {
  const [activeIndex, setActiveIndex] = useState<BoardIndex>(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const timerRef = useRef<number | null>(null);

  function scheduleChange(next: BoardIndex, nextDirection: 1 | -1) {
    if (isTransitioning) return;
    setDirection(nextDirection);
    setIsTransitioning(true);
    timerRef.current = window.setTimeout(() => {
      setActiveIndex(next);
      setIsTransitioning(false);
    }, 220);
  }

  function nextBoard() {
    const next = ((activeIndex + 1) % 3) as BoardIndex;
    scheduleChange(next, 1);
  }

  function prevBoard() {
    const next = ((activeIndex + 2) % 3) as BoardIndex;
    scheduleChange(next, -1);
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDirection(1);
      setIsTransitioning(true);
      timerRef.current = window.setTimeout(() => {
        setActiveIndex((prev) => ((prev + 1) % 3) as BoardIndex);
        setIsTransitioning(false);
      }, 220);
    }, 15_000);

    return () => {
      window.clearInterval(interval);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const content = useMemo(() => {
    if (activeIndex === 0) {
      if (rankedLeaders.length === 0) {
        return (
          <p className="text-sm text-rose-300">
            {errors?.ranked ?? "Top classé indisponible pour le moment."}
          </p>
        );
      }

      return (
        <div className="grid gap-3 md:grid-cols-2">
          {rankedLeaders.map((player) => (
            <Link
              key={player.tag}
              href={`/player/${encodeURIComponent(player.tag)}`}
              className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-surface-900/70 p-3 transition hover:border-neon-cyan/60"
            >
              <div className="text-xl font-black text-neon-cyan">#{player.rank}</div>
              <PlayerIcon iconId={player.iconId} alt={player.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-white">{player.name}</p>
                  <TrendBadge trend={player.trend} />
                </div>
                <p className="text-sm text-slate-300">
                  {player.rankLabel} • {formatNumber(player.elo)} ELO
                </p>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    if (activeIndex === 1) {
      if (trophyLeaders.length === 0) {
        return (
          <p className="text-sm text-rose-300">
            {errors?.trophy ?? "Top mondial indisponible pour le moment."}
          </p>
        );
      }

      return (
        <div className="grid gap-3 md:grid-cols-2">
          {trophyLeaders.map((player) => (
            <Link
              key={player.tag}
              href={`/player/${encodeURIComponent(player.tag)}`}
              className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-surface-900/70 p-3 transition hover:border-neon-cyan/60"
            >
              <div className="text-xl font-black text-neon-cyan">#{player.rank}</div>
              <PlayerIcon iconId={player.iconId} alt={player.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-white">{player.name}</p>
                  <TrendBadge trend={player.trend} />
                </div>
                <p className="text-sm text-slate-300">
                  {formatNumber(player.trophies)} trophées • {player.tag}
                </p>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    if (esportLeaders.length === 0) {
      return (
        <p className="text-sm text-rose-300">
          {errors?.esport ?? "Top esport indisponible pour le moment."}
        </p>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        {esportLeaders.map((entry, index) => (
          <article key={entry.tag} className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-surface-900/70 p-3">
            <div className="text-xl font-black text-neon-cyan">#{index + 1}</div>
            <PlayerIcon iconId={entry.iconId} alt={entry.displayName} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-white">{entry.displayName}</p>
                <TrendBadge trend={entry.trend} />
              </div>
              <p className="text-xs uppercase tracking-wider text-neon-cyan">{entry.team}</p>
              <p className="text-sm text-slate-300">${formatNumber(entry.earningsUsd)}</p>
            </div>
            {entry.matcherinoUrl ? (
              <a
                href={entry.matcherinoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-neon-lime underline"
              >
                Matcherino
              </a>
            ) : null}
          </article>
        ))}
      </div>
    );
  }, [activeIndex, errors?.esport, errors?.ranked, errors?.trophy, esportLeaders, rankedLeaders, trophyLeaders]);

  return (
    <section className="rounded-2xl border border-slate-700/80 bg-surface-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{boardLabel(activeIndex)}</h2>
          <p className="text-xs text-slate-400">
            {activeIndex === 2 ? "Source: Supabase (Matcherino)" : "Source: Brawl Stars API"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevBoard}
            className="rounded-lg border border-neon-cyan/50 px-3 py-1 text-neon-cyan transition hover:shadow-glow"
            aria-label="Classement précédent"
          >
            ←
          </button>
          <button
            type="button"
            onClick={nextBoard}
            className="rounded-lg border border-neon-cyan/50 px-3 py-1 text-neon-cyan transition hover:shadow-glow"
            aria-label="Classement suivant"
          >
            →
          </button>
        </div>
      </div>

      <div
        className={`transition-all duration-300 ${
          isTransitioning
            ? direction === 1
              ? "translate-x-3 opacity-0"
              : "-translate-x-3 opacity-0"
            : "translate-x-0 opacity-100"
        }`}
      >
        {content}
      </div>
    </section>
  );
}
