import { useEdcCurrentMatch } from "~/state/centaurea";

export function RoundPill() {
  const { roundName, bracketLabel } = useEdcCurrentMatch();

  return (
    <div className="round-pill">
      <span>{roundName}</span>
      {bracketLabel && <span className="round-pill-label">{bracketLabel}</span>}
    </div>
  );
}
