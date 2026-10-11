import z from "zod";

// a qualifier lobby's maps and each player's score on them, boiled down by
// the server's /osu-match route from either a stable match or a lazer room
export const osuMatchSchema = z.object({
  games: z.array(
    z.object({
      // 0 for an unsubmitted map, like a tourney edit
      beatmapId: z.number(),
      scores: z.array(z.object({ userId: z.number(), score: z.number() })),
    }),
  ),
});

export type OsuMatch = z.infer<typeof osuMatchSchema>;
