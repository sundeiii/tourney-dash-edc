import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { output, ZodType } from "zod";
import {
  bracketSchema,
  eventViewSchema,
  profileSchema,
  releasedPoolsSchema,
  usersSchema,
} from "~/schemas/centaurea";
import { getAvatarUrl, getBeatmapBgUrl, preloadImage } from "~/util";
import { useSettings } from "./dashboard";

export const EDC_EVENT_ID = "1564f3e6-2d2b-45d6-8990-a9e0b2a75588";

// what fits above the cornflower border of the seedings background
const SCHEDULE_SIZE = 4;

async function fetchCentaurea<T extends ZodType>(
  path: string,
  schema: T,
): Promise<output<T>> {
  const response = await fetch(`/centaurea/${path}`);

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${await response.text()}`,
    );
  }

  return schema.parse(await response.json());
}

export type EdcMember = {
  id: string;
  name: string;
  osuId: number | null;
  avatarUrl: string;
};

export type EdcEntrant = {
  id: string;
  name: string;
  seed: number | null;
  avatarUrl: string;
  members: EdcMember[];
};

export type EdcRound = {
  id: string;
  name: string;
  stageName: string;
  // winners | losers | grand_finals
  side: string;
  qualifier: boolean;
  label: string;
  bestOf: number;
  bansPerTeam: number;
  mappoolId: string | null;
};

export type EdcMemberStats = {
  globalRank: number | null;
  countryRank: number | null;
  pp: number | null;
  accuracy: number | null;
};

export type EdcMatch = {
  id: string;
  round: EdcRound;
  // order within the round; winners of 2i and 2i+1 meet at i in a halving round
  position: number;
  red: EdcEntrant | undefined;
  blue: EdcEntrant | undefined;
  redScore: number;
  blueScore: number;
  winner: "red" | "blue" | null;
  date: number | null;
  state: string;
};

export type EdcBeatmap = {
  code: string;
  mod: string;
  title: string;
  artist: string;
  difficulty: string;
  mapper: string;
  bgUrl: string | null;
};

const UNKNOWN_ENTRANT: EdcEntrant = {
  id: "",
  name: "???",
  seed: null,
  avatarUrl: getAvatarUrl(""),
  members: [],
};

const SIDE_LABELS: Record<string, string> = {
  winners: "Winners Bracket",
  losers: "Losers Bracket",
  grand_finals: "Grand Finals",
};

function useEventView() {
  const query = useQuery({
    queryKey: ["centaurea", "view", EDC_EVENT_ID],
    queryFn: () =>
      fetchCentaurea(`events/${EDC_EVENT_ID}/view`, eventViewSchema),
  });

  if (query.error) {
    console.error(query.error);
  }

  return query.data;
}

function useUsers(ids: string[]) {
  const key = [...new Set(ids)].sort().join(",");

  const query = useQuery({
    enabled: key.length > 0,
    queryKey: ["centaurea", "users", key],
    queryFn: () => fetchCentaurea(`accounts/batch?ids=${key}`, usersSchema),
  });

  if (query.error) {
    console.error(query.error);
  }

  return query.data;
}

export function useEdcEntrants() {
  const view = useEventView();

  const memberIds = useMemo(
    () =>
      (view?.roster ?? []).flatMap((row) => {
        const team = view?.teams.find((t) => t.id === row.team_id);
        if (team) {
          return team.member_user_ids;
        }
        return row.user_id ? [row.user_id] : [];
      }),
    [view],
  );

  const users = useUsers(memberIds);

  const result = useMemo(() => {
    const usersById = new Map(users?.map((u) => [u.id, u]));

    const toMember = (id: string): EdcMember => {
      const user = usersById.get(id);
      return {
        id,
        name: user?.username ?? "???",
        osuId: user?.osu_user_id ?? null,
        avatarUrl: user?.avatar_url ?? getAvatarUrl(user?.osu_user_id ?? ""),
      };
    };

    const entrants = (view?.roster ?? []).map((row): EdcEntrant => {
      const team = view?.teams.find((t) => t.id === row.team_id);
      const ids = team
        ? [
            team.captain_user_id,
            ...team.member_user_ids.filter((id) => id !== team.captain_user_id),
          ]
        : row.user_id
          ? [row.user_id]
          : [];
      const members = ids.map(toMember);

      return {
        id: row.entrant_id,
        name: team?.name ?? row.name,
        seed: row.seed ?? null,
        avatarUrl:
          team?.avatar_url ?? members[0]?.avatarUrl ?? getAvatarUrl(""),
        members,
      };
    });

    return {
      entrants,
      byId: new Map(entrants.map((e) => [e.id, e])),
    };
  }, [view, users]);

  for (const entrant of result.entrants) {
    preloadImage(entrant.avatarUrl);
  }

  return result;
}

export function useEdcBracket() {
  const query = useQuery({
    queryKey: ["centaurea", "bracket", EDC_EVENT_ID],
    queryFn: () =>
      fetchCentaurea(`events/${EDC_EVENT_ID}/bracket`, bracketSchema),
  });

  if (query.error) {
    console.error(query.error);
  }

  const { byId } = useEdcEntrants();
  const bracket = query.data;

  return useMemo(() => {
    const rounds: EdcRound[] = [];
    const matches: EdcMatch[] = [];

    for (const { stage, rounds: stageRounds } of bracket ?? []) {
      for (const { round, matches: roundMatches } of stageRounds) {
        const qualifier = stage.format.kind === "qualifier";
        const edcRound: EdcRound = {
          id: round.id,
          name: round.name,
          stageName: stage.name,
          side: round.bracket_side,
          qualifier,
          label: qualifier
            ? "Qualifiers"
            : (SIDE_LABELS[round.bracket_side] ?? round.bracket_side),
          bestOf: round.best_of,
          bansPerTeam: round.bans,
          mappoolId: round.mappool_id ?? null,
        };
        rounds.push(edcRound);

        for (const match of roundMatches) {
          matches.push({
            id: match.id,
            round: edcRound,
            position: match.position,
            red: match.entrant_a ? byId.get(match.entrant_a) : undefined,
            blue: match.entrant_b ? byId.get(match.entrant_b) : undefined,
            redScore: match.score_a,
            blueScore: match.score_b,
            winner:
              match.winner_entrant_id == null
                ? null
                : match.winner_entrant_id === match.entrant_a
                  ? "red"
                  : "blue",
            date: match.scheduled_at ? Date.parse(match.scheduled_at) : null,
            state: match.state,
          });
        }
      }
    }

    return { rounds, matches };
  }, [bracket, byId]);
}

export function useEdcCurrentMatch() {
  const [{ edc }] = useSettings();
  const { rounds } = useEdcBracket();
  const { byId } = useEdcEntrants();

  const round = rounds.find((r) => r.id === edc.roundId);

  return {
    matchId: edc.matchId,
    round,
    roundName: round?.name ?? "???",
    bracketLabel: round?.label ?? "",
    red: (edc.redEntrantId && byId.get(edc.redEntrantId)) || UNKNOWN_ENTRANT,
    blue: (edc.blueEntrantId && byId.get(edc.blueEntrantId)) || UNKNOWN_ENTRANT,
  };
}

/** osu! standard stats per Centaurea user id; missing until each profile loads */
export function useEdcMemberStats(userIds: string[]) {
  const results = useQueries({
    queries: userIds.map((id) => ({
      queryKey: ["centaurea", "profile", id],
      queryFn: () => fetchCentaurea(`accounts/${id}/profile`, profileSchema),
    })),
  });

  const stats = new Map<string, EdcMemberStats>();
  results.forEach((result, i) => {
    if (result.error) {
      console.error(result.error);
    }

    const s =
      result.data?.stats.find((s) => s.ruleset === "standard") ??
      result.data?.stats[0];
    if (s) {
      stats.set(userIds[i]!, {
        globalRank: s.global_rank ?? null,
        countryRank: s.country_rank ?? null,
        pp: s.pp ?? null,
        accuracy: s.accuracy ?? null,
      });
    }
  });

  return stats;
}

export function useEdcMappool() {
  const { round } = useEdcCurrentMatch();

  const query = useQuery({
    queryKey: ["centaurea", "pools", EDC_EVENT_ID],
    queryFn: () =>
      fetchCentaurea(
        `events/${EDC_EVENT_ID}/mappools/public`,
        releasedPoolsSchema,
      ),
  });

  if (query.error) {
    console.error(query.error);
  }

  // several rounds can share one pool, so match on the pool before the round
  const pool = round
    ? (query.data?.find((p) => p.mappool_id === round.mappoolId) ??
      query.data?.find((p) => p.round_id === round.id))
    : undefined;

  const groups = useMemo(() => {
    const groups: { mod: string; maps: EdcBeatmap[] }[] = [];

    for (const slot of (pool?.slots ?? []).toSorted(
      (a, b) => a.position - b.position,
    )) {
      const mod = slot.game_mod.toUpperCase();
      let group = groups.find((g) => g.mod === mod);
      if (!group) {
        group = { mod, maps: [] };
        groups.push(group);
      }

      const { snapshot } = slot;
      group.maps.push({
        code: slot.code.toUpperCase(),
        mod,
        title: snapshot.title ?? "???",
        artist: snapshot.artist ?? "???",
        difficulty: snapshot.difficulty ?? "",
        mapper: snapshot.mapper ?? "",
        bgUrl: snapshot.beatmapset_id
          ? getBeatmapBgUrl(snapshot.beatmapset_id)
          : null,
      });
    }

    return groups;
  }, [pool]);

  for (const map of groups.flatMap((g) => g.maps)) {
    if (map.bgUrl) {
      preloadImage(map.bgUrl);
    }
  }

  return { groups };
}

export function useEdcSchedule() {
  const { matches } = useEdcBracket();
  const now = Date.now();

  const dated = matches.filter(
    (m): m is EdcMatch & { date: number } =>
      m.date !== null && !!m.red && !!m.blue,
  );
  const isDone = (m: EdcMatch) =>
    m.state === "completed" || m.state === "forfeit";

  return {
    upcoming: dated
      .filter((m) => m.date >= now && !isDone(m))
      .toSorted((a, b) => a.date - b.date)
      .slice(0, SCHEDULE_SIZE),
    recent: dated
      .filter((m) => m.date < now)
      .toSorted((a, b) => b.date - a.date)
      .slice(0, SCHEDULE_SIZE),
  };
}
