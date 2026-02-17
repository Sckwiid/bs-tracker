"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { normalizeTag } from "@/lib/utils";

interface TagSearchFormProps {
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

const RECENT_KEY = "brawstar_recent_tags_v1";

export function TagSearchForm({ placeholder = "#PLAYER", defaultValue = "", className }: TagSearchFormProps) {
  const router = useRouter();
  const [tag, setTag] = useState(defaultValue);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setHistory(Array.isArray(parsed) ? parsed.slice(0, 6) : []);
    } catch {
      setHistory([]);
    }
  }, []);

  function persistRecent(nextTag: string) {
    const next = [nextTag, ...history.filter((item) => item !== nextTag)].slice(0, 6);
    setHistory(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tag.trim()) return;
    const normalizedRaw = tag.replace("#", "").trim().toUpperCase();
    if (!normalizedRaw) return;
    const cleanTag = normalizeTag(normalizedRaw);
    persistRecent(cleanTag);
    router.push(`/player/${encodeURIComponent(cleanTag)}`);
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          className="w-full rounded-xl border border-cyan-500/40 bg-surface-900/80 px-4 py-3 text-base text-white outline-none ring-cyan-300/60 transition focus:ring"
          placeholder={placeholder}
          autoComplete="off"
          aria-label="Tag Brawl Stars"
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-lime px-5 py-3 font-semibold text-surface-900 transition hover:brightness-110"
        >
          Rechercher
        </button>
      </div>

      {history.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-slate-400">Historique récent:</span>
          {history.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setTag(item);
                persistRecent(item);
                router.push(`/player/${encodeURIComponent(item)}`);
              }}
              className="rounded-lg border border-slate-700 bg-surface-900 px-2 py-1 text-xs text-slate-200 hover:border-neon-cyan/60"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
