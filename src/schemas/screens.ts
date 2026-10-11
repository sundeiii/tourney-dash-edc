import z from "zod";

export const screenNames = [
  "startingsoon",
  "start",
  "standby",
  "playerinfo",
  "versus",
  "scheduling",
  "mappool",
  "showcase",
  "qualresults",
  "qualteam",
  "winnersbracket",
  "losersbracket",
  "winner",
  "brb",
  "technical",
  "ending",
] as const;

export const screenNameSchema = z.literal(screenNames);
export type ScreenName = z.infer<typeof screenNameSchema>;
