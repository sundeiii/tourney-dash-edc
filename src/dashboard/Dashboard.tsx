import dayjs from "dayjs";
import { produce } from "immer";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Match } from "~/schemas/huis";
import { screenNames, type ScreenName } from "~/schemas/screens";
import { useEdcMappool } from "~/state/centaurea";
import { useSettings } from "~/state/dashboard";
import {
  useMappoolQuery,
  useMatchesQuery,
  useScheduleQuery,
} from "~/state/huis";
import { useTosu } from "~/state/tosu";
import { motion } from "motion/react";
import {
  EdcMatchControls,
  EdcQualifierControls,
  EdcScheduleExtras,
} from "./EdcMatchControls";

const SCENE_LABELS: Record<ScreenName, string> = {
  startingsoon: "Starting Soon",
  start: "Start",
  standby: "Standby",
  playerinfo: "Player Info",
  versus: "Versus",
  scheduling: "Scheduling",
  mappool: "Mappool",
  showcase: "Mappool Reveal",
  qualresults: "Qualifier Results",
  qualteam: "Team Results",
  winnersbracket: "Winners Bracket",
  losersbracket: "Losers Bracket",
  winner: "Winner",
  brb: "Be Right Back",
  technical: "Technical Issues",
  ending: "Ending",
};

// non-match streams (pool reveals, qualifier results) vs match days, plus
// the holding screens either kind of stream can need
const SCENE_GROUPS = [
  { key: "stream", title: "Stream & Reveals" },
  { key: "match", title: "Match" },
  { key: "break", title: "Breaks" },
] as const;

const SCENE_GROUP: Record<
  ScreenName,
  (typeof SCENE_GROUPS)[number]["key"]
> = {
  startingsoon: "stream",
  showcase: "stream",
  qualresults: "stream",
  qualteam: "stream",
  ending: "stream",
  brb: "break",
  technical: "break",
  start: "match",
  standby: "match",
  playerinfo: "match",
  versus: "match",
  scheduling: "match",
  mappool: "match",
  winnersbracket: "match",
  losersbracket: "match",
  winner: "match",
};

export function Dashboard() {
  const [settings] = useSettings();

  return settings.graphicsStyle === "EDC 2026" ? (
    <EdcDashboard />
  ) : (
    <HuisDashboard />
  );
}

function EdcDashboard() {
  const { groups } = useEdcMappool();
  const mappoolOptions = useMemo(
    () => groups.flatMap((g) => g.maps.map((m) => m.code)),
    [groups],
  );

  return (
    <DashboardView
      mappoolOptions={mappoolOptions}
      matchSelect={<EdcMatchControls />}
      sceneControls={<EdcQualifierControls />}
      scheduleControls={<EdcScheduleExtras />}
    />
  );
}

function HuisDashboard() {
  const { beatmaps } = useMappoolQuery();
  const mappoolOptions = useMemo(
    () =>
      Object.values(beatmaps)
        .flat()
        .map((map) => `${map.modBracket}${map.modBracketIndex}`),
    [beatmaps],
  );

  return (
    <DashboardView
      mappoolOptions={mappoolOptions}
      matchSelect={<HuisMatchSelect />}
      showTournamentId
    />
  );
}

