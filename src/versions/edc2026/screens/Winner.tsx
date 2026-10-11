import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { FooterContent } from "../components/FooterContent";
import { MainContent } from "../components/MainContent";
import { TeamMembers } from "../components/TeamMembers";
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
  const { red, blue, roundName, bracketLabel } = useEdcCurrentMatch();

  const totalPoints = Math.ceil(tourney.bestOf / 2);
  const winnerTeam: "red" | "blue" =
    tourney.points.left !== totalPoints && tourney.points.right === totalPoints
      ? "blue"
      : "red";
  const winner = winnerTeam === "blue" ? blue : red;

  return (
    <div>
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
              <div id="win-top">
                <div id="win-left">
                  <div id="win-title">
                    <div id="win-stage-name">{roundName}</div>
                    {bracketLabel && (
                      <div id="win-winner-loser">({bracketLabel})</div>
                    )}
                  </div>

                  <div id="win-player" className={winnerTeam}>
                    <div id="win-player-icon" className={winnerTeam}>
                      <img src={winner.avatarUrl} />
                    </div>
                    <div id="win-player-info">
                      <FitText id="win-player-name">{winner.name}</FitText>
                      {winner.seed && (
                        <div id="win-player-seed">
                          <span className="player-info-label">Seed: </span>
                          {winner.seed}
                        </div>
                      )}
                    </div>
                  </div>

                  <TeamMembers team={winner} side={winnerTeam} />
                </div>
              </div>
            </MainContent>
          </motion.div>

          <motion.div
            key={`footer-${to}`}
            {...(anims.footer === "slide"
              ? sectionVariants.footer.slide(slideDirection)
              : anims.footer === "fade"
                ? sectionVariants.footer.fade
                : sectionVariants.footer.none)}
          >
            <FooterContent>
              <div id="bottom">
                <div id="win-footer-text">WINNER</div>
              </div>
            </FooterContent>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
