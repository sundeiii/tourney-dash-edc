import type { EdcEntrant } from "~/state/centaurea";
import { PlayerAvatar } from "./PlayerAvatar";

type Props = {
  team: EdcEntrant;
  side: "red" | "blue";
};

export function TeamMembers({ team, side }: Props) {
  return (
    <div className="ss-supporters">
      <div className="ss-supporters-amount">
        <span className="player-info-label">Players</span>
      </div>
      <div className="ss-supporters-avatars grid">
        {team.members.map((member) => (
          <div key={member.id}>
            <PlayerAvatar
              className="supporter"
              url={member.avatarUrl}
              color={side}
              width={100}
              height={100}
              borderStyle={"square"}
              borderWidth={4}
            />
            <div className="ss-supporter-name">{member.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
