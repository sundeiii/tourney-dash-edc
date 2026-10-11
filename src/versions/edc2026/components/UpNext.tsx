import dayjs from "dayjs";
import { useEdcSchedule, type EdcEntrant } from "~/state/centaurea";
import { FitText } from "./FitText";

function Team({ team, side }: { team: EdcEntrant | undefined; side: "red" | "blue" }) {
  return (
    <div className={`up-next-team ${side}`}>
      {team && <img src={team.avatarUrl} />}
      <FitText className="up-next-name" min={0.7}>
        {team?.name ?? "TBD"}
      </FitText>
    </div>
  );
}

export function UpNext() {
  const matches = useEdcSchedule().upcoming.slice(0, 3);

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className="up-next">
      <div className="up-next-label">Up next</div>
      {matches.map((match) => (
        <div className="up-next-row" key={match.id}>
          <Team team={match.red} side="red" />
          <div className="up-next-vs">vs</div>
          <Team team={match.blue} side="blue" />
          <div className="up-next-time">
            {dayjs(match.date).tz("Europe/Tallinn").format("ddd HH:mm")}
          </div>
        </div>
      ))}
    </div>
  );
}
