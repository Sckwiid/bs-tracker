import { NextRequest, NextResponse } from "next/server";

import { BattleItem } from "@/types/brawl";
import { BrawlApiError, getBattlelog, getPlayer } from "@/lib/brawlApi";
import { calculateWinrate25 } from "@/lib/metrics";
import { getSupabaseAdmin, HistoryRow } from "@/lib/supabase";
import { normalizeTag } from "@/lib/utils";

type Side = "left" | "right" | "even";

function normalizeResult(result: unknown): "win" | "loss" | "draw" | null {
  const value = String(result ?? "").toLowerCase();
  if (value.includes("victory") || value.includes("win")) return "win";
  if (value.includes("defeat") || value.includes("loss") || value.includes("lose")) return "loss";
  if (value.includes("draw")) return "draw";
  return null;
}

function faceToFaceFromBattlelogs(leftBattles: BattleItem[], rightBattles: BattleItem[]) {
  const leftMap = new Map<string, "win" | "loss" | "draw" | null>();
  for (const item of leftBattles) {
    const key = `${item.battleTime ?? ""}|${item.event?.mode ?? ""}|${item.event?.map ?? ""}`;
    if (key.startsWith("||")) continue;
    leftMap.set(key, normalizeResult(item.battle?.result));
  }

  let matches = 0;
  let leftWins = 0;
  let rightWins = 0;
  let draws = 0;
  for (const item of rightBattles) {
    const key = `${item.battleTime ?? ""}|${item.event?.mode ?? ""}|${item.event?.map ?? ""}`;
    if (!leftMap.has(key)) continue;

    matches += 1;
    const leftResult = leftMap.get(key);
    const rightResult = normalizeResult(item.battle?.result);
    if (leftResult === "win" || rightResult === "loss") {
      leftWins += 1;
    } else if (rightResult === "win" || leftResult === "loss") {
      rightWins += 1;
    } else {
      draws += 1;
    }
  }

  return { matches, leftWins, rightWins, draws };
}

async function getHistoryForTags(leftTag: string, rightTag: string): Promise<HistoryRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const query = await supabase
    .from("history")
    .select("*")
    .in("player_tag", [leftTag, rightTag])
    .order("snapshot_date", { ascending: false })
    .limit(240);

  if (query.error) {
    throw new Error(`Supabase history compare error: ${query.error.message}`);
  }
  return (query.data as HistoryRow[]) ?? [];
}

function sharedClubsFromHistory(history: HistoryRow[], leftTag: string, rightTag: string): string[] {
  const leftSet = new Set<string>();
  const rightSet = new Set<string>();

  for (const row of history) {
    const club = row.club_name?.trim() || row.club_tag?.trim() || "";
    if (!club) continue;
    if (row.player_tag === leftTag) leftSet.add(club);
    if (row.player_tag === rightTag) rightSet.add(club);
  }

  return [...leftSet].filter((club) => rightSet.has(club));
}

function favoriteDecision(input: {
  leftName: string;
  rightName: string;
  leftTag: string;
  rightTag: string;
  leftHighest: number;
  rightHighest: number;
  leftTrophies: number;
  rightTrophies: number;
  leftWinrate: number;
  rightWinrate: number;
  sharedClubs: string[];
}): { side: Side; tag: string | null; name: string | null; reasons: string[]; similarStats: boolean } {
  let leftScore = 0;
  let rightScore = 0;
  const reasons: string[] = [];

  if (input.leftHighest > input.rightHighest + 300) {
    leftScore += 2;
    reasons.push(`${input.leftName} a un meilleur record de trophées.`);
  } else if (input.rightHighest > input.leftHighest + 300) {
    rightScore += 2;
    reasons.push(`${input.rightName} a un meilleur record de trophées.`);
  }

  if (input.leftWinrate > input.rightWinrate + 2) {
    leftScore += 2;
    reasons.push(`${input.leftName} a un meilleur winrate récent.`);
  } else if (input.rightWinrate > input.leftWinrate + 2) {
    rightScore += 2;
    reasons.push(`${input.rightName} a un meilleur winrate récent.`);
  }

  if (input.leftTrophies > input.rightTrophies + 200) {
    leftScore += 1;
  } else if (input.rightTrophies > input.leftTrophies + 200) {
    rightScore += 1;
  }

  const similarStats =
    Math.abs(input.leftHighest - input.rightHighest) <= 1200 &&
    Math.abs(input.leftWinrate - input.rightWinrate) <= 3.5;

  if (input.sharedClubs.length > 0) {
    reasons.push(`Clubs en commun détectés: ${input.sharedClubs.join(", ")}.`);
  }

  if (similarStats) {
    reasons.push("Profils statistiques très proches: duel équilibré.");
  }

  if (leftScore === rightScore) {
    return {
      side: "even",
      tag: null,
      name: null,
      reasons,
      similarStats
    };
  }

  if (leftScore > rightScore) {
    return {
      side: "left",
      tag: input.leftTag,
      name: input.leftName,
      reasons,
      similarStats
    };
  }

  return {
    side: "right",
    tag: input.rightTag,
    name: input.rightName,
    reasons,
    similarStats
  };
}

