import { AnimatePresence } from "motion/react";
import { EdcPreload, HuisPreload } from "~/preload";
import { useSettings } from "~/state/dashboard";
import { MappoolScreen as MappoolScreen2025 } from "./versions/ndc2025/screens/Mappools";
import { SchedulingScreen as SchedulingScreen2025 } from "./versions/ndc2025/screens/Scheduling";
import { StandbyScreen as StandbyScreen2025 } from "./versions/ndc2025/screens/Standby";
import { StartScreen as StartScreen2025 } from "./versions/ndc2025/screens/Startscreen";
import { VersusScreen as VersusScreen2025 } from "./versions/ndc2025/screens/Versus";
import { WinnerScreen as WinnerScreen2025 } from "./versions/ndc2025/screens/Winner";
import { MappoolScreen as MappoolScreen2026 } from "./versions/ndc2026/screens/Mappools";
import { SchedulingScreen as SchedulingScreen2026 } from "./versions/ndc2026/screens/Scheduling";
import { StandbyScreen as StandbyScreen2026 } from "./versions/ndc2026/screens/Standby";
import { StartScreen as StartScreen2026 } from "./versions/ndc2026/screens/Startscreen";
import { VersusScreen as VersusScreen2026 } from "./versions/ndc2026/screens/Versus";
import { WinnerScreen as WinnerScreen2026 } from "./versions/ndc2026/screens/Winner";
import { PlayerInfoScreen as PlayerInfoScreen2026 } from "./versions/ndc2026/screens/PlayerInfoScreen";
import { WinnersBracketScreen as WinnersBracketScreen2026 } from "./versions/ndc2026/screens/WinnersBracketScreen";
import { LosersBracketScreen as LosersBracketScreen2026 } from "./versions/ndc2026/screens/LosersBracketScreen";
import { MappoolScreen as MappoolScreenEDC2026 } from "./versions/edc2026/screens/Mappools";
import { SchedulingScreen as SchedulingScreenEDC2026 } from "./versions/edc2026/screens/Scheduling";
import { StandbyScreen as StandbyScreenEDC2026 } from "./versions/edc2026/screens/Standby";
import { StartScreen as StartScreenEDC2026 } from "./versions/edc2026/screens/Startscreen";
import { VersusScreen as VersusScreenEDC2026 } from "./versions/edc2026/screens/Versus";
import { WinnerScreen as WinnerScreenEDC2026 } from "./versions/edc2026/screens/Winner";
import { PlayerInfoScreen as PlayerInfoScreenEDC2026 } from "./versions/edc2026/screens/PlayerInfoScreen";
import { WinnersBracketScreen as WinnersBracketScreenEDC2026 } from "./versions/edc2026/screens/WinnersBracketScreen";
import { LosersBracketScreen as LosersBracketScreenEDC2026 } from "./versions/edc2026/screens/LosersBracketScreen";
import { StartingSoonScreen as StartingSoonScreenEDC2026 } from "./versions/edc2026/screens/StartingSoon";
import { ShowcaseScreen as ShowcaseScreenEDC2026 } from "./versions/edc2026/screens/Showcase";
import { EndingScreen as EndingScreenEDC2026 } from "./versions/edc2026/screens/Ending";
import { QualifierResultsScreen as QualifierResultsScreenEDC2026 } from "./versions/edc2026/screens/QualifierResults";
import { QualifierTeamScreen as QualifierTeamScreenEDC2026 } from "./versions/edc2026/screens/QualifierTeam";
import {
  BrbScreen as BrbScreenEDC2026,
  TechnicalScreen as TechnicalScreenEDC2026,
} from "./versions/edc2026/screens/Breaks";
import { Backdrop as BackdropEDC2026 } from "./versions/edc2026/components/Backdrop";

export function Screens() {
  const [settings] = useSettings();
  const activeScreen = settings.activeScreen;
  const previous = settings.previousScreen;

  const screenSet =
    settings.graphicsStyle === "EDC 2026"
      ? {
          startingsoon: StartingSoonScreenEDC2026,
          start: StartScreenEDC2026,
          standby: StandbyScreenEDC2026,
          playerinfo: PlayerInfoScreenEDC2026,
          versus: VersusScreenEDC2026,
          scheduling: SchedulingScreenEDC2026,
          mappool: MappoolScreenEDC2026,
          showcase: ShowcaseScreenEDC2026,
          qualresults: QualifierResultsScreenEDC2026,
          qualteam: QualifierTeamScreenEDC2026,
          winnersbracket: WinnersBracketScreenEDC2026,
          losersbracket: LosersBracketScreenEDC2026,
          winner: WinnerScreenEDC2026,
          brb: BrbScreenEDC2026,
          technical: TechnicalScreenEDC2026,
          ending: EndingScreenEDC2026,
        }
      : settings.graphicsStyle === "NDC 2026"
      ? {
          startingsoon: StartScreen2026,
          start: StartScreen2026,
          standby: StandbyScreen2026,
          playerinfo: PlayerInfoScreen2026,
          versus: VersusScreen2026,
          scheduling: SchedulingScreen2026,
          mappool: MappoolScreen2026,
          showcase: StandbyScreen2026,
          qualresults: SchedulingScreen2026,
          qualteam: SchedulingScreen2026,
          winnersbracket: WinnersBracketScreen2026,
          losersbracket: LosersBracketScreen2026,
          winner: WinnerScreen2026,
          brb: StartScreen2026,
          technical: StartScreen2026,
          ending: StartScreen2026,
        }
      : {
          startingsoon: StartScreen2025,
          start: StartScreen2025,
          standby: StandbyScreen2025,
          playerinfo: StandbyScreen2025,
          versus: VersusScreen2025,
          scheduling: SchedulingScreen2025,
          mappool: MappoolScreen2025,
          showcase: StandbyScreen2025,
          qualresults: SchedulingScreen2025,
          qualteam: SchedulingScreen2025,
          winnersbracket: StandbyScreen2025,
          losersbracket: StandbyScreen2025,
          winner: WinnerScreen2025,
          brb: StartScreen2025,
          technical: StartScreen2025,
          ending: StartScreen2025,
        };

  const ActiveScreen = screenSet[activeScreen];

  return (
    <div style={{ position: "relative", width: "1920px", height: "1080px" }}>
      {settings.graphicsStyle === "EDC 2026" ? (
        <>
          <EdcPreload />
          <BackdropEDC2026 screen={activeScreen} />
        </>
      ) : (
        <HuisPreload />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <ActiveScreen key={activeScreen} from={previous} to={activeScreen} />
      </AnimatePresence>
    </div>
  );
}
