import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { FitText } from "../components/FitText";
import { MainContent } from "../components/MainContent";
import { NowPlaying } from "../components/NowPlaying";
import { UpNext } from "../components/UpNext";

interface BreakScreenProps {
  from?: string;
  to: string;
}

function BreakScreen({
  from,
  to,
  title,
  subtitle,
}: BreakScreenProps & { title: string; subtitle: string }) {
  const anims: AnimTypes = getAnimations(to, from ?? "");
  const slideDirection: 1 | -1 = 1;

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
            <FitText className="bookend-title">{title}</FitText>
            <div className="bookend-subtitle">{subtitle}</div>
            <NowPlaying />
          </div>
          <UpNext />
        </MainContent>
      </motion.div>
    </div>
  );
}

export function BrbScreen(props: BreakScreenProps) {
  return (
    <BreakScreen {...props} title="Be right back" subtitle="We'll be back shortly" />
  );
}

export function TechnicalScreen(props: BreakScreenProps) {
  return (
    <BreakScreen
      {...props}
      title="Technical difficulties"
      subtitle="Please stand by, we'll be back soon"
    />
  );
}
