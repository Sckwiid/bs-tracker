"use client";

import { FormEvent, useState } from "react";

interface CompareResult {
  left: {
    tag: string;
    name: string;
    trophies: number;
    highestTrophies: number;
    winrate25: number;
  };
  right: {
    tag: string;
    name: string;
    trophies: number;
    highestTrophies: number;
    winrate25: number;
  };
  comparison: {
    favorite: {
      side: "left" | "right" | "even";
      tag: string | null;
      name: string | null;
      reasons: string[];
    };
    sharedClubs: string[];
    similarStats: boolean;
    recordDiff: number;
    winrateDiff: number;
    faceToFace: {
      matches: number;
      leftWins: number;
      rightWins: number;
      draws: number;
    };
  };
}

export function CompareTool() {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ left, right }).toString();
      const response = await fetch(`/api/compare?${query}`);
      const payload = (await response.json()) as CompareResult | { error?: string };
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error : "Erreur comparaison.");
      }
      setResult(payload as CompareResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur comparaison.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-surface-800/80 p-5">
      <h2 className="text-lg font-bold text-white">Face-à-Face</h2>
      <p className="mt-1 text-sm text-slate-300">Compare deux tags en live (trophées + winrate sur 25 matchs).</p>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={left}
          onChange={(event) => setLeft(event.target.value)}
          placeholder="#TAG_1"
          className="rounded-xl border border-cyan-500/40 bg-surface-900 px-3 py-2 text-white outline-none ring-cyan-300/60 focus:ring"
        />
        <input
          value={right}
          onChange={(event) => setRight(event.target.value)}
          placeholder="#TAG_2"
          className="rounded-xl border border-cyan-500/40 bg-surface-900 px-3 py-2 text-white outline-none ring-cyan-300/60 focus:ring"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-lime px-4 py-2 font-semibold text-surface-900 disabled:opacity-60"
        >
          {loading ? "Analyse..." : "Comparer"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
              <p className="text-sm text-slate-400">{result.left.tag}</p>
              <h3 className="text-xl font-semibold text-white">{result.left.name}</h3>
              <p className="mt-2 text-sm text-slate-200">Trophées: {result.left.trophies}</p>
              <p className="text-sm text-slate-200">Max: {result.left.highestTrophies}</p>
              <p className="text-sm text-neon-lime">Winrate (25): {result.left.winrate25}%</p>
            </article>
            <article className="rounded-xl border border-slate-700 bg-surface-900 p-4">
              <p className="text-sm text-slate-400">{result.right.tag}</p>
              <h3 className="text-xl font-semibold text-white">{result.right.name}</h3>
              <p className="mt-2 text-sm text-slate-200">Trophées: {result.right.trophies}</p>
              <p className="text-sm text-slate-200">Max: {result.right.highestTrophies}</p>
              <p className="text-sm text-neon-lime">Winrate (25): {result.right.winrate25}%</p>
            </article>
          </div>

          <article className="rounded-xl border border-neon-cyan/40 bg-surface-900 p-4">
            <h3 className="text-sm uppercase tracking-wider text-neon-cyan">Verdict Favori</h3>
            <p className="mt-1 text-base font-semibold text-white">
              {result.comparison.favorite.side === "even"
                ? "Duel équilibré"
                : `${result.comparison.favorite.name} est favori`}
            </p>
            <p className="text-sm text-slate-300">
              Clubs communs:{" "}
              {result.comparison.sharedClubs.length > 0 ? result.comparison.sharedClubs.join(", ") : "Aucun détecté"}
            </p>
            <p className="text-sm text-slate-300">
              Face-à-face récent: {result.comparison.faceToFace.matches} match(es) • {result.left.name}{" "}
              {result.comparison.faceToFace.leftWins} - {result.comparison.faceToFace.rightWins} {result.right.name}
            </p>
            <p className="text-sm text-slate-300">
              Similarité des stats: {result.comparison.similarStats ? "Oui" : "Non"}
            </p>
            <p className="text-sm text-slate-300">
              Écart record: {result.comparison.recordDiff} • Écart winrate: {result.comparison.winrateDiff}%
            </p>
            {result.comparison.favorite.reasons.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {result.comparison.favorite.reasons.map((reason) => (
                  <li key={reason}>- {reason}</li>
                ))}
              </ul>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
