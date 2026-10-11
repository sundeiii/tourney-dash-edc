import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import { UpNext } from "../components/UpNext";
import { useEdcLinks } from "~/state/centaurea";

interface EndingScreenProps {
  from?: string;
  to: string;
}

export function EndingScreen({ from, to }: EndingScreenProps) {
  const anims: AnimTypes = getAnimations(to, from ?? "");
  const slideDirection: 1 | -1 = 1;
  const discord = useEdcLinks().find((link) => link.kind === "discord");

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
            <FitText className="bookend-title">Thanks for watching</FitText>
            <div className="bookend-subtitle">See you next time!</div>
            {discord && (
              <div className="bookend-link">
                <span className="bookend-link-label">Join the Discord</span>
                <span className="bookend-link-url">
                  {discord.url.replace(/^https?:\/\//, "")}
                </span>
              </div>
            )}
          </div>
          <UpNext />
        </MainContent>
      </motion.div>
    </div>
  );
}
