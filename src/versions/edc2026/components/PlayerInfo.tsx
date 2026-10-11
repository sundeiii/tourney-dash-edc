import clsx from "clsx";
import { useEdcCurrentMatch } from "~/state/centaurea";
import { FitText } from "./FitText";

export function PlayerInfo({ playerNum }: { playerNum: 1 | 2 }) {
  const { red, blue } = useEdcCurrentMatch();

  const [team, color, side] =
    playerNum === 1
      ? ([red, "red", "left"] as const)
      : ([blue, "blue", "right"] as const);

  return (
    <div id={`${color}-player`}>
      <div id="player" className={clsx(playerNum === 2 && "flex-reverse")}>
        <div id={`${color}-player-icon`}>
          <img src={team.avatarUrl} />
        </div>
        <div id="player-info">
          <FitText id="player-name" className={`align-${side}`}>
            {team.name}
          </FitText>
          <FitText id="player-members" className={`align-${side}`}>
            {team.members.map((m) => m.name).join(" & ")}
          </FitText>
          {team.seed && (
            <div id="player-seed" className={`align-${side}`}>
              <span className="player-info-label-small">Seed: </span>
              {team.seed}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
