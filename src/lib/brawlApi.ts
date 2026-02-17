import "server-only";

import { BattleItem, BrawlerCatalogEntry, BrawlListResponse, Player, PlayerRanking } from "@/types/brawl";
import { normalizeTag } from "@/lib/utils";

const BRAWL_API_BASE_URL = process.env.BRAWL_API_BASE_URL ?? "https://api.brawlstars.com/v1";
const BRAWL_API_TOKEN = process.env.BRAWL_API_TOKEN;
const BRAWLIFY_API_BASE_URL = process.env.BRAWLIFY_API_BASE_URL ?? "https://api.brawlify.com/v1";

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

async function brawlFetch<T>(path: string, revalidate = 30): Promise<T> {
  const token = requireToken();
  const response = await fetch(`${BRAWL_API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    next: {
      revalidate
    }
  });

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
  return (data.items ?? []).slice(0, limit);
}

export const getBattlelog = getPlayerBattlelog;

export async function getTopPlayers(limit = 10): Promise<PlayerRanking[]> {
  const data = await brawlFetch<BrawlListResponse<PlayerRanking>>("/rankings/global/players", 120);
  return (data.items ?? []).slice(0, limit);
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
  const response = await fetch(`${BRAWLIFY_API_BASE_URL}/brawlers`, {
    next: {
      revalidate: 1800
    }
  });

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
