import z from "zod";

const userSchema = z.object({
  id: z.string(),
  osu_user_id: z.number(),
  username: z.string(),
  avatar_url: z.string().nullish(),
});

export const usersSchema = z.array(userSchema);

// readable by the public only when the event's qualifier_results_visibility is "full"
export const qualifierScoresSchema = z.array(
  z.object({
    entrant_id: z.string(),
    slot_id: z.string(),
    score: z.number(),
  }),
);

// public even while the scores themselves aren't
export const qualifierLobbiesSchema = z.array(
  z.object({
    id: z.string(),
    // a stable match id or a lazer room id, once staff link the lobby
    osu_mp_id: z.string().nullish(),
    entrant_ids: z.array(z.string()),
  }),
);

export type CentaureaUser = z.infer<typeof userSchema>;

const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  captain_user_id: z.string(),
  member_user_ids: z.array(z.string()),
  avatar_url: z.string().nullish(),
});

export type CentaureaTeam = z.infer<typeof teamSchema>;

const rosterRowSchema = z.object({
  entrant_id: z.string(),
  name: z.string(),
  seed: z.number().nullish(),
  team_id: z.string().nullish(),
  user_id: z.string().nullish(),
});

export type CentaureaRosterRow = z.infer<typeof rosterRowSchema>;

export const eventViewSchema = z.object({
  event: z.object({
    id: z.string(),
    title: z.string(),
    current_round_id: z.string().nullish(),
  }),
  roster: z.array(rosterRowSchema),
  teams: z.array(teamSchema),
  links: z.array(
    z.object({
      // osu | discord | web
      kind: z.string(),
      label: z.string(),
      url: z.string(),
    }),
  ),
});

const matchSchema = z.object({
  id: z.string(),
  round_id: z.string(),
  position: z.number(),
  entrant_a: z.string().nullish(),
  entrant_b: z.string().nullish(),
  scheduled_at: z.string().nullish(),
  // scheduled | live | completed | forfeit
  state: z.string(),
  winner_entrant_id: z.string().nullish(),
  score_a: z.number(),
  score_b: z.number(),
});

export type CentaureaMatch = z.infer<typeof matchSchema>;

const roundSchema = z.object({
  id: z.string(),
  name: z.string(),
  // winners | losers | grand_finals
  bracket_side: z.string(),
  position: z.number(),
  best_of: z.number(),
  // per team
  bans: z.number(),
  mappool_id: z.string().nullish(),
  scheduled_at: z.string().nullish(),
});

export const bracketSchema = z.array(
  z.object({
    stage: z.object({
      id: z.string(),
      name: z.string(),
      position: z.number(),
      // how many entrants a qualifier stage sends on
      advance_count: z.number().nullish(),
      format: z.object({
        // qualifier | elimination
        kind: z.string(),
        // qualifier ranking method, e.g. average_score | z_sum
        scoring: z.string().nullish(),
      }),
    }),
    rounds: z.array(
      z.object({
        round: roundSchema,
        matches: z.array(matchSchema),
      }),
    ),
  }),
);

const slotSchema = z.object({
  id: z.string(),
  mappool_id: z.string(),
  code: z.string(),
  game_mod: z.string(),
  position: z.number(),
  beatmap_id: z.number().nullish(),
  snapshot: z.object({
    title: z.string().nullish(),
    artist: z.string().nullish(),
    difficulty: z.string().nullish(),
    mapper: z.string().nullish(),
    beatmapset_id: z.number().nullish(),
  }),
});

export const releasedPoolsSchema = z.array(
  z.object({
    round_id: z.string(),
    round_name: z.string(),
    mappool_id: z.string(),
    slots: z.array(slotSchema),
  }),
);

// a staff export of an unreleased pool (GET /mappools/{id}/full), from pools/
export const localPoolsSchema = z.array(
  z.object({ slots: z.array(slotSchema).min(1) }),
);
