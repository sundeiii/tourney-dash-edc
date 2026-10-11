import clsx from "clsx";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { Casters } from "../components/Casters";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import {
  useEdcCurrentMatch,
  useEdcSchedule,
  type EdcEntrant,
  type EdcMatch,
} from "~/state/centaurea";
import { useTosu } from "~/state/tosu";

type Side = {
  team: EdcEntrant | undefined;
  score: number;
  winner: boolean;
};

function MatchSide({ side, color }: { side: Side; color: "red" | "blue" }) {
  return (
    <div className={`match-${color}-player`}>
      <div className={`match-${color}-player-icon`}>
        <img src={side.team?.avatarUrl} />
      </div>
      <FitText className="match-player-name" min={0.6}>
        {side.team?.name ?? "TBD"}
      </FitText>
      <div className={clsx("match-box", side.winner && "win")}>
        <div className="match-score">{side.score}</div>
      </div>
    </div>
  );
}

function MatchRow({ match, red, blue }: { match: EdcMatch; red: Side; blue: Side }) {
  return (
    <div className="match">
      <div className="match-info">
        <MatchSide side={red} color="red" />
        <MatchSide side={blue} color="blue" />
      </div>
      <div className="match-time">
        <div className="match-until">{dayjs(match.date).fromNow()}</div>
        <div className="match-timestamp">
          {dayjs(match.date).tz("Europe/Tallinn").format("dddd HH:mm")}
        </div>
      </div>
    </div>
  );
}

interface SchedulingScreenProps {
  from?: string;
  to: string;
}

export function SchedulingScreen({ from, to }: SchedulingScreenProps) {
  // treat this component as self (to) and other as from
  const anims: AnimTypes = getAnimations(to, from ?? "");

  const slideDirection: 1 | -1 = 1;

  const { matchId, roundName } = useEdcCurrentMatch();
  const { upcoming, recent } = useEdcSchedule();
  const { tourney } = useTosu();

  const sides = (match: EdcMatch): { red: Side; blue: Side } => {
    // the match being played right now shows its live tosu score
    if (
      match.id === matchId &&
      (tourney.points.left > 0 || tourney.points.right > 0)
    ) {
      const totalPoints = Math.ceil(tourney.bestOf / 2);
      return {
        red: {
          team: match.red,
          score: tourney.points.left,
          winner: tourney.points.left === totalPoints,
        },
        blue: {
          team: match.blue,
          score: tourney.points.right,
          winner: tourney.points.right === totalPoints,
        },
      };
    }

    return {
      red: { team: match.red, score: match.redScore, winner: match.winner === "red" },
      blue: { team: match.blue, score: match.blueScore, winner: match.winner === "blue" },
    };
  };

  return (
    <div id="main-scheduling">
      <motion.div
        key={`main-${to}`}
        {...(anims.main === "slide"
          ? sectionVariants.main.slide(slideDirection)
          : anims.main === "fade"
            ? sectionVariants.main.fade
            : sectionVariants.main.none)}
      >
        <MainContent>
          <div id="schedule">
            <div id="schedule-left">
              <div id="schedule-upcoming">
                <div id="schedule-upcoming-text">Upcoming Matches</div>
                <div id="upcoming-matches">
                  {upcoming.map((match) => (
                    <MatchRow key={match.id} match={match} {...sides(match)} />
                  ))}
                </div>
              </div>
              <div id="schedule-previous">
                <div id="schedule-previous-text">Previous Matches</div>
                <div id="previous-matches">
                  {recent.map((match) => (
                    <MatchRow key={match.id} match={match} {...sides(match)} />
                  ))}
                </div>
              </div>
            </div>

            <div id="scheduling-right">
              <div id="scheduling-text">Scheduling</div>
              <div id="scheduling-stage">{roundName}</div>
              <div id="scheduling-casters">
                <Casters />
              </div>
            </div>
          </div>
        </MainContent>
      </motion.div>
    </div>
  );
}
