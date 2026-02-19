import "server-only";

import { BattleItem, BrawlerCatalogEntry, BrawlListResponse, Player, PlayerRanking } from "@/types/brawl";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeTag } from "@/lib/utils";

const FETCH_TIMEOUT_MS = 10_000;
const BRAWL_API_TOKEN = process.env.BRAWL_API_TOKEN;

const RAW_BRAWL_API_BASE = (process.env.BRAWL_API_BASE_URL ?? "https://api.brawlstars.com/v1").trim();
const SANITIZED_BRAWL_API_BASE = RAW_BRAWL_API_BASE.replace(/\/+$/, "");
const BRAWL_API_BASE_URL = /\/v1$/i.test(SANITIZED_BRAWL_API_BASE)
  ? SANITIZED_BRAWL_API_BASE
  : `${SANITIZED_BRAWL_API_BASE}/v1`;

const BRAWLIFY_API_BASE_URL = (process.env.BRAWLIFY_API_BASE_URL ?? "https://api.brawlify.com/v1")
  .trim()
  .replace(/\/+$/, "");

type BrawlApiErrorCode = "UNAUTHORIZED" | "PLAYER_NOT_FOUND" | "MAINTENANCE" | "HTTP_ERROR";

export class BrawlApiError extends Error {
  status: number;
  code: BrawlApiErrorCode;

  constructor(message: string, status: number, code: BrawlApiErrorCode) {
    super(message);
    this.name = "BrawlApiError";
    this.status = status;
    this.code = code;
  }
}

export interface BrawlifyTierEntry {
  id: number;
  name: string;
  imageUrl: string | null;
  winrate: number;
  tier: "S" | "A" | "B" | "C";
}

export type LeaderboardType = "world" | "ranked" | "esport";
export type TrendDirection = "up" | "down" | "stable" | "new";

export interface LeaderboardTrend {
  direction: TrendDirection;
  places: number;
  hasHistory: boolean;
}

export interface RankedLeaderboardEntry {
  tag: string;
  name: string;
  rank: number;
  score: number;
  icon?: { id: number } | null;
}

export interface EsportLeaderboardEntry {
  tag: string;
  displayName: string;
  team: string;
  matcherinoUrl: string | null;
  earningsUsd: number;
  iconId?: number;
}

function requireToken() {
  if (!BRAWL_API_TOKEN) {
    throw new BrawlApiError("BRAWL_API_TOKEN manquant.", 500, "UNAUTHORIZED");
  }
  return BRAWL_API_TOKEN;
}

function mapStatusToCode(status: number): BrawlApiErrorCode {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 404) return "PLAYER_NOT_FOUND";
  if (status === 503) return "MAINTENANCE";
  return "HTTP_ERROR";
}

function normalizeApiPath(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.replace(/^\/v1(?=\/|$)/, "");
}

function buildBrawlApiUrl(path: string): string {
  return `${BRAWL_API_BASE_URL}${normalizeApiPath(path)}`;
}

function buildBrawlifyApiUrl(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return `${BRAWLIFY_API_BASE_URL}${withSlash}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } },
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function brawlFetch<T>(path: string, revalidate = 30): Promise<T> {
  const token = requireToken();
  let response: Response;
  try {
    response = await fetchWithTimeout(
      buildBrawlApiUrl(path),
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        next: {
          revalidate
        }
      },
      FETCH_TIMEOUT_MS
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw new BrawlApiError(`Brawl API timeout (${FETCH_TIMEOUT_MS}ms)`, 504, "HTTP_ERROR");
    }
    throw error;
  }

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { message?: string; reason?: string };
      detail = payload.message ?? payload.reason ?? "";
    } catch {
      detail = await response.text();
    }

    const code = mapStatusToCode(response.status);
    throw new BrawlApiError(
      `Brawl API error (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
      code
    );
  }

  return response.json() as Promise<T>;
}

export function encodePlayerTag(tag: string): string {
  return encodeURIComponent(normalizeTag(tag));
}

