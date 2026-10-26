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
  useEdcUpcoming,
  type EdcEntrant,
  type EdcMatch,
  type EdcScheduleExtra,
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

function MatchTime({ date }: { date: number | null }) {
  return (
    <div className="match-time">
      <div className="match-until">{dayjs(date).fromNow()}</div>
      <div className="match-timestamp">
        {dayjs(date).tz("Europe/Tallinn").format("dddd HH:mm")}
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
      <MatchTime date={match.date} />
    </div>
  );
}

// a stream event typed in on the dashboard, like a mappool showcase
function ExtraRow({ extra }: { extra: EdcScheduleExtra }) {
  return (
    <div className="match">
      <div className="match-info match-extra">
        <FitText className="match-extra-title" min={0.6}>
          {extra.title}
        </FitText>
      </div>
      <MatchTime date={extra.date} />
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
  const { recent } = useEdcSchedule();
  const upcoming = useEdcUpcoming();
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
                  {upcoming.map((item) =>
                    item.kind === "match" ? (
                      <MatchRow
                        key={item.match.id}
                        match={item.match}
                        {...sides(item.match)}
                      />
                    ) : (
                      <ExtraRow key={item.extra.id} extra={item.extra} />
                    ),
                  )}
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
