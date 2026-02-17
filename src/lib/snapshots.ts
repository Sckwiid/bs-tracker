import "server-only";

import crypto from "node:crypto";

import { getPlayer, getPlayerBattlelog } from "@/lib/brawlApi";
import { calculateWinrate25, estimatePlayerPlaytime, topPlayedBrawlers, WinrateSummary } from "@/lib/metrics";
import { getProPlayerByTag, getSupabaseAdmin, HistoryRow, PlayerRow, ProPlayerRow, todayUtcDate } from "@/lib/supabase";
import { normalizeTag } from "@/lib/utils";
import { BattleItem, Player } from "@/types/brawl";

export interface SnapshotBundle {
  player: Player;
  battlelog: BattleItem[];
  winrate25: WinrateSummary;
  estimatedPlaytimeMinutes: number;
  topBrawlers: ReturnType<typeof topPlayedBrawlers>;
  history: HistoryRow[];
  isProVerified: boolean;
  proProfile: ProPlayerRow | null;
  changed: boolean;
}

function snapshotHash(player: Player): string {
  const payload = {
    tag: normalizeTag(player.tag),
    trophies: player.trophies,
    highestTrophies: player.highestTrophies,
    clubTag: player.club?.tag ?? null,
    clubName: player.club?.name ?? null,
    brawlers: [...(player.brawlers ?? [])]
      .sort((a, b) => a.id - b.id)
      .map((brawler) => ({
        id: brawler.id,
        trophies: brawler.trophies,
        highestTrophies: brawler.highestTrophies,
        rank: brawler.rank,
        power: brawler.power
      }))
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function getPlayerRow(tag: string): Promise<PlayerRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const query = await supabase.from("players").select("*").eq("tag", tag).maybeSingle();
  if (query.error && query.error.code !== "PGRST116") {
    throw new Error(`Supabase read players error: ${query.error.message}`);
  }
  return (query.data as PlayerRow | null) ?? null;
}

async function upsertPlayer(
  player: Player,
  hash: string,
  winrate25: number,
  estimatedPlaytimeMinutes: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const now = new Date().toISOString();
  const payload = {
    tag: normalizeTag(player.tag),
    name: player.name,
    trophies: player.trophies,
    highest_trophies: player.highestTrophies,
    exp_level: player.expLevel ?? null,
    victories_3v3: player["3vs3Victories"] ?? 0,
    solo_victories: player.soloVictories ?? 0,
    duo_victories: player.duoVictories ?? 0,
    club_tag: player.club?.tag ?? null,
    club_name: player.club?.name ?? null,
    icon_id: player.icon?.id ?? null,
    estimated_playtime_minutes: estimatedPlaytimeMinutes,
    last_battlelog_winrate: winrate25,
    last_snapshot_hash: hash,
    raw_payload: player,
    last_seen_at: now,
    updated_at: now
  };

  const query = await supabase.from("players").upsert(payload, { onConflict: "tag" });
  if (query.error) {
    throw new Error(`Supabase upsert players error: ${query.error.message}`);
  }
}

async function upsertDailyHistory(
  player: Player,
  estimatedPlaytimeMinutes: number,
  winrate25: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const payload = {
    player_tag: normalizeTag(player.tag),
    snapshot_date: todayUtcDate(),
    trophies: player.trophies,
    highest_trophies: player.highestTrophies,
    club_tag: player.club?.tag ?? null,
    club_name: player.club?.name ?? null,
    estimated_playtime_minutes: estimatedPlaytimeMinutes,
    winrate_25: winrate25,
    raw_payload: player,
    created_at: new Date().toISOString()
  };

  const query = await supabase.from("history").upsert(payload, { onConflict: "player_tag,snapshot_date" });
  if (query.error) {
    throw new Error(`Supabase upsert history error: ${query.error.message}`);
  }
}

async function getHistory(tag: string): Promise<HistoryRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const query = await supabase
    .from("history")
    .select("*")
    .eq("player_tag", tag)
    .order("snapshot_date", { ascending: true })
    .limit(120);

  if (query.error) {
    throw new Error(`Supabase read history error: ${query.error.message}`);
  }
  return (query.data as HistoryRow[]) ?? [];
}

export async function fetchAndStorePlayerSnapshot(tag: string): Promise<SnapshotBundle> {
  const normalizedTag = normalizeTag(tag);
  const [player, battlelog] = await Promise.all([getPlayer(normalizedTag), getPlayerBattlelog(normalizedTag, 25)]);
  const winrate25 = calculateWinrate25(battlelog);
  const estimatedPlaytimeMinutes = estimatePlayerPlaytime(player);
  const topBrawlers = topPlayedBrawlers(player.brawlers, 10);
  const hash = snapshotHash(player);

  let changed = true;
  try {
    const previous = await getPlayerRow(normalizedTag);
    changed = !previous || previous.last_snapshot_hash !== hash;
    await upsertPlayer(player, hash, winrate25.winrate, estimatedPlaytimeMinutes);
    if (changed) {
      await upsertDailyHistory(player, estimatedPlaytimeMinutes, winrate25.winrate);
    }
  } catch (error) {
    console.error("Snapshot write skipped:", error);
  }

  let history: HistoryRow[] = [];
  try {
    history = await getHistory(normalizedTag);
  } catch (error) {
    console.error("History read skipped:", error);
  }

  let proProfile: ProPlayerRow | null = null;
  try {
    proProfile = await getProPlayerByTag(normalizedTag);
  } catch (error) {
    console.error("Pro status read skipped:", error);
  }

  return {
    player,
    battlelog,
    winrate25,
    estimatedPlaytimeMinutes,
    topBrawlers,
    history,
    isProVerified: Boolean(proProfile),
    proProfile,
    changed
  };
}
