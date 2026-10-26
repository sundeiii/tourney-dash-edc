import dayjs from "dayjs";
import { useEdcUpcoming, type EdcEntrant } from "~/state/centaurea";
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
  const items = useEdcUpcoming().slice(0, 3);

  if (items.length === 0) {
    return null;
  }

  const time = (date: number) =>
    dayjs(date).tz("Europe/Tallinn").format("ddd HH:mm");

  return (
    <div className="up-next">
      <div className="up-next-label">Up next</div>
      {items.map((item) =>
        item.kind === "match" ? (
          <div className="up-next-row" key={item.match.id}>
            <Team team={item.match.red} side="red" />
            <div className="up-next-vs">vs</div>
            <Team team={item.match.blue} side="blue" />
            <div className="up-next-time">{time(item.date)}</div>
          </div>
        ) : (
          <div className="up-next-row up-next-extra" key={item.extra.id}>
            <FitText className="up-next-extra-title" min={0.7}>
              {item.extra.title}
            </FitText>
            <div className="up-next-time">{time(item.date)}</div>
          </div>
        ),
      )}
    </div>
  );
}
