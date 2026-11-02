import clsx from "clsx";
import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import { useEdcSlotForBeatmap } from "~/state/centaurea";
import { useTosu } from "~/state/tosu";

const round = (n: number, digits: number) =>
  Math.round(n * 10 ** digits) / 10 ** digits;

const fixed = (n: number, digits: number) => round(n, digits).toFixed(digits);

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

interface Showcase2ScreenProps {
  from?: string;
  to: string;
}

/**
 * The mappool showcase drawn straight on the full-screen osu! capture, with
 * no background: map info up top, the player and stats bottom left, clear of
 * osu!'s own key overlay and the spectator list.
 */
export function Showcase2Screen({ from, to }: Showcase2ScreenProps) {
  const anims: AnimTypes = getAnimations(to, from ?? "");
  const slideDirection: 1 | -1 = 1;

  const { beatmap, tourney, playerName } = useTosu();
  const slot = useEdcSlotForBeatmap(beatmap);

  // tosu's map length ignores the rate, unlike its other stats; the tosu
  // schema only corrects it when the tournament client is running
  const rate =
    (slot?.mod === "DT" || slot?.mod === "NC") && tourney.clients.length === 0
      ? 1.5
      : 1;

  const { live, firstObject, lastObject } = beatmap.time;
  const progress =
    lastObject > firstObject
      ? Math.min(1, Math.max(0, (live - firstObject) / (lastObject - firstObject)))
      : 0;

  const stats = [
    ["BPM", String(round(beatmap.bpm, 0))],
    ["Length", formatTime(beatmap.length / rate)],
    ["CS", fixed(beatmap.cs, 2)],
    ["AR", fixed(beatmap.ar, 2)],
    ["OD", fixed(beatmap.od, 2)],
    ["HP", fixed(beatmap.hp, 2)],
  ] as const;

  return (
    <div id="main">
      <motion.div
        key={`main-${to}`}
        {...(anims.main === "slide"
          ? sectionVariants.main.slide(slideDirection)
          : anims.main === "fade"
            ? sectionVariants.main.fade
            : sectionVariants.main.none)}
      >
        <MainContent>
          <div className="sc2-map">
            <FitText className="sc2-title">
              {beatmap.artist} - {beatmap.title}
            </FitText>
            <div className="sc2-line">
              <span className="sc2-label">Difficulty:</span> {beatmap.difficulty}
            </div>
            <div className="sc2-line">
              <span className="sc2-label">Mapped by:</span> {beatmap.mapper}
            </div>
          </div>

          <div className="sc2-slot">
            <div className={clsx("sc2-code", slot?.mod.toLowerCase())}>
              {slot?.code ?? "—"}
            </div>
            <div className="sc2-stars">{fixed(beatmap.stars, 2)} ★</div>
          </div>

          <div className="sc2-corner">
            {playerName && (
              <>
                <div className="sc2-label">Replay by</div>
                <div className="sc2-player">{playerName}</div>
              </>
            )}
            <div className="sc2-progress">
              <div style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="sc2-stats">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <div className="sc2-label">{label}</div>
                  <div className="sc2-value">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </MainContent>
      </motion.div>
    </div>
  );
}
