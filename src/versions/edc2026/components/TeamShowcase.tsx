import type { EdcEntrant } from "~/state/centaurea";
import { FitText } from "./FitText";

type Props = {
  team: EdcEntrant;
  side: "red" | "blue";
};

export function TeamShowcase({ team, side }: Props) {
  return (
    <div className={`team-showcase ${side}`}>
      <img className="team-showcase-avatar" src={team.avatarUrl} />
      <FitText className="team-showcase-name">{team.name}</FitText>
      <FitText className="team-showcase-members">
        {team.members.map((m) => m.name).join(" & ")}
      </FitText>
      {team.seed && <div className="team-showcase-seed">Seed {team.seed}</div>}
    </div>
  );
}
