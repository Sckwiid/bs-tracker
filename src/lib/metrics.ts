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

function classifyMatchType(battle: BattleItem): "ranked" | "ladder" | "other" {
  const mode = String(battle.battle?.mode ?? battle.event?.mode ?? "").toLowerCase();
  if (
    mode.includes("ranked") ||
    mode.includes("powerleague") ||
    mode.includes("power league") ||
    mode.includes("compet")
  ) {
    return "ranked";
  }
  if (typeof battle.battle?.trophyChange === "number") {
    return "ladder";
  }
  return "other";
}

function addOutcome(summary: WinrateSummary, outcome: "win" | "loss" | "draw") {
  if (outcome === "win") summary.wins += 1;
  if (outcome === "loss") summary.losses += 1;
  if (outcome === "draw") summary.draws += 1;
}

export function calculateWinrate25(battlelog: BattleItem[]): WinrateBreakdown {
  const source = battlelog.slice(0, 25);
  const overall = emptySummary();
  const ranked = emptySummary();
  const ladder = emptySummary();

  for (const battle of source) {
    const result = String(battle.battle?.result ?? "").toLowerCase();
    let outcome: "win" | "loss" | "draw" | null = null;

    if (isWin(result)) {
      outcome = "win";
    } else if (isLoss(result)) {
      outcome = "loss";
    } else if (result.includes("draw")) {
      outcome = "draw";
    } else if (typeof battle.battle?.rank === "number") {
      outcome = battle.battle.rank === 1 ? "win" : "loss";
    }

    if (!outcome) continue;

    addOutcome(overall, outcome);
    const type = classifyMatchType(battle);
    if (type === "ranked") addOutcome(ranked, outcome);
    if (type === "ladder") addOutcome(ladder, outcome);
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
  const brawlerAndPowerValue = brawlers.length * 170 + power11Count * 50;
  const estimatedSkinsValue = brawlers.length * 80;
  return brawlerAndPowerValue + estimatedSkinsValue;
}

export function extractRankedElo(player: Player): number {
  const source = player as unknown as Record<string, unknown>;
  const candidates = [
    source.elo,
    source.rankedElo,
    source.powerLeagueElo,
    source.currentElo,
    source.rankedScore,
    source.trophyLeagueElo
  ];

  let currentElo = 0;
  for (const candidate of candidates) {
    const parsed = asNumber(candidate);
    if (parsed !== null && parsed >= 0) {
      currentElo = parsed;
      break;
    }
  }

  if (currentElo > 0) {
    return currentElo;
  }

  const highestCandidates = [
    source.highestRankedTrophies,
    source.highest_ranked_trophies,
    source.bestRankedTrophies,
    source.bestElo
  ];

  for (const candidate of highestCandidates) {
    const parsed = asNumber(candidate);
    if (parsed !== null && parsed >= 0) {
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
