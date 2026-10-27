import clsx from "clsx";
import { motion } from "framer-motion";
import type { AnimTypes } from "~/animations";
import { getAnimations, sectionVariants } from "~/animations";
import { Casters } from "../components/Casters";
import { Chat } from "../components/Chat";
import { FooterContent } from "../components/FooterContent";
import { HeaderContent } from "../components/HeaderContent";
import { MainContent } from "../components/MainContent";
import { PlayerInfo } from "../components/PlayerInfo";
import { StageInfo } from "../components/StageInfo";
import type { DashboardSettings } from "~/schemas/settings";
import {
  useEdcCurrentMatch,
  useEdcMappool,
  type EdcBeatmap,
} from "~/state/centaurea";
import { useSettings } from "~/state/dashboard";
import { MatchPoints } from "../components/MatchPoints";

type ModGroupProps = {
  mod: string;
  maps: EdcBeatmap[];
  names: { player1: string; player2: string };
  settings: DashboardSettings;
};

function ModGroup({ mod, maps, names, settings }: ModGroupProps) {
  const tb = mod === "tb" && "tb";

  return (
    <div id={`${mod}-pool`} className="mappool-group">
      {maps.map((map) => (
        <div className={`mappool-map ${mod}`} key={map.code}>
          {(["player1", "player2"] as const).map((player) => (
            <div key={`${player}-choices`}>
              <div
                className={clsx(
                  `picked-${tb || player}`,
                  settings[player].picks.includes(map.code) && "picked-active",
                )}
              >
                <div className={`picked-indicator-${tb || player}`}>
                  {tb ? "TIEBREAKER HYPE!!!" : `Picked`}
                </div>
              </div>
              <div
                className={clsx(
                  `banned-${player}`,
                  settings[player].bans.includes(map.code) && "banned-active",
                )}
              >
                <div className={clsx(`banned-indicator-${player}`, "banned-by")}>
                  <span>BANNED BY</span>
                  <span className={player}>{names[player]}</span>
                </div>
              </div>
            </div>
          ))}
          <div className={clsx("mappool-map-top", tb)}>
            <div
              className="beatmap-bg"
              style={{ "--bg": map.bgUrl ? `url("${map.bgUrl}")` : "" }}
            />
            <div className={`mappool-map-id ${mod}`}>
              {tb ? map.mod : map.code}
            </div>
          </div>
          <div className={clsx("mappool-map-bottom", tb)}>
            <div className={clsx("mappool-map-artist-title", tb)}>
              {`${map.artist} - ${map.title}`}
            </div>
            <div className={clsx("mappool-map-difficulty", tb)}>
              {map.difficulty}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// a row holds about six of the small cards, so mods with few maps share one
// and a pool with many mods still fits above the footer
const MAPS_PER_ROW = 6;

function packRows<T extends { mod: string; maps: unknown[] }>(groups: T[]) {
  const rows: T[][] = [];
  let count = Infinity;
  for (const group of groups) {
    const tb = group.mod.toLowerCase() === "tb";
    if (tb || count + group.maps.length > MAPS_PER_ROW) {
      rows.push([]);
      count = 0;
    }
    rows.at(-1)!.push(group);
    // the tiebreaker card is a row of its own
    count = tb ? Infinity : count + group.maps.length;
  }
  return rows;
}

interface MappoolScreenProps {
  from?: string;
  to: string;
}

export function MappoolScreen({ from, to }: MappoolScreenProps) {
  // treat this component as self (to) and other as from
  const anims: AnimTypes = getAnimations(to, from ?? "");

  const slideDirection: 1 | -1 = 1;

  const { red, blue, round } = useEdcCurrentMatch();
  const { groups } = useEdcMappool();
  const [settings] = useSettings();

  const names = { player1: red.name, player2: blue.name };
  const playerName = names[settings.activePlayer];

  const bansPerTeam = round?.bansPerTeam ?? 0;
  const bansDone =
    settings.player1.bans.length >= bansPerTeam &&
    settings.player2.bans.length >= bansPerTeam;
  const action = bansDone ? "Pick" : "Ban";

  let nextPick =
    settings.activePlayer === "player1" ? (
      <span className="next-pick-red">
        Next {action}: {playerName}
      </span>
    ) : (
      <span className="next-pick-blue">
        Next {action}: {playerName}
      </span>
    );

  const hasPickedTb = (picks: string[]) =>
    picks.some((x) => x.toLowerCase().includes("tb"));

  if (hasPickedTb(settings.player1.picks) || hasPickedTb(settings.player2.picks)) {
    nextPick = <span className="next-pick-tb">TIEBREAKER HYPE!!!</span>;
  }

  return (
    <div>
      <div id="main">
        <div className="screen-fade-2">
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
              <div id="mappool">
                <div className="next-pick">
                  <span>MAPPOOL -&nbsp;</span>
                  {nextPick}
                </div>
                {packRows(groups).map((row) => (
                  <div className="mappool-row" key={row[0]!.mod}>
                    {row.map((group) => (
                      <ModGroup
                        key={group.mod}
                        mod={group.mod.toLowerCase()}
                        maps={group.maps}
                        names={names}
                        settings={settings}
                      />
                    ))}
                  </div>
                ))}
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
            <FooterContent>
              <div id="bottom">
                <StageInfo />
                <Chat />
                <Casters />
              </div>
            </FooterContent>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
