"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BrawlerCard } from "@/components/BrawlerCard";
import { PlayedBrawler, WinrateSummary } from "@/lib/metrics";
import { HistoryRow } from "@/lib/supabase";
import { BrawlerStat } from "@/types/brawl";

type TabKey = "ladder" | "ranked" | "history";

interface PlayerTabsProps {
  topBrawlers: PlayedBrawler[];
  allBrawlers: BrawlerStat[];
  winrate25: WinrateSummary;
  estimatedPlaytimeMinutes: number;
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
  winrate25,
  estimatedPlaytimeMinutes,
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
        <div>
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
        </div>
      ) : null}

      {tab === "ranked" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">25 derniers matchs</p>
            <p className="mt-2 text-3xl font-bold text-neon-cyan">{winrate25.winrate}%</p>
            <p className="text-sm text-slate-300">Winrate</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Bilan</p>
            <p className="mt-2 text-sm text-slate-200">Victoires: {winrate25.wins}</p>
            <p className="text-sm text-slate-200">Défaites: {winrate25.losses}</p>
            <p className="text-sm text-slate-200">Nuls: {winrate25.draws}</p>
          </article>
          <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-400">Temps estimé</p>
            <p className="mt-2 text-2xl font-bold text-white">{Math.round(estimatedPlaytimeMinutes)} min</p>
            <p className="text-sm text-slate-300">Formule: victories x 3.5</p>
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
