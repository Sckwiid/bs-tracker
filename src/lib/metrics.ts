import { BattleItem, BrawlerStat, Player } from "@/types/brawl";

export interface WinrateSummary {
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  winrate: number;
}

export interface WinrateBreakdown {
  overall: WinrateSummary;
  ranked: WinrateSummary;
  ladder: WinrateSummary;
  rankedWinrate: number | null;
  ladderWinrate: number | null;
}

export interface PlayedBrawler {
  id: number;
  name: string;
  trophies: number;
  highestTrophies: number;
  rank: number;
  power: number;
  prestige: number;
  gamesEstimate: number;
}

export interface ExtractRankedEloOptions {
  fallbackFromDb?: number | null;
}

type MatchType = "ranked" | "ladder" | "other";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function isWin(result: string): boolean {
  return result.includes("victory") || result.includes("win");
}

function isLoss(result: string): boolean {
  return result.includes("defeat") || result.includes("loss") || result.includes("lose");
}

function emptySummary(): WinrateSummary {
  return { wins: 0, losses: 0, draws: 0, matches: 0, winrate: 0 };
}

function computeWinrate(summary: WinrateSummary): WinrateSummary {
  const matches = summary.wins + summary.losses + summary.draws;
  return {
    ...summary,
    matches,
    winrate: matches > 0 ? Number(((summary.wins / matches) * 100).toFixed(2)) : 0
  };
}

function classifyMatchType(battle: BattleItem): MatchType {
  const mode = String(battle.battle?.mode ?? battle.event?.mode ?? "").toLowerCase();
  const type = String((battle.battle as Record<string, unknown> | undefined)?.type ?? "").toLowerCase();
  const key = `${mode} ${type}`;
  if (
    key.includes("ranked") ||
    key.includes("powerleague") ||
    key.includes("power league") ||
    key.includes("soloranked") ||
    key.includes("solo ranked") ||
    key.includes("teamranked") ||
    key.includes("team ranked")
  ) {
    return "ranked";
  }

  // Matchs ladder: présence d'un changement de trophées.
  if (typeof battle.battle?.trophyChange === "number") {
    return "ladder";
  }

  // Fallback permissif: tout match non classé est compté en ladder
  // pour éviter les N/A quand le payload ne contient pas trophyChange.
  return "ladder";
}

function addOutcome(summary: WinrateSummary, outcome: "win" | "loss" | "draw") {
  if (outcome === "win") summary.wins += 1;
  if (outcome === "loss") summary.losses += 1;
  if (outcome === "draw") summary.draws += 1;
}

function parseOutcome(battle: BattleItem): "win" | "loss" | "draw" | null {
  const result = String(battle.battle?.result ?? "").toLowerCase();
  if (isWin(result)) return "win";
  if (isLoss(result)) return "loss";
  if (result.includes("draw")) return "draw";

  if (typeof battle.battle?.rank === "number") {
    return battle.battle.rank === 1 ? "win" : "loss";
  }

  return null;
}

function summarizeFromEntries(entries: Array<{ type: MatchType; outcome: "win" | "loss" | "draw" }>): WinrateBreakdown {
  const overall = emptySummary();
  const ranked = emptySummary();
  const ladder = emptySummary();

  for (const entry of entries) {
    addOutcome(overall, entry.outcome);
    if (entry.type === "ranked") addOutcome(ranked, entry.outcome);
    if (entry.type === "ladder") addOutcome(ladder, entry.outcome);
  }

  const overallSummary = computeWinrate(overall);
  const rankedSummary = computeWinrate(ranked);
  const ladderSummary = computeWinrate(ladder);

  return {
    overall: overallSummary,
    ranked: rankedSummary,
    ladder: ladderSummary,
    rankedWinrate: rankedSummary.matches > 0 ? rankedSummary.winrate : null,
    ladderWinrate: ladderSummary.matches > 0 ? ladderSummary.winrate : null
  };
}

export function calculateWinrate25(battlelog: BattleItem[]): WinrateBreakdown {
  // Scan plus large pour éviter N/A quand les 25 premières lignes sont incomplètes.
  const scanned = battlelog.slice(0, 60);
  const parsed: Array<{ type: MatchType; outcome: "win" | "loss" | "draw" }> = [];

  for (const battle of scanned) {
    const outcome = parseOutcome(battle);
    if (!outcome) continue;
    parsed.push({ type: classifyMatchType(battle), outcome });
    if (parsed.length >= 25) break;
  }

  return summarizeFromEntries(parsed);
}

