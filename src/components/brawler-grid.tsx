import Image from "next/image";

import { BrawlerStat, BrawlerCatalogEntry } from "@/types/brawl";
import { toBrawlerSlug } from "@/lib/utils";

interface BrawlerGridProps {
  brawlers: BrawlerStat[];
  catalog: BrawlerCatalogEntry[];
}

function localizedName(name: string | Record<string, string> | undefined): string | null {
  if (!name) return null;
  if (typeof name === "string") return name;
  const values = Object.values(name);
  return values[0] ?? null;
}

function resolveName(brawler: BrawlerStat, catalog: Map<number, string>): string {
  const name = localizedName(brawler.name);
  if (name) {
    return name;
  }
  return catalog.get(brawler.id) ?? `Brawler #${brawler.id}`;
}

export function BrawlerGrid({ brawlers, catalog }: BrawlerGridProps) {
  const nameById = new Map<number, string>(
    catalog.map((entry) => [entry.id, localizedName(entry.name) ?? `#${entry.id}`])
  );
  const ordered = [...brawlers].sort((a, b) => b.trophies - a.trophies);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {ordered.map((brawler) => {
        const name = resolveName(brawler, nameById);
        const imgSrc = `https://cdn.brawlify.com/brawlers/borderless/${toBrawlerSlug(name)}.png`;

        return (
          <article key={brawler.id} className="rounded-xl border border-slate-700/80 bg-surface-900/70 p-3">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-slate-700 bg-surface-800">
                <Image src={imgSrc} alt={name} fill className="object-cover" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{name}</h3>
                <p className="text-xs text-slate-400">Power {brawler.power} • Rank {brawler.rank}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-slate-300">Actuel: {brawler.trophies}</span>
              <span className="text-neon-lime">Max: {brawler.highestTrophies}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
