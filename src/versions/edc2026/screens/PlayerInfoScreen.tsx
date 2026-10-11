import clsx from "clsx";
import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import {
  useEdcCurrentMatch,
  useEdcQualifierStats,
  type EdcEntrant,
  type EdcQualifierResult,
} from "~/state/centaurea";

const MESSAGES = {
  none: "This tournament has no qualifiers",
  private: "Qualifier results aren't public",
  loading: "Loading qualifier results…",
  "no-pool": "The qualifier pool isn't released",
} as const;

type Slot = { id: string; code: string; mod: string };

function summarise(results: Map<string, EdcQualifierResult> | undefined, slots: Slot[]) {
  if (!results || results.size === 0) {
    return null;
  }

  const placements = [...results.values()].map((r) => r.placement);
  const average = placements.reduce((a, b) => a + b, 0) / placements.length;

  const byMod = new Map<string, number[]>();
  for (const slot of slots) {
    const result = results.get(slot.id);
    if (result) {
      byMod.set(slot.mod, [...(byMod.get(slot.mod) ?? []), result.placement]);
    }
  }
  const [bestMod] = [...byMod]
    .map(([mod, ps]) => [mod, ps.reduce((a, b) => a + b, 0) / ps.length] as const)
    .sort((a, b) => a[1] - b[1])[0] ?? [];

  return { average: average.toFixed(1), bestMod };
}

type TeamHeadProps = {
  team: EdcEntrant;
  side: "red" | "blue";
  summary: ReturnType<typeof summarise>;
};

function TeamHead({ team, side, summary }: TeamHeadProps) {
  return (
    <div className={`pi-team ${side}`}>
      <img className="pi-team-avatar" src={team.avatarUrl} />
      <div className="pi-team-text">
        <FitText className="pi-team-name">{team.name}</FitText>
        <FitText className="pi-team-members">
          {team.members.map((m) => m.name).join(" & ")}
        </FitText>
        <div className="pi-team-stats">
          {team.seed && (
            <span>
              Seed <b>#{team.seed}</b>
            </span>
          )}
          {summary && (
            <span>
              Avg placement <b>#{summary.average}</b>
            </span>
          )}
          {summary?.bestMod && (
            <span>
              Best <b>{summary.bestMod}</b>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

type SideProps = {
  side: "red" | "blue";
  result: EdcQualifierResult | undefined;
  entrantCount: number;
};

function Side({ side, result, entrantCount }: SideProps) {
  // first place fills the bar, last place barely shows
  const strength = !result
    ? 0
    : entrantCount > 1
      ? 1 - (result.placement - 1) / (entrantCount - 1)
      : 1;

  return (
    <div className={clsx("pi-side", side, result && result.placement <= 3 && "top")}>
      <span className="pi-score">
        {result ? result.score.toLocaleString("de-DE") : "—"}
      </span>
      <span className="pi-placement">{result ? `#${result.placement}` : ""}</span>
      <div className="pi-bar-track">
        <div className="pi-bar" style={{ width: `${Math.max(strength * 100, 2)}%` }} />
      </div>
    </div>
  );
}

interface PlayerInfoScreenProps {
  from?: string;
  to: string;
}

export function PlayerInfoScreen({ from, to }: PlayerInfoScreenProps) {
  const anims: AnimTypes = getAnimations(to, from ?? "");
  const slideDirection: 1 | -1 = 1;

  const { red, blue } = useEdcCurrentMatch();
  const { status, slots, results, entrantCount } = useEdcQualifierStats();
  const redResults = results.get(red.id);
  const blueResults = results.get(blue.id);

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
          <div className="round-pill">Qualifier results</div>

          <div className="pi-teams">
            <TeamHead team={red} side="red" summary={summarise(redResults, slots)} />
            <TeamHead team={blue} side="blue" summary={summarise(blueResults, slots)} />
          </div>

          {status === "ready" ? (
            <div className="pi-table" style={{ "--rows": slots.length }}>
              {slots.map((slot) => (
                <div className="pi-row" key={slot.id}>
                  <Side side="red" result={redResults?.get(slot.id)} entrantCount={entrantCount} />
                  <div className={`pi-code ${slot.mod.toLowerCase()}`}>{slot.code}</div>
                  <Side side="blue" result={blueResults?.get(slot.id)} entrantCount={entrantCount} />
                </div>
              ))}
            </div>
          ) : (
            <div className="pi-empty">{MESSAGES[status]}</div>
          )}
        </MainContent>
      </motion.div>
    </div>
  );
}
