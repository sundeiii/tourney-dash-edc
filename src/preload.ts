import {
  useEdcCurrentMatch,
  useEdcMappool,
  useEdcSchedule,
} from "./state/centaurea";
import {
  useMappoolQuery,
  useMatchesQuery,
  useScheduleQuery,
  useSupportersQuery,
  useTournamentQuery,
} from "./state/huis";

export function HuisPreload() {
  useMatchesQuery();
  useMappoolQuery();
  useTournamentQuery();
  useScheduleQuery();
  useSupportersQuery();
  return null;
}

export function EdcPreload() {
  useEdcCurrentMatch();
  useEdcMappool();
  useEdcSchedule();
  return null;
}
