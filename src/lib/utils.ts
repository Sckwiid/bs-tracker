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
