import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { output, ZodType } from "zod";
import {
  bracketSchema,
  eventViewSchema,
  localPoolsSchema,
  qualifierLobbiesSchema,
  qualifierScoresSchema,
  releasedPoolsSchema,
  usersSchema,
} from "~/schemas/centaurea";
import { osuMatchSchema, type OsuMatch } from "~/schemas/osuMatch";
import { getAvatarUrl, getBeatmapBgUrl, preloadImage } from "~/util";
import { useSettings } from "./dashboard";
import { qualifierStandings } from "./qualifierStandings";

/** the Centaurea event picked on the dashboard */
function useEventId() {
  const [{ edc }] = useSettings();
  return edc.eventId;
}

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
  // qualifier stages only
  scoring: string | null;
  advanceCount: number | null;
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
  const eventId = useEventId();
  const query = useQuery({
    queryKey: ["centaurea", "view", eventId],
    queryFn: () => fetchCentaurea(`events/${eventId}/view`, eventViewSchema),
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
  const eventId = useEventId();
  const query = useQuery({
    queryKey: ["centaurea", "bracket", eventId],
    queryFn: () => fetchCentaurea(`events/${eventId}/bracket`, bracketSchema),
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
          scoring: stage.format.scoring ?? null,
          advanceCount: stage.advance_count ?? null,
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

function useLocalPools() {
  const query = useQuery({
    queryKey: ["local-pools"],
    queryFn: async () => {
      const response = await fetch("/local-pools");
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return localPoolsSchema.parse(await response.json());
    },
  });

  if (query.error) {
    console.error(query.error);
  }

  return query.data;
}

/** Centaurea's released pools, plus unreleased ones dropped into pools/ */
function usePools() {
  const eventId = useEventId();
  const query = useQuery({
    queryKey: ["centaurea", "pools", eventId],
    queryFn: () =>
      fetchCentaurea(`events/${eventId}/mappools/public`, releasedPoolsSchema),
  });

  if (query.error) {
    console.error(query.error);
  }

  const local = useLocalPools();

  return useMemo(() => {
    const pools = [...(query.data ?? [])];
    for (const { slots } of local ?? []) {
      const mappoolId = slots[0]!.mappool_id;
      if (!pools.some((p) => p.mappool_id === mappoolId)) {
        pools.push({ round_id: "", round_name: "", mappool_id: mappoolId, slots });
      }
    }
    return pools;
  }, [query.data, local]);
}

// several rounds can share one pool, so match on the pool before the round
function poolForRound(
  pools: ReturnType<typeof usePools>,
  round: EdcRound | undefined,
) {
  return round
    ? (pools.find((p) => p.mappool_id === round.mappoolId) ??
        pools.find((p) => p.round_id === round.id))
    : undefined;
}

function useQualifierScores() {
  const { rounds } = useEdcBracket();
  const qualifierRound = rounds.find((r) => r.qualifier);

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

  const status = !qualifierRound
    ? "none"
    : query.error
      ? "private"
      : !query.data
        ? "loading"
        : "ready";

  return { qualifierRound, query, status } as const;
}

/** each entrant's best score and placement on every qualifier map */
export function useEdcQualifierStats() {
  const { qualifierRound, query, status: scoresStatus } = useQualifierScores();
  const pool = poolForRound(usePools(), qualifierRound);

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

    const status =
      scoresStatus === "ready" && slots.length === 0 ? "no-pool" : scoresStatus;

    return { status, slots, results, entrantCount: results.size } as const;
  }, [pool, query.data, scoresStatus]);
}

// module-level so useQueries can keep its combined result between renders
const matchDataOf = (results: { data: OsuMatch | undefined }[]) =>
  results.map((r) => r.data);

type PlayerQualifierScores = {
  // over all the qualifier maps
  average: number;
  // by slot id
  maps: Map<string, number>;
};

/**
 * each player's scores on the qualifier maps, from the lobbies' osu! matches,
 * keyed by Centaurea user id; Centaurea itself only keeps team totals
 */
function useQualifierPlayerScores() {
  const eventId = useEventId();
  const { qualifierRound } = useQualifierScores();
  const pool = poolForRound(usePools(), qualifierRound);
  const { entrants } = useEdcEntrants();

  const lobbies = useQuery({
    queryKey: ["centaurea", "qualifier-lobbies", eventId],
    queryFn: () =>
      fetchCentaurea(`events/${eventId}/qualifier-lobbies`, qualifierLobbiesSchema),
  });

  const matchData = useQueries({
    queries: (lobbies.data ?? [])
      .flatMap((lobby) => (lobby.osu_mp_id ? [lobby.osu_mp_id] : []))
      .map((id) => ({
        queryKey: ["osu-match", id],
        // the server answers 503 while osu! is throttling it
        retry: 4,
        retryDelay: (attempt: number) => 5000 * 2 ** attempt,
        queryFn: async () => {
          const response = await fetch(`/osu-match/${id}`);
          if (!response.ok) {
            throw new Error(`osu! match ${id}: ${response.status}`);
          }
          return osuMatchSchema.parse(await response.json());
        },
      })),
    combine: matchDataOf,
  });

  return useMemo(() => {
    const players = new Map<string, PlayerQualifierScores>();
    const slots = (pool?.slots ?? []).toSorted((a, b) => a.position - b.position);
    if (slots.length === 0) {
      return players;
    }

    const memberByOsuId = new Map(
      entrants.flatMap((e) =>
        e.members.flatMap((m) => (m.osuId ? [[m.osuId, m.id] as const] : [])),
      ),
    );

    // each player's best run on every map; a lobby is one run, and within it
    // a replayed map's last play counts, as Centaurea counts it
    const best = new Map<string, Map<string, number>>();
    for (const match of matchData) {
      if (!match) {
        continue;
      }
      const run = new Map<string, Map<string, number>>();

      // unsubmitted tourney edits come through as beatmap 0; they take the
      // pool's other maps in order, as a lobby plays the pool in order
      const submitted = match.games.filter((g) => g.beatmapId > 0);
      const unclaimed = slots.filter(
        (s) => !submitted.some((g) => g.beatmapId === s.beatmap_id),
      );
      let nextUnclaimed = 0;

      for (const game of match.games) {
        const slot =
          game.beatmapId > 0
            ? slots.find((s) => s.beatmap_id === game.beatmapId)
            : unclaimed[nextUnclaimed++];
        if (!slot) {
          continue;
        }

        for (const { userId, score } of game.scores) {
          const memberId = memberByOsuId.get(userId);
          if (!memberId) {
            continue;
          }
          const scores = run.get(memberId) ?? new Map<string, number>();
          run.set(memberId, scores);
          scores.set(slot.id, score);
        }
      }

      for (const [memberId, runScores] of run) {
        const scores = best.get(memberId) ?? new Map<string, number>();
        best.set(memberId, scores);
        for (const [slotId, score] of runScores) {
          scores.set(slotId, Math.max(scores.get(slotId) ?? 0, score));
        }
      }
    }

    // like Centaurea's average score, a map someone didn't play counts as 0
    for (const [memberId, maps] of best) {
      const total = [...maps.values()].reduce((a, b) => a + b, 0);
      players.set(memberId, { average: total / slots.length, maps });
    }
    return players;
  }, [pool, entrants, matchData]);
}

/** the qualifier stage's final standings, ranked like Centaurea ranks them */
export function useEdcQualifierStandings() {
  const { qualifierRound, query, status } = useQualifierScores();
  const { byId } = useEdcEntrants();
  const playerScores = useQualifierPlayerScores();
  const method = qualifierRound?.scoring ?? "average_score";

  const standings = useMemo(
    () =>
      qualifierStandings(method, query.data ?? []).map((standing) => {
        const entrant = byId.get(standing.entrantId);
        return {
          ...standing,
          entrant,
          players: (entrant?.members ?? []).map((member) => ({
            name: member.name,
            avatarUrl: member.avatarUrl,
            // null while the lobby's osu! match isn't linked or loaded
            average: playerScores.get(member.id)?.average ?? null,
            maps: playerScores.get(member.id)?.maps ?? null,
          })),
        };
      }),
    [method, query.data, byId, playerScores],
  );

  return {
    status:
      status === "ready" && standings.length === 0 ? "no-scores" : status,
    method,
    advanceCount: qualifierRound?.advanceCount ?? null,
    standings,
  } as const;
}

// the step after #1 on the Team Results screen, showing every team
export const QUALIFIER_SUMMARY = "summary";

/**
 * the team the dashboard is stepping through the qualifier results with,
 * and its run map by map; with none picked yet it's last place, where a
 * results reveal starts, and the step after #1 is the summary
 */
export function useEdcQualifierTeam() {
  const [{ edc }] = useSettings();
  const results = useEdcQualifierStandings();
  const { qualifierRound } = useQualifierScores();
  const pool = poolForRound(usePools(), qualifierRound);
  const { standings } = results;

  const summary = edc.qualifierEntrantId === QUALIFIER_SUMMARY;
  const picked = standings.findIndex((s) => s.entrantId === edc.qualifierEntrantId);
  const index = summary ? -1 : picked === -1 ? standings.length - 1 : picked;
  const team = summary ? undefined : standings[index];

  const maps = useMemo(
    () =>
      (pool?.slots ?? [])
        .toSorted((a, b) => a.position - b.position)
        .map((slot) => ({
          id: slot.id,
          code: slot.code.toUpperCase(),
          mod: slot.game_mod.toUpperCase(),
          title: slot.snapshot.title ?? "",
          result: team?.maps[slot.id],
          playerScores: (team?.players ?? []).map(
            (p) => p.maps?.get(slot.id) ?? null,
          ),
        })),
    [pool, team],
  );

  return {
    ...results,
    status:
      results.status === "ready" && maps.length === 0 ? "no-pool" : results.status,
    summary,
    index,
    team,
    maps,
  } as const;
}

export function useEdcLinks() {
  return useEventView()?.links ?? [];
}

/** which pool slot an osu! beatmap is, if it's in one */
export function useEdcSlotForBeatmap(beatmap: {
  id: number;
  artist: string;
  title: string;
  difficulty: string;
}) {
  const pools = usePools();
  const { rounds } = useEdcBracket();

  const same = (a: string | null | undefined, b: string) =>
    a?.trim().toLowerCase() === b.trim().toLowerCase();

  for (const pool of pools) {
    // tourney edits are unsubmitted (osu! reports id 0) and get renamed
    // difficulties, so fall back to artist + title, preferring a slot whose
    // difficulty name is part of the loaded one if the song is pooled twice
    const byName = pool.slots.filter(
      (s) =>
        same(s.snapshot.artist, beatmap.artist) &&
        same(s.snapshot.title, beatmap.title),
    );
    const slot =
      (beatmap.id > 0
        ? pool.slots.find((s) => s.beatmap_id === beatmap.id)
        : undefined) ??
      byName.find(
        (s) =>
          s.snapshot.difficulty &&
          beatmap.difficulty
            .toLowerCase()
            .includes(s.snapshot.difficulty.toLowerCase()),
      ) ??
      (byName.length === 1 ? byName[0] : undefined);
    if (slot) {
      return {
        code: slot.code.toUpperCase(),
        mod: slot.game_mod.toUpperCase(),
        // local pools don't say which round they're for; the bracket does
        roundName:
          pool.round_name ||
          (rounds.find((r) => r.mappoolId === pool.mappool_id)?.name ?? ""),
      };
    }
  }

  return undefined;
}

export function useEdcMappool() {
  const { round } = useEdcCurrentMatch();
  const pool = poolForRound(usePools(), round);

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