export async function getPlayer(tag: string): Promise<Player> {
  const safeTag = encodePlayerTag(tag);
  return brawlFetch<Player>(`/players/${safeTag}`, 20);
}

export async function getPlayerBattlelog(tag: string, limit = 25): Promise<BattleItem[]> {
  const safeTag = encodePlayerTag(tag);
  const data = await brawlFetch<BrawlListResponse<BattleItem>>(`/players/${safeTag}/battlelog`, 20);
  const items = data.items ?? [];
  if (limit <= 0) return items;
  return items.slice(0, Math.min(limit, items.length));
}

export const getBattlelog = getPlayerBattlelog;

export async function getTopPlayers(limit = 10): Promise<PlayerRanking[]> {
  const data = await brawlFetch<BrawlListResponse<PlayerRanking>>("/rankings/global/players", 120);
  const parsed = (data.items ?? []).map((item) => ({
    ...item,
    rank: Number(item.rank ?? 0),
    // Important: value de leaderboard mondial = item.trophies (jamais item.rank).
    trophies: Number(item.trophies ?? 0)
  }));

  return parsed.slice(0, limit);
}

function parseNumericScore(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function rankTierFloorFromLabel(value: unknown): number {
  if (typeof value !== "string") return 0;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!normalized) return 0;

  const level = normalized.includes("iii") || normalized.includes(" 3")
    ? 3
    : normalized.includes("ii") || normalized.includes(" 2")
      ? 2
      : normalized.includes("i") || normalized.includes(" 1")
        ? 1
        : 1;

  if (normalized.includes("pro")) return 11250;
  if (normalized.includes("master")) return level === 3 ? 10250 : level === 2 ? 9250 : 8250;
  if (normalized.includes("legend")) return level === 3 ? 7500 : level === 2 ? 6750 : 6000;
  if (normalized.includes("myth")) return level === 3 ? 5500 : level === 2 ? 5000 : 4500;
  if (normalized.includes("diam")) return level === 3 ? 4000 : level === 2 ? 3500 : 3000;
  if (normalized.includes("gold") || normalized.includes("or ")) return level === 3 ? 2500 : level === 2 ? 2000 : 1500;
  if (normalized.includes("silver") || normalized.includes("argent")) return level === 3 ? 1250 : level === 2 ? 1000 : 750;
  if (normalized.includes("bronze")) return level === 3 ? 500 : level === 2 ? 250 : 0;

  return 0;
}

export function extractRankedData(player: any): number {
  if (!player || typeof player !== "object") return 0;

  const rankedDebug = {
    highestRankedTrophies: player.highestRankedTrophies,
    rankedTrophies: player.rankedTrophies,
    rankedScore: player.rankedScore,
    elo: player.elo,
    highest_ranked_trophies: player.highest_ranked_trophies,
    ranked_trophies: player.ranked_trophies,
    ranked_score: player.ranked_score,
    ranked_elo: player.ranked_elo,
    rankedElo: player.rankedElo,
    powerLeagueElo: player.powerLeagueElo,
    power_league_elo: player.power_league_elo,
    currentElo: player.currentElo,
    current_elo: player.current_elo,
    rank: player.rank,
    rankName: player.rankName,
    rankedTier: player.rankedTier,
    rankedLeague: player.rankedLeague
  };
  console.log("RAW RANKED DATA FOR DEBUG:", player.tag, rankedDebug);

  const directCandidates = Object.values(rankedDebug);

  let maxValue = 0;
  for (const candidate of directCandidates) {
    const value = parseNumericScore(candidate);
    if (value > maxValue) maxValue = value;
    const tierFloor = rankTierFloorFromLabel(candidate);
    if (tierFloor > maxValue) maxValue = tierFloor;
  }

  // Fallback souple: l'API change parfois les clés.
  const stack: unknown[] = [player];
  const seen = new Set<unknown>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const value of current) stack.push(value);
      continue;
    }

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        stack.push(value);
        continue;
      }

      if (/(highest.?ranked|ranked|elo|power.?league|rank|tier|league)/i.test(key)) {
        const parsed = parseNumericScore(value);
        if (parsed > maxValue) maxValue = parsed;
        const tierFloor = rankTierFloorFromLabel(value);
        if (tierFloor > maxValue) maxValue = tierFloor;
      }
    }
  }

  return maxValue;
}

