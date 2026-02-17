import { BattleItem, BrawlerStat, Player } from "@/types/brawl";

export interface WinrateSummary {
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  winrate: number;
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

function isWin(result: string): boolean {
  return result.includes("victory") || result.includes("win");
}

function isLoss(result: string): boolean {
  return result.includes("defeat") || result.includes("loss") || result.includes("lose");
}

export function calculateWinrate25(battlelog: BattleItem[]): WinrateSummary {
  const source = battlelog.slice(0, 25);
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const battle of source) {
    const result = String(battle.battle?.result ?? "").toLowerCase();
    if (isWin(result)) {
      wins += 1;
      continue;
    }
    if (isLoss(result)) {
      losses += 1;
      continue;
    }
    if (result.includes("draw")) {
      draws += 1;
      continue;
    }
    if (typeof battle.battle?.rank === "number") {
      if (battle.battle.rank === 1) wins += 1;
      else losses += 1;
    }
  }

  const matches = wins + losses + draws;
  return {
    wins,
    losses,
    draws,
    matches,
    winrate: matches > 0 ? Number(((wins / matches) * 100).toFixed(2)) : 0
  };
}

export function estimatePlaytimeMinutes(victories: number): number {
  return Number((Math.max(victories, 0) * 3.5).toFixed(2));
}

export function estimatePlayerPlaytime(player: Player): number {
  const victories3v3 = player["3vs3Victories"] ?? 0;
  const solo = player.soloVictories ?? 0;
  const duo = player.duoVictories ?? 0;
  return estimatePlaytimeMinutes(victories3v3 + solo + duo);
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
