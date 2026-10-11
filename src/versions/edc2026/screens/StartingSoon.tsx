import { motion } from "framer-motion";
import Countdown, { zeroPad, type CountdownRenderProps } from "react-countdown";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import { NowPlaying } from "../components/NowPlaying";
import { UpNext } from "../components/UpNext";
import { useSettings } from "~/state/dashboard";

const renderer = ({ days, hours, minutes, seconds, completed }: CountdownRenderProps) =>
  completed ? null : (
    <span>
      {zeroPad(days * 24 * 60 + hours * 60 + minutes)}:{zeroPad(seconds)}
    </span>
  );

interface StartingSoonScreenProps {
  from?: string;
  to: string;
}

export function StartingSoonScreen({ from, to }: StartingSoonScreenProps) {
  const anims: AnimTypes = getAnimations(to, from ?? "");
  const slideDirection: 1 | -1 = 1;
  const [settings] = useSettings();

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
          <div className="bookend">
            <FitText className="bookend-title">Starting soon</FitText>
            {settings.countdown && settings.showCountdown && (
              <div className="bookend-countdown">
                <Countdown
                  key={`countdown-${settings.countdown}`}
                  renderer={renderer}
                  date={settings.countdown}
                  autoStart={true}
                />
              </div>
            )}
            <NowPlaying />
          </div>
          <UpNext />
        </MainContent>
      </motion.div>
    </div>
  );
}
