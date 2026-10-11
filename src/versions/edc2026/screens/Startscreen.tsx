import clsx from "clsx";
import { motion } from "framer-motion";
import Countdown, { zeroPad, type CountdownRenderProps } from "react-countdown";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { MainContent } from "../components/MainContent";
import { RoundPill } from "../components/RoundPill";
import { TeamShowcase } from "../components/TeamShowcase";
import { useEdcCurrentMatch } from "~/state/centaurea";
import { useSettings } from "~/state/dashboard";

interface StartScreenProps {
  from?: string;
  to: string;
}

const startingSoon = <span className="es-countdown-soon">Starting soon</span>;

const renderer = ({
  days,
  hours,
  minutes,
  seconds,
  completed,
}: CountdownRenderProps) =>
  completed ? (
    startingSoon
  ) : (
    <>
      <span className="es-countdown-label">Starts in</span>
      <span className="es-countdown-time">
        {zeroPad(days * 24 * 60 + hours * 60 + minutes)}:{zeroPad(seconds)}
      </span>
    </>
  );

export function StartScreen({ from, to }: StartScreenProps) {
  const { red, blue } = useEdcCurrentMatch();
  const [settings] = useSettings();
  // treat this component as self (to) and other as from
  const anims: AnimTypes = getAnimations(to, from ?? "");

  const slideDirection: 1 | -1 = 1;

  return (
    <div id="main">
      <div className="screen-fade-3">
        <motion.div
          key={`main-${to}`}
          {...(anims.main === "slide"
            ? sectionVariants.main.slide(slideDirection)
            : anims.main === "fade"
              ? sectionVariants.main.fade
              : sectionVariants.main.none)}
        >
          <MainContent>
            <RoundPill />
            <div className="es-teams">
              <TeamShowcase team={red} side="red" />
              <div className="es-vs">VS</div>
              <TeamShowcase team={blue} side="blue" />
            </div>
          </MainContent>
        </motion.div>

        <motion.div
          key={`footer-${to}`}
          {...(anims.footer === "slide"
            ? sectionVariants.footer.slide(slideDirection)
            : anims.footer === "fade"
              ? sectionVariants.footer.fade
              : sectionVariants.footer.none)}
        >
          <div
            className={clsx("es-countdown", settings.showCountdown && "visible")}
          >
            {settings.countdown ? (
              <Countdown
                key={`countdown-${settings.countdown}`}
                renderer={renderer}
                date={settings.countdown}
                autoStart={true}
              />
            ) : (
              startingSoon
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
