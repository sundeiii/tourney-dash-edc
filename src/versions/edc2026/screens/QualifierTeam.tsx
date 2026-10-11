import clsx from "clsx";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import { useEdcQualifierTeam } from "~/state/centaurea";
import { SCORING_LABELS, formatStandingValue } from "~/state/qualifierStandings";
import { QualifierStandings } from "./QualifierResults";

const MESSAGES = {
  none: "This tournament has no qualifiers",
  private: "Qualifier results aren't public",
  loading: "Loading qualifier results…",
  "no-scores": "No qualifier scores yet",
  "no-pool": "The qualifier pool isn't released",
} as const;

const formatScore = (score: number | null | undefined) =>
  score ? Math.round(score).toLocaleString("de-DE") : "—";

interface QualifierTeamScreenProps {
  from?: string;
  to: string;
}

/** one team's qualifier run, stepped through from the dashboard */
export function QualifierTeamScreen({ from, to }: QualifierTeamScreenProps) {
  const anims: AnimTypes = getAnimations(to, from ?? "");
  const slideDirection: 1 | -1 = 1;

  const { status, method, advanceCount, standings, summary, team, maps } =
    useEdcQualifierTeam();
  const advances = !!team && (advanceCount === null || team.rank <= advanceCount);

  // the step after #1: every team, building up to the top seed again
  if (summary) {
    return (
      <div id="main">
        <motion.div
          key={`main-${to}`}
          {...(anims.main === "slide"
            ? sectionVariants.main.slide(slideDirection)
            : anims.main === "fade"
              ? sectionVariants.main.fade
              : sectionVariants.main.none)}
        >
          <MainContent>
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
            >
              <QualifierStandings />
            </motion.div>
          </MainContent>
        </motion.div>
      </div>
    );
  }

  return (
    <div id="main">
      <motion.div
        key={`main-${to}`}
        {...(anims.main === "slide"
          ? sectionVariants.main.slide(slideDirection)
          : anims.main === "fade"
            ? sectionVariants.main.fade
            : sectionVariants.main.none)}
      >
        <MainContent>
          <div className="qr-title">Qualifier results</div>
          <div className="qr-meta">
            Ranked by <b>{(SCORING_LABELS[method] ?? method).toLowerCase()}</b>
          </div>

          {status === "ready" && team ? (
            // keyed so each step to another team plays in fresh
            <motion.div
              key={team.entrantId}
              className="qt"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <div className="qt-team">
                <div className="qt-head">
                  <div className="qt-rank">
                    <span className="qt-rank-hash">#</span>
                    {team.rank}
                  </div>
                  <img className="qt-avatar" src={team.entrant?.avatarUrl} />
                </div>
                <FitText className="qt-name" min={0.5}>
                  {team.entrant?.name ?? "???"}
                </FitText>
                <div className={clsx("qt-status", !advances && "out")}>
                  {advances ? "Advances to the bracket" : "Eliminated"}
                  <span>
                    {team.rank} of {standings.length}
                  </span>
                </div>

                <div className="qt-overall">
                  <div className="qt-label">{SCORING_LABELS[method] ?? method}</div>
                  <div className="qt-overall-value">
                    {formatStandingValue(method, team.shown)}
                  </div>
                </div>

                <div className="qt-players">
                  {team.players.map((player, i) => (
                    <div className="qt-player" key={i}>
                      <img src={player.avatarUrl} />
                      <FitText className="qt-player-name" min={0.6}>
                        {player.name}
                      </FitText>
                      <div className="qt-player-avg">
                        <div className="qt-label">Average</div>
                        {formatScore(player.average)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="qt-maps"
                style={
                  {
                    "--maps": maps.length,
                    "--players": team.players.length,
                  } as CSSProperties
                }
              >
                <div className="qt-maps-head">
                  <span>Map</span>
                  <span />
                  <span className="right">Team</span>
                  <span className="center">Place</span>
                  {team.players.map((player, i) => (
                    <FitText key={i} className="qt-maps-player right" min={0.6}>
                      {player.name}
                    </FitText>
                  ))}
                </div>
                {maps.map((map, i) => {
                  const placement = map.result?.placement;
                  return (
                    <motion.div
                      key={map.id}
                      className="qt-map"
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.04, duration: 0.25 }}
                    >
                      <div className={`qt-code ${map.mod.toLowerCase()}`}>{map.code}</div>
                      <FitText className="qt-map-title" min={0.6}>
                        {map.title}
                      </FitText>
                      <div className="qt-score">{formatScore(map.result?.score)}</div>
                      <div className={clsx("qt-place", placement !== undefined && placement <= 3 && "top")}>
                        {placement !== undefined ? `#${placement}` : "—"}
                      </div>
                      {map.playerScores.map((score, j) => (
                        <div className="qt-player-score" key={j}>
                          {formatScore(score)}
                        </div>
                      ))}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <div className="qr-empty">{MESSAGES[status === "ready" ? "no-scores" : status]}</div>
          )}
        </MainContent>
      </motion.div>
    </div>
  );
}
