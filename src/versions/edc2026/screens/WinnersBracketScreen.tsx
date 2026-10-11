import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { Bracket } from "../components/Bracket";
import { MainContent } from "../components/MainContent";

interface WinnersBracketScreenProps {
  from?: string;
  to: string;
}

export function WinnersBracketScreen({ from, to }: WinnersBracketScreenProps) {
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
          <Bracket side="winners" />
        </MainContent>
      </motion.div>
    </div>
  );
}
