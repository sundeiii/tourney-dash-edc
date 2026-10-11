import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { Casters } from "../components/Casters";
import { CurrentMapStats } from "../components/CurrentMapStats";
import { FooterContent } from "../components/FooterContent";
import { HeaderContent } from "../components/HeaderContent";
import { MainContent } from "../components/MainContent";
import { PlayerInfo } from "../components/PlayerInfo";
import { ScoreBars } from "../components/ScoreBars";
import { StageInfo } from "../components/StageInfo";
import { MatchPoints } from "../components/MatchPoints";
import { Chat } from "../components/Chat";

interface VersusScreenProps {
  from?: string;
  to: string;
}

export function VersusScreen({ from, to }: VersusScreenProps) {
  // treat this component as self (to) and other as from
  const anims: AnimTypes = getAnimations(to, from ?? "");

  const slideDirection: 1 | -1 = 1;
  return (
    <div>
      <div id="main" className="no-background">
          <motion.div
            key={`header-${to}`}
            {...(anims.header === "slide"
              ? sectionVariants.header.slide(slideDirection)
              : anims.header === "fade"
                ? sectionVariants.header.fade
                : sectionVariants.header.none)}
          >
            <HeaderContent>
              <div id="top">
                <PlayerInfo playerNum={1} />
                <ScoreBars />
                <PlayerInfo playerNum={2} />
                <MatchPoints/>
              </div>
            </HeaderContent>
          </motion.div>

          <motion.div
            key={`main-${to}`}
            {...(anims.main === "slide"
              ? sectionVariants.main.slide(slideDirection)
              : anims.main === "fade"
                ? sectionVariants.main.fade
                : sectionVariants.main.none)}
          >
            <MainContent>
              <div id="gameplay"></div>
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
            <FooterContent>
              <div id="orange-line"></div>
              <div id="bottom">
                <StageInfo />
                <CurrentMapStats />
                <Casters />
              </div>
            </FooterContent>
          </motion.div>
      </div>
    </div>
  );
}
