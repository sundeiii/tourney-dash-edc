import z from "zod";

const userSchema = z.object({
  id: z.string(),
  osu_user_id: z.number(),
  username: z.string(),
  avatar_url: z.string().nullish(),
});

export const usersSchema = z.array(userSchema);

export const profileSchema = z.object({
  stats: z.array(
    z.object({
      ruleset: z.string(),
      global_rank: z.number().nullish(),
      country_rank: z.number().nullish(),
      pp: z.number().nullish(),
      accuracy: z.number().nullish(),
    }),
  ),
});

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
      // qualifier | elimination
      format: z.object({ kind: z.string() }),
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
    mappool_id: z.string(),
    slots: z.array(slotSchema),
  }),
);