export function estimatePlaytimeMinutes(victories: number): number {
  return Number((Math.max(victories, 0) * 3.5).toFixed(2));
}

export function estimatePlayerPlaytime(player: Player): number {
  const victories3v3 = player["3vs3Victories"] ?? 0;
  const solo = player.soloVictories ?? 0;
  const duo = player.duoVictories ?? 0;
  const minutes = estimatePlaytimeMinutes(victories3v3 + solo + duo);
  return Number((minutes / 60).toFixed(2));
}

export function estimateAccountValue(player: Player): number {
  const brawlers = player.brawlers ?? [];
  const power11Count = brawlers.filter((brawler) => (brawler.power ?? 0) >= 11).length;
  // (Brawlers * 170) + (Power11 * 50) + (Brawlers * 80 skins forfaitaires)
  return brawlers.length * 170 + power11Count * 50 + brawlers.length * 80;
}

function readCurrentRankedElo(source: Record<string, unknown>): number {
  const candidates = [
    source.elo,
    source.rankedElo,
    source.powerLeagueElo,
    source.currentElo,
    source.rankedScore,
    source.trophyLeagueElo
  ];

  for (const candidate of candidates) {
    const parsed = asNumber(candidate);
    if (parsed !== null && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

function looksMasterLike(source: Record<string, unknown>): boolean {
  const textCandidates = [
    source.rankName,
    source.rank,
    source.currentRank,
    source.rankedLeague,
    source.rankedTier
  ];

  for (const raw of textCandidates) {
    const value = String(raw ?? "").toLowerCase();
    if (value.includes("master")) {
      return true;
    }
  }

  const numericCandidates = [source.rank, source.currentRankLevel, source.rankedLevel];
  for (const raw of numericCandidates) {
    const value = asNumber(raw);
    if (value !== null && value >= 19) {
      return true;
    }
  }

  return false;
}

function readHighestRankedElo(source: Record<string, unknown>): number {
  const candidates = [
    source.highestRankedTrophies,
    source.highest_ranked_trophies,
    source.rankedTrophies,
    source.ranked_trophies,
    source.bestRankedTrophies,
    source.bestElo
  ];

  for (const candidate of candidates) {
    const parsed = asNumber(candidate);
    if (parsed !== null && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

export function extractRankedElo(player: Player, options: ExtractRankedEloOptions = {}): number {
  const source = player as unknown as Record<string, unknown>;
  const currentElo = readCurrentRankedElo(source);

  if (currentElo > 0) {
    return currentElo;
  }

  // Début de saison: current ELO parfois 0/null.
  // En Master, on force la recherche sur les champs historiques ranked.
  if (looksMasterLike(source)) {
    const masterFallback = readHighestRankedElo(source);
    if (masterFallback > 0) {
      return masterFallback;
    }
  }

  const genericFallback = readHighestRankedElo(source);
  if (genericFallback > 0) {
    return genericFallback;
  }

  const dbFallback = asNumber(options.fallbackFromDb);
  if (dbFallback !== null && dbFallback > 0) {
    return dbFallback;
  }

  const embeddedDbCandidates = [
    source.lastRankedElo,
    source.last_ranked_elo,
    source.previousRankedElo,
    source.previous_ranked_elo
  ];
  for (const candidate of embeddedDbCandidates) {
    const parsed = asNumber(candidate);
    if (parsed !== null && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

function brawlerName(name: BrawlerStat["name"], fallbackId: number): string {
  if (!name) return `Brawler #${fallbackId}`;
  if (typeof name === "string") return name;
  return Object.values(name)[0] ?? `Brawler #${fallbackId}`;
}

export function topPlayedBrawlers(brawlers: BrawlerStat[], limit = 10): PlayedBrawler[] {
  return [...brawlers]
    .sort((a, b) => b.trophies - a.trophies)
    .slice(0, limit)
    .map((brawler) => ({
      id: brawler.id,
      name: brawlerName(brawler.name, brawler.id),
      trophies: brawler.trophies,
      highestTrophies: brawler.highestTrophies,
      rank: brawler.rank,
      power: brawler.power,
      prestige: Math.max(0, brawler.highestTrophies - brawler.trophies),
      gamesEstimate: Math.round(brawler.trophies / 8)
    }));
}