export async function GET(request: NextRequest) {
  const leftRaw = request.nextUrl.searchParams.get("left");
  const rightRaw = request.nextUrl.searchParams.get("right");
  if (!leftRaw || !rightRaw) {
    return NextResponse.json({ error: "Paramètres left et right requis." }, { status: 400 });
  }

  const leftTag = normalizeTag(leftRaw);
  const rightTag = normalizeTag(rightRaw);

  try {
    const [leftPlayer, rightPlayer, leftBattles, rightBattles, history] = await Promise.all([
      getPlayer(leftTag),
      getPlayer(rightTag),
      getBattlelog(leftTag, 25),
      getBattlelog(rightTag, 25),
      getHistoryForTags(leftTag, rightTag)
    ]);

    const leftWinrate = calculateWinrate25(leftBattles).winrate;
    const rightWinrate = calculateWinrate25(rightBattles).winrate;
    const sharedClubsSet = new Set(sharedClubsFromHistory(history, leftTag, rightTag));
    const leftCurrentClub = leftPlayer.club?.name?.trim() || leftPlayer.club?.tag?.trim() || "";
    const rightCurrentClub = rightPlayer.club?.name?.trim() || rightPlayer.club?.tag?.trim() || "";
    if (leftCurrentClub && rightCurrentClub && leftCurrentClub === rightCurrentClub) {
      sharedClubsSet.add(leftCurrentClub);
    }
    const sharedClubs = [...sharedClubsSet];
    const faceToFace = faceToFaceFromBattlelogs(leftBattles, rightBattles);

    const favorite = favoriteDecision({
      leftName: leftPlayer.name,
      rightName: rightPlayer.name,
      leftTag,
      rightTag,
      leftHighest: leftPlayer.highestTrophies,
      rightHighest: rightPlayer.highestTrophies,
      leftTrophies: leftPlayer.trophies,
      rightTrophies: rightPlayer.trophies,
      leftWinrate,
      rightWinrate,
      sharedClubs
    });

    return NextResponse.json({
      left: {
        tag: leftPlayer.tag,
        name: leftPlayer.name,
        trophies: leftPlayer.trophies,
        highestTrophies: leftPlayer.highestTrophies,
        winrate25: leftWinrate
      },
      right: {
        tag: rightPlayer.tag,
        name: rightPlayer.name,
        trophies: rightPlayer.trophies,
        highestTrophies: rightPlayer.highestTrophies,
        winrate25: rightWinrate
      },
      comparison: {
        favorite,
        sharedClubs,
        similarStats: favorite.similarStats,
        recordDiff: Math.abs(leftPlayer.highestTrophies - rightPlayer.highestTrophies),
        winrateDiff: Number(Math.abs(leftWinrate - rightWinrate).toFixed(2)),
        faceToFace
      }
    });
  } catch (error) {
    if (error instanceof BrawlApiError && error.code === "PLAYER_NOT_FOUND") {
      return NextResponse.json({ error: "Un des joueurs est introuvable." }, { status: 404 });
    }
    if (error instanceof BrawlApiError && error.code === "MAINTENANCE") {
      return NextResponse.json({ error: "API Brawl Stars en maintenance." }, { status: 503 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Comparaison impossible"
      },
      { status: 500 }
    );
  }
}
