import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import { RoundPill } from "../components/RoundPill";
import { useEdcCurrentMatch } from "~/state/centaurea";
import { useTosu } from "~/state/tosu";

interface WinnerScreenProps {
  from?: string;
  to: string;
}

export function WinnerScreen({ from, to }: WinnerScreenProps) {
  // treat this component as self (to) and other as from
  const anims: AnimTypes = getAnimations(to, from ?? "");

  const slideDirection: 1 | -1 = 1;

  const { tourney } = useTosu();
  const { red, blue } = useEdcCurrentMatch();

  const totalPoints = Math.ceil(tourney.bestOf / 2);
  const winnerTeam: "red" | "blue" =
    tourney.points.left !== totalPoints && tourney.points.right === totalPoints
      ? "blue"
      : "red";
  const [winner, loser] = winnerTeam === "blue" ? [blue, red] : [red, blue];
  const [winnerPoints, loserPoints] =
    winnerTeam === "blue"
      ? [tourney.points.right, tourney.points.left]
      : [tourney.points.left, tourney.points.right];

  return (
    <div id="main">
      <div className="screen-fade-3">
        <motion.div
          key={`main-${to}`}
          {...(anims.main === "slide"
            ? sectionVariants.main.slide(slideDirection)
            : anims.main === "fade"
              ? sectionVariants.main.fade
              : sectionVariants.main.none)}
        >
          <MainContent>
            <RoundPill />
            <div className={`ew ${winnerTeam}`}>
              <div className="ew-title">Winner</div>
              <img className="ew-avatar" src={winner.avatarUrl} />
              <FitText className="ew-name">{winner.name}</FitText>
              {winnerPoints + loserPoints > 0 && (
                <div className="ew-score">
                  <span className="ew-score-points">
                    {winnerPoints} – {loserPoints}
                  </span>
                  <span className="ew-score-vs">vs {loser.name}</span>
                </div>
              )}
              <div className="ew-players">
                {winner.members.map((member) => (
                  <div className="ew-player" key={member.id}>
                    <img src={member.avatarUrl} />
                    <span>{member.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </MainContent>
        </motion.div>
      </div>
    </div>
  );
}
