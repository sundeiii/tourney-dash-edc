import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { output, ZodType } from "zod";
import {
  bracketSchema,
  eventViewSchema,
  qualifierScoresSchema,
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
  stageId: string;
  stageName: string;
  // winners | losers | grand_finals
  side: string;
  qualifier: boolean;
  label: string;
  bestOf: number;
  bansPerTeam: number;
  mappoolId: string | null;
};

export type EdcQualifierResult = { score: number; placement: number };

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
          stageId: stage.id,
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

function usePublicPools() {
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

  return query.data;
}

// several rounds can share one pool, so match on the pool before the round
function poolForRound(
  pools: ReturnType<typeof usePublicPools>,
  round: EdcRound | undefined,
) {
  return round
    ? (pools?.find((p) => p.mappool_id === round.mappoolId) ??
        pools?.find((p) => p.round_id === round.id))
    : undefined;
}

/** each entrant's best score and placement on every qualifier map */
export function useEdcQualifierStats() {
  const { rounds } = useEdcBracket();
  const qualifierRound = rounds.find((r) => r.qualifier);
  const pool = poolForRound(usePublicPools(), qualifierRound);

  const query = useQuery({
    enabled: !!qualifierRound,
    // a 403 means the results aren't public; asking again won't change that
    retry: false,
    queryKey: ["centaurea", "qualifier-scores", qualifierRound?.stageId],
    queryFn: () =>
      fetchCentaurea(
        `stages/${qualifierRound!.stageId}/qualifier-scores`,
        qualifierScoresSchema,
      ),
  });

  return useMemo(() => {
    const slots = (pool?.slots ?? [])
      .toSorted((a, b) => a.position - b.position)
      .map((slot) => ({
        id: slot.id,
        code: slot.code.toUpperCase(),
        mod: slot.game_mod.toUpperCase(),
      }));

    const bestScores = new Map<string, Map<string, number>>();
    for (const row of query.data ?? []) {
      const scores = bestScores.get(row.slot_id) ?? new Map<string, number>();
      bestScores.set(row.slot_id, scores);
      scores.set(row.entrant_id, Math.max(scores.get(row.entrant_id) ?? 0, row.score));
    }

    const results = new Map<string, Map<string, EdcQualifierResult>>();
    for (const [slotId, scores] of bestScores) {
      [...scores]
        .sort((a, b) => b[1] - a[1])
        .forEach(([entrantId, score], i) => {
          const entrant = results.get(entrantId) ?? new Map();
          results.set(entrantId, entrant);
          entrant.set(slotId, { score, placement: i + 1 });
        });
    }

    const status = !qualifierRound
      ? "none"
      : query.error
        ? "private"
        : !query.data
          ? "loading"
          : slots.length === 0
            ? "no-pool"
            : "ready";

    return { status, slots, results, entrantCount: results.size } as const;
  }, [pool, query.data, query.error, qualifierRound]);
}

export function useEdcMappool() {
  const { round } = useEdcCurrentMatch();
  const pool = poolForRound(usePublicPools(), round);

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
