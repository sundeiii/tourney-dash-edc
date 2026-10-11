import clsx from "clsx";
import { Fragment, type CSSProperties } from "react";
import {
  useEdcBracket,
  type EdcEntrant,
  type EdcMatch,
  type EdcRound,
} from "~/state/centaurea";
import { useSettings } from "~/state/dashboard";
import { FitText } from "./FitText";

// the free area of the seedings background: below its logo, above its border
const AREA = { left: 60, top: 170, width: 1800, height: 700 };
const HEADER_HEIGHT = 50;
const MIN_GAP = 60;
const MAX_BOX_WIDTH = 300;
const BOX_HEIGHT = 72;

type Column = { round: EdcRound; matches: EdcMatch[] };

function useColumns(side: "winners" | "losers"): Column[] {
  const { rounds, matches } = useEdcBracket();

  return rounds
    .filter(
      (r) =>
        !r.qualifier &&
        (side === "losers" ? r.side === "losers" : r.side !== "losers"),
    )
    .map((round) => ({
      round,
      matches: matches
        .filter((m) => m.round.id === round.id)
        .toSorted((a, b) => a.position - b.position),
    }));
}

type RowProps = {
  team: EdcEntrant | undefined;
  score: number | string | null;
  won: boolean | null;
};

function BracketRow({ team, score, won }: RowProps) {
  return (
    <div className={clsx("br-row", won === false && "lost")}>
      {team ? (
        <img className="br-avatar" src={team.avatarUrl} />
      ) : (
        <div className="br-avatar" />
      )}
      <FitText className="br-name" min={0.6}>
        {team?.name ?? "TBD"}
      </FitText>
      <div className={clsx("br-score", won && "win")}>{score ?? ""}</div>
    </div>
  );
}

type MatchProps = {
  match: EdcMatch;
  current: boolean;
  style: CSSProperties;
};

function BracketMatch({ match, current, style }: MatchProps) {
  const won = (side: "red" | "blue") =>
    match.winner === null ? null : match.winner === side;

  const score = (side: "red" | "blue") => {
    if (match.state === "scheduled") {
      return null;
    }
    // a walkover has no maps to count
    if (
      match.state === "forfeit" &&
      match.redScore === 0 &&
      match.blueScore === 0
    ) {
      return won(side) ? "W" : "FF";
    }
    return side === "red" ? match.redScore : match.blueScore;
  };

  return (
    <div className={clsx("br-match", current && "current")} style={style}>
      <BracketRow team={match.red} score={score("red")} won={won("red")} />
      <BracketRow team={match.blue} score={score("blue")} won={won("blue")} />
    </div>
  );
}

export function Bracket({ side }: { side: "winners" | "losers" }) {
  const columns = useColumns(side);
  const [{ edc }] = useSettings();

  const count = columns.length;
  const boxWidth = Math.min(
    MAX_BOX_WIDTH,
    (AREA.width - (count - 1) * MIN_GAP) / count,
  );
  const gap = count > 1 ? (AREA.width - count * boxWidth) / (count - 1) : 0;
  const columnX = (k: number) => AREA.left + k * (boxWidth + gap);
  const matchY = (matches: number, i: number) =>
    AREA.top +
    HEADER_HEIGHT +
    ((i + 0.5) * (AREA.height - HEADER_HEIGHT)) / matches;

  // join each match to the one its winner plays next: straight across when the
  // next round is as big, otherwise pairs (2i, 2i+1) feed match i
  const connectors = columns.flatMap((column, k) => {
    const next = columns[k + 1];
    if (!next || next.matches.length === 0) {
      return [];
    }

    return column.matches.flatMap((_, i) => {
      const target =
        next.matches.length === column.matches.length ? i : Math.floor(i / 2);
      if (target >= next.matches.length) {
        return [];
      }

      const x1 = columnX(k) + boxWidth;
      const x2 = columnX(k + 1);
      const xMid = (x1 + x2) / 2;
      const y1 = matchY(column.matches.length, i);
      const y2 = matchY(next.matches.length, target);
      return [`M${x1} ${y1} H${xMid} V${y2} H${x2}`];
    });
  });

  const drawn = columns.some((c) => c.matches.length > 0);

  return (
    <div className="br">
      <div className="br-title">
        {side === "winners" ? "Winners Bracket" : "Losers Bracket"}
      </div>

      <svg className="br-lines" width="1920" height="1080" viewBox="0 0 1920 1080">
        {connectors.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>

      {columns.map((column, k) => (
        <Fragment key={column.round.id}>
          <div
            className="br-round"
            style={{ left: columnX(k), top: AREA.top, width: boxWidth }}
          >
            <div className="br-round-name">{column.round.name}</div>
            <div className="br-round-bo">Bo{column.round.bestOf}</div>
          </div>

          {column.matches.map((match, i) => (
            <BracketMatch
              key={match.id}
              match={match}
              current={match.id === edc.matchId}
              style={{
                left: columnX(k),
                top: matchY(column.matches.length, i) - BOX_HEIGHT / 2,
                width: boxWidth,
                height: BOX_HEIGHT,
              }}
            />
          ))}
        </Fragment>
      ))}

      {!drawn && <div className="br-empty">Bracket not drawn yet</div>}
    </div>
  );
}
