import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import { useEdcSlotForBeatmap } from "~/state/centaurea";
import { useTosu } from "~/state/tosu";

const round = (n: number, digits: number) =>
  String(Math.round(n * 10 ** digits) / 10 ** digits);

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

interface ShowcaseScreenProps {
  from?: string;
  to: string;
}

export function ShowcaseScreen({ from, to }: ShowcaseScreenProps) {
  const anims: AnimTypes = getAnimations(to, from ?? "");
  const slideDirection: 1 | -1 = 1;

  const { beatmap, tourney } = useTosu();
  const slot = useEdcSlotForBeatmap(beatmap);

  // tosu's map length ignores the rate, unlike its other stats; the tosu
  // schema only corrects it when the tournament client is running
  const rate =
    (slot?.mod === "DT" || slot?.mod === "NC") && tourney.clients.length === 0
      ? 1.5
      : 1;

  const stats = [
    ["SR", round(beatmap.stars, 2)],
    ["BPM", round(beatmap.bpm, 0)],
    ["Length", formatTime(beatmap.length / rate)],
    ["CS", round(beatmap.cs, 1)],
    ["AR", round(beatmap.ar, 1)],
    ["OD", round(beatmap.od, 1)],
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
          <div className="reveal-bar">
            <div className="reveal-slot">
              <div className={`reveal-code ${slot?.mod.toLowerCase() ?? ""}`}>
                {slot?.code ?? "—"}
              </div>
              {slot && <div className="reveal-pool">{slot.roundName}</div>}
            </div>
            <div className="reveal-info">
              <FitText className="reveal-title">{beatmap.title}</FitText>
              <FitText className="reveal-meta" min={0.7}>
                {beatmap.artist} · [{beatmap.difficulty}] · mapped by {beatmap.mapper}
              </FitText>
            </div>
            <div className="reveal-stats">
              {stats.map(([label, value]) => (
                <div key={label}>
                  <div className="reveal-stat-label">{label}</div>
                  <div className="reveal-stat-value">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </MainContent>
      </motion.div>
    </div>
  );
}
