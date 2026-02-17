import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { normalizeTag } from "@/lib/utils";

export interface PlayerRow {
  tag: string;
  name: string;
  trophies: number;
  highest_trophies: number;
  exp_level: number | null;
  victories_3v3: number;
  solo_victories: number;
  duo_victories: number;
  club_tag: string | null;
  club_name: string | null;
  icon_id: number | null;
  estimated_playtime_minutes: number;
  last_battlelog_winrate: number;
  last_snapshot_hash: string;
  raw_payload: unknown;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryRow {
  id: number;
  player_tag: string;
  snapshot_date: string;
  trophies: number;
  highest_trophies: number;
  club_tag: string | null;
  club_name: string | null;
  estimated_playtime_minutes: number;
  winrate_25: number;
  raw_payload: unknown;
  created_at: string;
}

export interface ProPlayerRow {
  id: string;
  player_tag: string;
  display_name: string;
  team: string;
  mercato_status: string;
  matcherino_url: string | null;
  matcherino_earnings_usd: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

let singleton: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    return null;
  }
  if (singleton) {
    return singleton;
  }
  singleton = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  return singleton;
}

export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getProPlayerByTag(tag: string): Promise<ProPlayerRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const query = await supabase
    .from("pro_players")
    .select("*")
    .eq("player_tag", normalizeTag(tag))
    .eq("is_active", true)
    .maybeSingle();

  if (query.error && query.error.code !== "PGRST116") {
    throw new Error(`Supabase read pro_players error: ${query.error.message}`);
  }
  return (query.data as ProPlayerRow | null) ?? null;
}

export async function getTopProPlayersByEarnings(limit = 10): Promise<ProPlayerRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const query = await supabase
    .from("pro_players")
    .select("*")
    .eq("is_active", true)
    .order("matcherino_earnings_usd", { ascending: false })
    .limit(limit);

  if (query.error) {
    throw new Error(`Supabase read top earnings error: ${query.error.message}`);
  }
  return (query.data as ProPlayerRow[]) ?? [];
}