export async function getTopRankedPlayers(limit = 10): Promise<RankedLeaderboardEntry[]> {
  // Endpoint officiel documenté pour les joueurs.
  const candidatePaths = ["/rankings/global/players"];

  for (const path of candidatePaths) {
    try {
      const data = await brawlFetch<BrawlListResponse<Record<string, unknown>>>(path, 120);
      const items = data.items ?? [];
      const parsed = items
        .map((item, index) => {
          // Important: value de leaderboard classé = item.score (jamais item.rank).
          const apiScore = parseNumericScore(item.score ?? item.rankedScore ?? item.elo ?? item.value);
          const extractedScore = extractRankedData(item);
          const score = Math.max(apiScore, extractedScore);
          if (score <= 0) return null;
          return {
            tag: String(item.tag ?? ""),
            name: String(item.name ?? "Unknown"),
            rank: Number(item.rank ?? index + 1),
            score,
            icon: { id: Number((item.icon as any)?.id ?? 28000000) }
          };
        })
        .filter((e): e is any => e !== null)
        .slice(0, limit) as RankedLeaderboardEntry[];

      if (parsed.length > 0) return parsed;
    } catch {
      // Try next candidate endpoint.
    }
  }

  // Fallback: use world top players and derive ranked score from each live profile.
  const worldTop = await getTopPlayers(Math.max(limit, 10));
  const enriched = await Promise.all(
    worldTop.map(async (entry) => {
      try {
        const profile = await getPlayer(entry.tag);
        const highestRankedScore = extractRankedData(profile);
        return {
          tag: entry.tag,
          name: profile.name || entry.name,
          rank: entry.rank,
          // End-of-season fallback: classement simulé par peak classé.
          score: highestRankedScore,
          icon: { id: profile.icon?.id ?? entry.icon?.id ?? 28000000 }
        } satisfies RankedLeaderboardEntry;
      } catch {
        return {
          tag: entry.tag,
          name: entry.name,
          rank: entry.rank,
          score: 0,
          icon: { id: entry.icon?.id ?? 28000000 }
        } satisfies RankedLeaderboardEntry;
      }
    })
  );

  return enriched
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function getTopEsportLeaders(limit = 10): Promise<EsportLeaderboardEntry[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const query = await supabase
      .from("pro_players")
      .select("player_tag,display_name,team,matcherino_url,matcherino_earnings_usd")
      .eq("is_active", true)
      .order("matcherino_earnings_usd", { ascending: false })
      .limit(limit);

    if (!query.error && (query.data?.length ?? 0) > 0) {
      const enriched = await Promise.all(
        (query.data ?? []).map(async (item) => {
          const tag = String(item.player_tag ?? "");
          let iconId = 28000000;
          try {
            const player = await getPlayer(tag);
            iconId = player.icon?.id ?? 28000000;
          } catch {
            iconId = 28000000;
          }
          return {
            tag,
            displayName: String(item.display_name ?? tag),
            team: String(item.team ?? "Unknown"),
            matcherinoUrl: typeof item.matcherino_url === "string" ? item.matcherino_url : null,
            earningsUsd: parseNumericScore(item.matcherino_earnings_usd),
            iconId
          } satisfies EsportLeaderboardEntry;
        })
      );
      return enriched;
    }
  }

  // Pas de données aléatoires: si la base est vide/inaccessible, on retourne vide.
  return [];
}