function HuisMatchSelect() {
  const { matches } = useMatchesQuery();
  const schedule = useScheduleQuery();
  const [settings, setSettings] = useSettings();

  // default to the next upcoming match on startup
  useEffect(() => {
    const nextMatch = schedule.upcoming[0] ?? schedule.recent[0];
    if (!settings.matchId && nextMatch) {
      setSettings(
        produce((settings) => {
          settings.matchId = nextMatch.uid;
          settings.countdown = nextMatch.date;
        }),
      );
    }
  }, [settings.matchId, setSettings, schedule]);

  const selectedMatch = useMemo(() => {
    const match = matches?.find((m) => m.uid === settings.matchId);
    return match
      ? `${match.uid} ${match.player1.name} - ${match.player2.name}`
      : "Select";
  }, [matches, settings.matchId]);

  const setSelectedMatch = (match: Match) =>
    setSettings(
      produce((settings) => {
        settings.matchId = match.uid;
        settings.countdown = match.date;

        if (match.date && match.date < Date.now()) {
          settings.showCountdown = false;
        }
      }),
    );

  const [matchIsOpen, setMatchOpen] = useState(false);
  const matchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        matchDropdownRef.current &&
        !matchDropdownRef.current.contains(e.target as Node)
      )
        setMatchOpen(false);
    };

    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div id="match-select">
      <div id="match-select-id" ref={matchDropdownRef}>
        <div id="match-select-id-text">Select a match:</div>
        <div
          id="match-select-id-input"
          className={matchIsOpen ? "open" : ""}
          onClick={() => setMatchOpen(!matchIsOpen)}
        >
          {selectedMatch}
        </div>
        <div
          className={`match-select-dropdown-options ${matchIsOpen ? "show" : ""}`}
        >
          {matches?.map((match) => (
            <div
              key={match.uid}
              onClick={() => {
                setSelectedMatch(match);
                setMatchOpen(false);
              }}
            >
              {`${match.uid} ${match.player1.name} - ${match.player2.name}`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type DashboardViewProps = {
  mappoolOptions: string[];
  matchSelect: ReactNode;
  // controls for whichever scene is on, under the scene switcher
  sceneControls?: ReactNode;
  // under the countdown, for events that aren't matches
  scheduleControls?: ReactNode;
  showTournamentId?: boolean;
};

function DashboardView({
  mappoolOptions,
  matchSelect,
  sceneControls,
  scheduleControls,
  showTournamentId = false,
}: DashboardViewProps) {
  const {
    tourney: { chat },
  } = useTosu();
  const [settings, setSettings] = useSettings();

  const graphicsStyles = ["EDC 2026", "NDC 2026", "NDC 2025"] as const;
  const tournamentOptions = ["36", "31"] as const;

  const [graphicsStyleOpen, setGraphicsStyleOpen] = useState(false);
  const [tournamentIdOpen, setTournamentIdOpen] = useState(false);
  const graphicsStyleRef = useRef<HTMLDivElement>(null);
  const tournamentIdRef = useRef<HTMLDivElement>(null);

  const countdownDate = dayjs(settings.countdown).format("HH:mm");

  const setSelectedScreen = (screen: ScreenName) =>
    setSettings(
      produce((settings) => {
        if (settings.countdown && settings.countdown < Date.now()) {
          settings.showCountdown = false;
        }

        // a results reveal starts over from last place each time it comes on
        if (screen === "qualteam" && settings.activeScreen !== "qualteam") {
          settings.edc.qualifierEntrantId = null;
        }

        settings.activeScreen = screen;
        settings.previousScreen = settings.activeScreen;
      }),
    );

  const setActivePlayer = (player: "player1" | "player2") =>
    setSettings(
      produce((settings) => {
        settings.activePlayer = player;
      }),
    );

  // Bans & Picks dropdown
  const [bansSelection, setBansSelection] = useState("Select");
  const [bansOpen, setBansOpen] = useState(false);
  const [picksSelection, setPicksSelection] = useState("Select");
  const [picksOpen, setPicksOpen] = useState(false);
  const bansDropdownRef = useRef<HTMLDivElement>(null);
  const picksDropdownRef = useRef<HTMLDivElement>(null);

  const handleConfirm = (pickOrBan: "bans" | "picks") => {
    const map = pickOrBan === "bans" ? bansSelection : picksSelection;
    if (!mappoolOptions.includes(map)) {
      return;
    }

    setSettings(
      produce((settings) => {
        const selection = settings[settings.activePlayer];
        if (!selection[pickOrBan].includes(map)) {
          // remove from all selections first
          for (const player of ["player1", "player2"] as const) {
            for (const type of ["bans", "picks"] as const) {
              settings[player][type] = settings[player][type].filter(
                (m) => m !== map,
              );
            }
          }

          selection[pickOrBan].push(map);
        } else {
          selection[pickOrBan] = selection[pickOrBan].filter((m) => m !== map);
        }

        // bans must not mark the current map as picked by anyone
        if (pickOrBan === "picks") {
          settings.lastPickedBy = map.includes("TB")
            ? null
            : settings.activePlayer;
        }
        settings.activePlayer =
          settings.activePlayer === "player1" ? "player2" : "player1";
      }),
    );

    if (pickOrBan === "picks") {
      setPicksSelection("Confirmed!");
    } else {
      setBansSelection("Confirmed!");
    }
  };

  const lastMessage = chat.at(-1)?.message;
  const lastMentionedMap = useRef<string>(null);

  useEffect(() => {
    if (mappoolOptions.length === 0) {
      return;
    }

    const map = lastMessage?.match(
      new RegExp(mappoolOptions.join("|"), "i"),
    )?.[0];

    if (map && lastMentionedMap.current !== map) {
      lastMentionedMap.current = map;
      setPicksSelection(map.toUpperCase());
      setBansSelection(map.toUpperCase());
    }
  }, [lastMessage, mappoolOptions]);

  const handleCountdownDateChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    let parsedTime = dayjs(e.target.value, "HH:mm");
    const now = dayjs();
    if (parsedTime.isBefore(now)) {
      parsedTime = parsedTime.add(1, "day");
    }

    setSettings(
      produce((settings) => {
        settings.countdown = parsedTime.valueOf();
      }),
    );
  };

  const setCountdownVisibility = (value: boolean) =>
    setSettings(
      produce((settings) => {
        settings.showCountdown = value;
      }),
    );

  const setGraphicsStyle = (value: "EDC 2026" | "NDC 2026" | "NDC 2025") =>
    setSettings(
      produce((settings) => {
        settings.graphicsStyle = value;
      }),
    );

  const setTournamentId = (value: "36" | "31") =>
    setSettings(
      produce((settings) => {
        settings.tournamentId = value;
      }),
    );

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        bansDropdownRef.current &&
        !bansDropdownRef.current.contains(e.target as Node)
      )
        setBansOpen(false);

      if (
        picksDropdownRef.current &&
        !picksDropdownRef.current.contains(e.target as Node)
      )
        setPicksOpen(false);

      if (
        graphicsStyleRef.current &&
        !graphicsStyleRef.current.contains(e.target as Node)
      )
        setGraphicsStyleOpen(false);

      if (
        tournamentIdRef.current &&
        !tournamentIdRef.current.contains(e.target as Node)
      )
        setTournamentIdOpen(false);
    };

    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const BannedOrPicked = useCallback(
    ({ map }: { map: string }) => {
      if (settings.player1.picks.includes(map)) {
        return (
          <>
            {map}
            <span style={{ color: "#dc1f2b" }}> picked</span>
          </>
        );
      }

      if (settings.player2.picks.includes(map)) {
        return (
          <>
            {map}
            <span style={{ color: "#2f6bff" }}> picked</span>
          </>
        );
      }

      if (settings.player1.bans.includes(map)) {
        return (
          <>
            <s>{map}</s>
            <span style={{ color: "#dc1f2b" }}> banned</span>
          </>
        );
      }

      if (settings.player2.bans.includes(map)) {
        return (
          <>
            <s>{map}</s>
            <span style={{ color: "#2f6bff" }}> banned</span>
          </>
        );
      }

      return map;
    },
    [
      JSON.stringify([
        settings.player1.picks,
        settings.player1.bans,
        settings.player2.picks,
        settings.player2.bans,
      ]),
    ],
  );

  return (
    <div id="main">
      <div id="title">tourney!dash</div>
      {matchSelect}
      <div className="divider"></div>
      {/* Scene Switcher */}
      <div id="scene-switcher">
        <div className="section-title">Scene Switcher</div>
        {SCENE_GROUPS.map((group) => (
          <div key={group.title} className="switcher-group">
            <div className="switcher-group-title">{group.title}</div>
            <div className="switcher-select">
              {screenNames
                .filter((scene) => SCENE_GROUP[scene] === group.key)
                .map((scene) => (
                  <button
                    key={scene}
                    className={`switcher-option ${settings.activeScreen === scene ? "selected" : ""}`}
                    onClick={() => setSelectedScreen(scene)}
                  >
                    {SCENE_LABELS[scene]}
                  </button>
                ))}
            </div>
          </div>
        ))}
        {sceneControls}
      </div>
      <div className="divider"></div>

      <motion.div key="mappool-controls">
        <div className="section-title">Mappool Controls</div>

        <div id="player-select">
          <button
            id="red-input"
            className={settings.activePlayer === "player1" ? "red active" : "red"}
            onClick={() => setActivePlayer("player1")}
          >
            Red Input
          </button>
          <button
            id="blue-input"
            className={settings.activePlayer === "player2" ? "blue active" : "blue"}
            onClick={() => setActivePlayer("player2")}
          >
            Blue Input
          </button>
        </div>

        <div id="mappool-select">
          <div id="bans" ref={bansDropdownRef}>
            <div id="bans-text">Ban/Unban</div>
            <div
              id="ban-select-id-input"
              className={bansOpen ? "open" : ""}
              onClick={() => setBansOpen(!bansOpen)}
            >
              {bansSelection}
            </div>
            <div
              className={`ban-select-dropdown-options ${bansOpen ? "show" : ""}`}
            >
              {mappoolOptions.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    setBansSelection(opt);
                    setBansOpen(false);
                  }}
                >
                  <BannedOrPicked map={opt} />
                </div>
              ))}
            </div>
            <button id="bans-confirm" onClick={() => handleConfirm("bans")}>
              Confirm
            </button>
          </div>

          <div id="picks" ref={picksDropdownRef}>
            <div id="picks-text">Pick/Unpick</div>
            <div
              id="pick-select-id-input"
              className={picksOpen ? "open" : ""}
              onClick={() => setPicksOpen(!picksOpen)}
            >
              {picksSelection}
            </div>
            <div
              className={`pick-select-dropdown-options ${picksOpen ? "show" : ""}`}
            >
              {mappoolOptions.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    setPicksSelection(opt);
                    setPicksOpen(false);
                  }}
                >
                  <BannedOrPicked map={opt} />
                </div>
              ))}
            </div>
            <button id="picks-confirm" onClick={() => handleConfirm("picks")}>
              Confirm
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div key="countdown-section">
        <div className="divider"></div>

        {/* Countdown */}
        <div id="countdown">
          <div className="section-title">Countdown</div>
          <div id="countdown-controls">
            <input
              id="countdown-input"
              type="time"
              value={countdownDate}
              onChange={handleCountdownDateChange}
              step={60}
            />
            <div className="checkbox-input">
              <label htmlFor="show-countdown">Show countdown</label>
              <input
                name="show-countdown"
                id="show-countdown"
                type="checkbox"
                checked={settings.showCountdown}
                onChange={(e) => setCountdownVisibility(e.target.checked)}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {scheduleControls && (
        <>
          <div className="divider"></div>
          {scheduleControls}
        </>
      )}

      <div className="divider"></div>
      <div id="tournament-data">
        <div className="section-title">Tournament Data</div>

        <div className="tournament-data-row">
          <div className="tournament-data-label">Graphics Style</div>
          <div
            ref={graphicsStyleRef}
            className={`tournament-data-select ${graphicsStyleOpen ? "open" : ""}`}
            onClick={() => setGraphicsStyleOpen((open) => !open)}
          >
            <span>{settings.graphicsStyle}</span>
            <div
              className={`tournament-data-options ${graphicsStyleOpen ? "show" : ""}`}
            >
              {graphicsStyles.map((style) => (
                <div
                  key={style}
                  className={settings.graphicsStyle === style ? "active" : ""}
                  onClick={(e) => {
                    e.stopPropagation();
                    setGraphicsStyle(style);
                    setGraphicsStyleOpen(false);
                  }}
                >
                  {style}
                </div>
              ))}
            </div>
          </div>
        </div>

        {showTournamentId && (
          <div className="tournament-data-row">
            <div className="tournament-data-label">Tournament ID</div>
            <div
              ref={tournamentIdRef}
              className={`tournament-data-select ${tournamentIdOpen ? "open" : ""}`}
              onClick={() => setTournamentIdOpen((open) => !open)}
            >
              <span>{settings.tournamentId}</span>
              <div
                className={`tournament-data-options ${tournamentIdOpen ? "show" : ""}`}
              >
                {tournamentOptions.map((id) => (
                  <div
                    key={id}
                    className={settings.tournamentId === id ? "active" : ""}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTournamentId(id);
                      setTournamentIdOpen(false);
                    }}
                  >
                    {id}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
