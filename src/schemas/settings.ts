import z from "zod";
import { EDC_EVENT_ID } from "~/edcEvents";
import { screenNameSchema } from "./screens";

export const playerSchema = z.literal(["player1", "player2"]);

export const playerSettingsSchema = z.object({
  bans: z.array(z.string()),
  picks: z.array(z.string()),
});

// Centaurea ids; the entrant ids are roster entrant ids, as bracket matches use
export const edcSettingsSchema = z.object({
  eventId: z.string().default(EDC_EVENT_ID),
  matchId: z.string().nullable(),
  roundId: z.string().nullable(),
  redEntrantId: z.string().nullable(),
  blueEntrantId: z.string().nullable(),
  // the team the qualifier Team Results screen shows, or "summary" for all
  qualifierEntrantId: z.string().nullable().default(null),
  // stream events Centaurea's schedule doesn't know about, like a mappool
  // showcase, shown among the upcoming matches until they start
  scheduleExtras: z
    .array(z.object({ id: z.string(), title: z.string(), date: z.number() }))
    .default([]),
});

export type EdcSettings = z.infer<typeof edcSettingsSchema>;

export const settingsSchema = z.object({
  matchId: z.number(),
  automaticSelect: z.boolean(),
  activeScreen: screenNameSchema,
  previousScreen: screenNameSchema.optional(),
  countdown: z.number().optional(),
  showCountdown: z.boolean().optional(),
  graphicsStyle: z.enum(["EDC 2026", "NDC 2026", "NDC 2025"]),
  tournamentId: z.enum(["36", "31"]),
  player1: playerSettingsSchema,
  player2: playerSettingsSchema,
  lastPickedBy: playerSchema.nullish(),
  activePlayer: playerSchema,
  edc: edcSettingsSchema,
});

export type DashboardSettings = z.infer<typeof settingsSchema>;

export const dashboardMessageSchema = z
  .object({
    type: z.literal("SETTINGS"),
    settings: settingsSchema,
  })
  .or(
    z.object({
      type: z.literal("HELLO"),
      gitCommit: z.string().optional(),
    }),
  );

export type DashboardMessage = z.infer<typeof dashboardMessageSchema>;
