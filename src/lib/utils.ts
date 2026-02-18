export const SITE_VERSION = "1.0.7";

export function normalizeTag(rawTag: string): string {
  const trimmed = rawTag.trim().toUpperCase().replace(/%23/g, "").replace(/^#/, "");
  return `#${trimmed}`;
}

export function encodeTag(rawTag: string): string {
  return encodeURIComponent(normalizeTag(rawTag));
}

export function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "0";
  }
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function toBrawlerSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function modeOfBattle(item: { battle?: { mode?: string }; event?: { mode?: string } }): string {
  return item.battle?.mode ?? item.event?.mode ?? "unknown";
}

export function formatRank(elo: number): string {
  const value = Number.isFinite(elo) ? Math.max(0, elo) : 0;

  if (value < 250) return "Bronze 1";
  if (value < 500) return "Bronze 2";
  if (value < 750) return "Bronze 3";

  if (value < 1000) return "Argent 1";
  if (value < 1250) return "Argent 2";
  if (value < 1500) return "Argent 3";

  if (value < 2000) return "Or 1";
  if (value < 2500) return "Or 2";
  if (value < 3000) return "Or 3";

  if (value < 3500) return "Diamant 1";
  if (value < 4000) return "Diamant 2";
  if (value < 4500) return "Diamant 3";

  if (value < 5000) return "Mythique 1";
  if (value < 5500) return "Mythique 2";
  if (value < 6000) return "Mythique 3";

  if (value < 6750) return "Légendaire 1";
  if (value < 7500) return "Légendaire 2";
  if (value < 8250) return "Légendaire 3";

  if (value < 9250) return "Master 1";
  if (value < 10250) return "Master 2";
  if (value < 11250) return "Master 3";
  return "Pro";
}
