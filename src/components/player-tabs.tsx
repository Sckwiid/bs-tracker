"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BrawlerCard } from "@/components/BrawlerCard";
import { PlayedBrawler, WinrateBreakdown } from "@/lib/metrics";
import { HistoryRow } from "@/lib/supabase";
import { formatRank } from "@/lib/utils";
import { BrawlerStat } from "@/types/brawl";

type TabKey = "ladder" | "ranked" | "history";

interface PlayerTabsProps {
  topBrawlers: PlayedBrawler[];
  allBrawlers: BrawlerStat[];
  winrates25: WinrateBreakdown;
  estimatedPlaytimeHours: number;
  trophiesCurrent: number;
  victories3v3: number;
  rankedElo: number;
  highestRankedTrophies?: number | null;
  history: HistoryRow[];
  proVerified?: boolean;
}

function localizeDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

function brawlerName(name: BrawlerStat["name"], fallback: number): string {
  if (!name) return `Brawler #${fallback}`;
  if (typeof name === "string") return name;
  return Object.values(name)[0] ?? `Brawler #${fallback}`;
}

export function PlayerTabs({
  topBrawlers,
  allBrawlers,
  winrates25,
  estimatedPlaytimeHours,
  trophiesCurrent,
  victories3v3,
  rankedElo,
  highestRankedTrophies = null,
  history,
  proVerified = false
}: PlayerTabsProps) {
  const [tab, setTab] = useState<TabKey>("ladder");
  const byId = useMemo(() => new Map(allBrawlers.map((brawler) => [brawler.id, brawler])), [allBrawlers]);

  const chartData = history.map((item) => ({
    date: localizeDate(item.snapshot_date),
    trophies: item.trophies,
    max: item.highest_trophies
  }));

  const rankedValue = winrates25.rankedWinrate;
  const ladderValue = winrates25.ladderWinrate;
  const performanceIndex = trophiesCurrent > 0 ? Number(((victories3v3 * 100) / trophiesCurrent).toFixed(2)) : null;
  const effectiveRankedElo =
    rankedElo > 0 ? rankedElo : Math.max(0, Number(highestRankedTrophies ?? 0));
  const rankedLabel = formatRank(effectiveRankedElo);

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-surface-900/70 p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {(["ladder", "ranked", "history"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "bg-neon-cyan text-surface-900"
                : "border border-slate-700 bg-surface-900 text-slate-200 hover:border-neon-cyan/60"
            }`}
          >
            {key === "ladder" ? "Ladder" : key === "ranked" ? "Ranked" : "Historique"}
          </button>
        ))}
      </div>

      {tab === "ladder" ? (
        <div className="space-y-4">
          <h2 className="mb-3 text-lg font-bold text-white">Top 10 brawlers les plus joués</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {topBrawlers.map((entry) => {
              const brawler = byId.get(entry.id);
              if (!brawler) return null;
              return (
                <div key={entry.id} className="space-y-1">
                  <BrawlerCard
                    brawler={brawler}
                    name={brawlerName(brawler.name, brawler.id)}
                    proVerified={proVerified}
                  />
                  <p className="px-1 text-xs text-neon-cyan">Prestige: {entry.prestige}</p>
                </div>
              );
            })}
          </div>

          <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
            <h3 className="text-sm uppercase tracking-widest text-slate-400">Performance Récente</h3>
            <p className="mt-2 text-sm text-slate-200">
              Ladder Winrate (25 derniers matchs trophées):{" "}
              {ladderValue === null ? "Aucun match récent" : `${ladderValue}%`}
            </p>
            <p className="text-sm text-slate-200">
              Indice de Performance: {performanceIndex === null ? "N/A" : `${performanceIndex}%`}
            </p>
          </article>
        </div>
      ) : null}

      {tab === "ranked" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Rank Classé</p>
            <p className="mt-2 text-3xl font-bold text-white">{rankedLabel}</p>
            <p className="text-sm text-slate-300">{Math.max(0, Math.round(effectiveRankedElo))} ELO</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Winrate Classé (25 derniers matchs)</p>
            <p className="mt-2 text-3xl font-bold text-neon-cyan">{rankedValue === null ? "N/A" : `${rankedValue}%`}</p>
            <p className="text-sm text-slate-300">
              {rankedValue === null ? "Aucun match récent classé" : "Performance classée"}
            </p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Bilan</p>
            <p className="mt-2 text-sm text-slate-200">Victoires: {winrates25.ranked.wins}</p>
            <p className="text-sm text-slate-200">Défaites: {winrates25.ranked.losses}</p>
            <p className="text-sm text-slate-200">Nuls: {winrates25.ranked.draws}</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Temps estimé</p>
            <p className="mt-2 text-2xl font-bold text-white">{estimatedPlaytimeHours.toFixed(1)} h</p>
            <p className="text-sm text-slate-300">Formule: (victoires x 3.5) / 60</p>
          </article>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Progression trophées / records</h2>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-300">Aucun snapshot journalier disponible pour le moment.</p>
          ) : (
            <div className="h-72 w-full rounded-xl border border-slate-700 bg-surface-900/80 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fill: "#b8c4dc", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#b8c4dc", fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="trophies" stroke="#39d8ff" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="max" stroke="#98ff3f" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="rounded-xl border border-slate-700 bg-surface-900 p-3 text-sm text-slate-300">
            Clubs historiques:{" "}
            {Array.from(new Set(history.map((point) => point.club_name || "Sans club"))).join(" → ") || "Aucun"}
          </div>
        </div>
      ) : null}
    </section>
  );
}
