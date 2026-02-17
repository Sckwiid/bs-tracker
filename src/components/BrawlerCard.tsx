"use client";

import { SyntheticEvent } from "react";

import { BrawlerStat } from "@/types/brawl";

interface BrawlerCardProps {
  brawler: BrawlerStat;
  name: string;
  proVerified?: boolean;
}

export function BrawlerCard({ brawler, name, proVerified = false }: BrawlerCardProps) {
  const gadgets = brawler.gadgets?.length ?? 0;
  const starPowers = brawler.starPowers?.length ?? 0;
  const primaryImage = `https://cdn.brawlify.com/brawler/${brawler.id}.png`;
  const fallbackImage = `https://cdn-old.brawlify.com/brawler/${brawler.id}.png`;
  const defaultImage = "https://cdn.brawlify.com/brawler/16000000.png";

  function onImageError(event: SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    const step = img.dataset.fallbackStep ?? "0";
    if (step === "0") {
      img.dataset.fallbackStep = "1";
      img.src = fallbackImage;
      return;
    }
    if (step === "1") {
      img.dataset.fallbackStep = "2";
      img.src = defaultImage;
    }
  }

  return (
    <article className="relative rounded-2xl border border-slate-700/70 bg-surface-900/80 p-4">
      {proVerified ? (
        <span className="absolute right-3 top-3 rounded-full border border-neon-cyan/70 bg-neon-cyan/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-neon-cyan">
          PRO-VERIFIE
        </span>
      ) : null}
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-700/80 bg-surface-900">
          <img
            src={primaryImage}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={onImageError}
          />
        </div>
        <div>
          <h3 className="font-semibold text-white">{name}</h3>
          <p className="text-xs text-neon-cyan">Niveau {brawler.power} • Rank {brawler.rank}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-200">
        <p>Gadgets: {gadgets}/2</p>
        <p>Star Powers: {starPowers}/2</p>
        <p>Trophées: {brawler.trophies}</p>
        <p>Record: {brawler.highestTrophies}</p>
      </div>
    </article>
  );
}
