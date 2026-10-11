import clsx from "clsx";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import { useEdcQualifierStandings } from "~/state/centaurea";
import { SCORING_LABELS, formatStandingValue } from "~/state/qualifierStandings";

const MESSAGES = {
  none: "This tournament has no qualifiers",
  private: "Qualifier results aren't public",
  loading: "Loading qualifier results…",
  "no-scores": "No qualifier scores yet",
} as const;

// the space between the logo and the seedings background's cornflowers
const TABLE_HEIGHT = 720;
const ROW_GAP = 8;
const MIN_ROWS = 8;

/**
 * every team's qualifier result, built up from last place to the top seed;
 * also the summary at the end of the Team Results screen
 */
export function QualifierStandings() {
  const { status, method, advanceCount, standings } = useEdcQualifierStandings();

  // two columns, filled top to bottom
  const rows = Math.max(Math.ceil(standings.length / 2), MIN_ROWS);
  const rowHeight = (TABLE_HEIGHT - (rows - 1) * ROW_GAP) / rows;

  return (
    <>
      <div className="qr-title">Qualifier results</div>
      <div className="qr-meta">
        Ranked by <b>{(SCORING_LABELS[method] ?? method).toLowerCase()}</b>
        {advanceCount && (
          <>
            {" · "}top <b>{advanceCount}</b> advance
          </>
        )}
      </div>

      {status === "ready" ? (
        <div
          className="qr-table"
          style={
            {
              "--rows": rows,
              "--row-h": `${rowHeight}px`,
              rowGap: ROW_GAP,
            } as CSSProperties
          }
        >
          {standings.map(({ entrantId, entrant, players, rank, shown }) => (
            <motion.div
              key={entrantId}
              className={clsx(
                "qr-row",
                advanceCount !== null && rank > advanceCount && "out",
              )}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              // last place first, building up to the top seed
              transition={{
                delay: 0.4 + (standings.length - rank) * 0.06,
                duration: 0.3,
              }}
            >
              <div className="qr-rank">{rank}</div>
              <img className="qr-avatar" src={entrant?.avatarUrl} />
              <div className="qr-team">
                <FitText className="qr-name" min={0.6}>
                  {entrant?.name ?? "???"}
                </FitText>
                {/* each player's average per map, from the lobby's osu! match */}
                <FitText className="qr-members" min={0.6}>
                  {players.map((player, i) => (
                    <span key={i}>
                      {i > 0 && " · "}
                      {player.name}
                      {player.average !== null && (
                        <b> {Math.round(player.average).toLocaleString("de-DE")}</b>
                      )}
                    </span>
                  ))}
                </FitText>
              </div>
              <div className="qr-value">{formatStandingValue(method, shown)}</div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="qr-empty">{MESSAGES[status]}</div>
      )}
    </>
  );
}

interface QualifierResultsScreenProps {
  from?: string;
  to: string;
}

export function QualifierResultsScreen({ from, to }: QualifierResultsScreenProps) {
  const anims: AnimTypes = getAnimations(to, from ?? "");
  const slideDirection: 1 | -1 = 1;

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
          <QualifierStandings />
        </MainContent>
      </motion.div>
    </div>
  );
}
