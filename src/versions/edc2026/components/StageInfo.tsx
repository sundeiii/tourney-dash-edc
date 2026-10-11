import { useEdcCurrentMatch } from "~/state/centaurea";

export function StageInfo() {
  const { roundName, bracketLabel } = useEdcCurrentMatch();

  return (
    <div id="stage-info">
      <div id="stage-name">{roundName}</div>
      {bracketLabel && <div id="winner-loser">({bracketLabel})</div>}
    </div>
  );
}