export async function compareAndPersistLeaderboard(
  type: LeaderboardType,
  entries: Array<{ playerTag: string; value: number }>
): Promise<Record<string, LeaderboardTrend>> {
  const supabase = getSupabaseAdmin();
  if (!supabase || entries.length === 0) return {};

  const normalized = entries.map((entry, index) => ({
    player_tag: normalizeTag(entry.playerTag),
    last_position: index + 1,
    last_value: entry.value,
    type
  }));

  const tags = normalized.map((entry) => entry.player_tag);
  const previousQuery = await supabase
    .from("leaderboard_snapshots")
    .select("player_tag,last_position")
    .eq("type", type)
    .in("player_tag", tags);

  if (previousQuery.error) {
    throw new Error(`Leaderboard snapshot read error: ${previousQuery.error.message}`);
  }

  const previousMap = new Map<string, number>();
  for (const row of previousQuery.data ?? []) {
    previousMap.set(String(row.player_tag), Number(row.last_position ?? 0));
  }

  const trendByTag: Record<string, LeaderboardTrend> = {};
  for (const entry of normalized) {
    const previous = previousMap.get(entry.player_tag);
    if (!previous) {
      trendByTag[entry.player_tag] = { direction: "new", places: 0, hasHistory: false };
      continue;
    }

    const diff = previous - entry.last_position;
    if (diff > 0) {
      trendByTag[entry.player_tag] = { direction: "up", places: diff, hasHistory: true };
    } else if (diff < 0) {
      trendByTag[entry.player_tag] = { direction: "down", places: Math.abs(diff), hasHistory: true };
    } else {
      trendByTag[entry.player_tag] = { direction: "stable", places: 0, hasHistory: true };
    }
  }

  const upsertQuery = await supabase.from("leaderboard_snapshots").upsert(normalized, {
    onConflict: "type,player_tag"
  });
  if (upsertQuery.error) {
    throw new Error(`Leaderboard snapshot upsert error: ${upsertQuery.error.message}`);
  }

  return trendByTag;
}

export async function getBrawlerCatalog(): Promise<BrawlerCatalogEntry[]> {
  const data = await brawlFetch<BrawlListResponse<BrawlerCatalogEntry>>("/brawlers", 3600);
  return data.items ?? [];
}

function toTier(winrate: number): "S" | "A" | "B" | "C" {
  if (winrate >= 58) return "S";
  if (winrate >= 53) return "A";
  if (winrate >= 49) return "B";
  return "C";
}

export async function getBrawlifyTierList(limit = 30): Promise<BrawlifyTierEntry[]> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      buildBrawlifyApiUrl("/brawlers"),
      {
        next: {
          revalidate: 1800
        }
      },
      FETCH_TIMEOUT_MS
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Brawlify API timeout (${FETCH_TIMEOUT_MS}ms)`);
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Brawlify API error (${response.status})`);
  }

  const payload = (await response.json()) as { list?: Array<Record<string, unknown>> };
  const list = Array.isArray(payload.list) ? payload.list : [];

  const parsed = list
    .map((item): BrawlifyTierEntry | null => {
      const stats = (item.stats as Record<string, unknown> | undefined) ?? {};
      const winrate =
        Number(item.winRate ?? item.winrate ?? stats.winRate ?? stats.winrate ?? stats.win_rate ?? NaN);

      if (!Number.isFinite(winrate)) {
        return null;
      }

      const imageUrl =
        typeof item.imageUrl === "string"
          ? item.imageUrl
          : typeof item.imageUrl2 === "string"
            ? item.imageUrl2
            : typeof item.image === "string"
              ? item.image
              : null;

      return {
        id: Number(item.id ?? 0),
        name: String(item.name ?? "Unknown"),
        imageUrl,
        winrate: Number(winrate.toFixed(2)),
        tier: toTier(winrate)
      };
    })
    .filter((entry): entry is BrawlifyTierEntry => entry !== null)
    .sort((a, b) => b.winrate - a.winrate);

  return parsed.slice(0, limit);
}
