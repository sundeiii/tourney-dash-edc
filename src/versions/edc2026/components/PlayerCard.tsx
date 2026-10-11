import type { EdcEntrant } from "~/state/centaurea";
import { FitText } from "./FitText";
import { PlayerAvatar } from "./PlayerAvatar";

type Props = {
  team: EdcEntrant;
  side: "red" | "blue";
};

export function PlayerCard({ team, side }: Props) {
  return (
    <div id={`ss-${side}-player`} className={side}>
      <PlayerAvatar url={team.avatarUrl} color={side} />
      <div className="ss-player-info">
        <FitText className="ss-player-name">{team.name}</FitText>
        <FitText className="ss-player-members">
          {team.members.map((m) => m.name).join(" & ")}
        </FitText>
        {team.seed && (
          <div className="ss-player-seed">
            <span className="player-info-label">Seed: </span>
            {team.seed}
          </div>
        )}
      </div>
    </div>
  );
}
