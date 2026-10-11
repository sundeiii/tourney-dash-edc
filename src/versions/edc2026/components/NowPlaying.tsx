import { useTosu } from "~/state/tosu";
import { FitText } from "./FitText";

/** the song osu! is playing, for the holding screens */
export function NowPlaying() {
  const { beatmap } = useTosu();

  // tosu's placeholder until it sends real data
  if (beatmap.title === "loading...") {
    return null;
  }

  return (
    <div className="bookend-link">
      <span className="bookend-link-label">Now playing</span>
      <FitText className="bookend-song" min={0.6}>
        {beatmap.artist} – {beatmap.title}
      </FitText>
    </div>
  );
}
