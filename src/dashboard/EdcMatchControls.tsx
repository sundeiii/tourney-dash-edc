import clsx from "clsx";
import dayjs from "dayjs";
import { produce } from "immer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDC_EVENTS } from "~/edcEvents";
import type { EdcSettings } from "~/schemas/settings";
import {
  QUALIFIER_SUMMARY,
  useEdcBracket,
  useEdcEntrants,
  useEdcQualifierTeam,
  useEdcSchedule,
  type EdcMatch,
} from "~/state/centaurea";
import { useSettings } from "~/state/dashboard";

type Option = { value: string; label: string };

const EVENT_OPTIONS = EDC_EVENTS.map((e) => ({ value: e.id, label: e.label }));

type DataSelectProps = {
  label: string;
  value: string | null;
  options: Option[];
  placeholder: string;
  onSelect: (value: string) => void;
};

function DataSelect({
  label,
  value,
  options,
  placeholder,
  onSelect,
}: DataSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const current = options.find((o) => o.value === value)?.label ?? placeholder;

  return (
    <div className="tournament-data-row">
      <div className="tournament-data-label">{label}</div>
      <div
        ref={ref}
        className={`tournament-data-select ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{current}</span>
        <div className={`tournament-data-options ${open ? "show" : ""}`}>
          {options.map((option) => (
            <div
              key={option.value}
              className={option.value === value ? "active" : ""}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EdcMatchControls() {
  const [settings, setSettings] = useSettings();
  const { rounds, matches } = useEdcBracket();
  const { entrants } = useEdcEntrants();
  const { upcoming, recent } = useEdcSchedule();

  const loadMatch = useCallback(
    (match: EdcMatch) =>
      setSettings(
        produce((settings) => {
          // a different match starts with a clean mappool
          if (match.id !== settings.edc.matchId) {
            settings.player1 = { bans: [], picks: [] };
            settings.player2 = { bans: [], picks: [] };
            settings.lastPickedBy = null;
            settings.activePlayer = "player1";
          }

          Object.assign(settings.edc, {
            matchId: match.id,
            roundId: match.round.id,
            redEntrantId: match.red?.id ?? null,
            blueEntrantId: match.blue?.id ?? null,
          });

          if (match.date) {
            settings.countdown = match.date;
            if (match.date < Date.now()) {
              settings.showCountdown = false;
            }
          }
        }),
      ),
    [setSettings],
  );

  // a hand-picked round or team no longer describes a bracket match
  const setManually = (patch: Partial<EdcSettings>) =>
    setSettings(
      produce((settings) => {
        Object.assign(settings.edc, patch, { matchId: null });
      }),
    );

  // default to the next upcoming match on startup
  const nextMatch = upcoming[0] ?? recent[0];
  useEffect(() => {
    if (!settings.edc.matchId && !settings.edc.roundId && nextMatch) {
      loadMatch(nextMatch);
    }
  }, [settings.edc.matchId, settings.edc.roundId, nextMatch, loadMatch]);

  const matchOptions = useMemo(
    () =>
      matches
        .filter((m) => m.red || m.blue)
        .map((m) => ({
          value: m.id,
          label: `${m.round.name}: ${m.red?.name ?? "TBD"} vs ${m.blue?.name ?? "TBD"}`,
        })),
    [matches],
  );

  const roundOptions = useMemo(
    () => rounds.map((r) => ({ value: r.id, label: r.label ? `${r.name} (${r.label})` : r.name })),
    [rounds],
  );

  const teamOptions = useMemo(
    () =>
      entrants
        .toSorted((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        )
        .map((e) => ({
          value: e.id,
          label: e.seed ? `#${e.seed} ${e.name}` : e.name,
        })),
    [entrants],
  );

  return (
    <div id="edc-match-controls">
      <DataSelect
        label="Event"
        value={settings.edc.eventId}
        options={EVENT_OPTIONS}
        placeholder="Select"
        onSelect={(eventId) =>
          setSettings(
            produce((settings) => {
              // the old match, round and teams belong to the other event
              settings.edc = {
                eventId,
                matchId: null,
                roundId: null,
                redEntrantId: null,
                blueEntrantId: null,
                qualifierEntrantId: null,
                scheduleExtras: settings.edc.scheduleExtras,
              };
            }),
          )
        }
      />
      <DataSelect
        label="Load match"
        value={settings.edc.matchId}
        options={matchOptions}
        placeholder={matchOptions.length ? "Select" : "No matches drawn yet"}
        onSelect={(id) => {
          const match = matches.find((m) => m.id === id);
          if (match) {
            loadMatch(match);
          }
        }}
      />
      <DataSelect
        label="Round"
        value={settings.edc.roundId}
        options={roundOptions}
        placeholder="Select"
        onSelect={(roundId) => setManually({ roundId })}
      />
      <DataSelect
        label="Red team"
        value={settings.edc.redEntrantId}
        options={teamOptions}
        placeholder="Select"
        onSelect={(redEntrantId) => setManually({ redEntrantId })}
      />
      <DataSelect
        label="Blue team"
        value={settings.edc.blueEntrantId}
        options={teamOptions}
        placeholder="Select"
        onSelect={(blueEntrantId) => setManually({ blueEntrantId })}
      />
    </div>
  );
}

/**
 * Steps the Team Results screen through the qualifier standings: ▶ goes up
 * towards #1 and then the summary of every team, as a results reveal does,
 * ◀ back down. Only shown while that screen is on.
 */
export function EdcQualifierControls() {
  const [settings, setSettings] = useSettings();
  const { standings, summary, index } = useEdcQualifierTeam();

  if (settings.activeScreen !== "qualteam") {
    return null;
  }

  // the reveal from its end: the summary, #1, #2, ... last place
  const steps: Option[] = standings.length
    ? [
        { value: QUALIFIER_SUMMARY, label: "Summary (every team)" },
        ...standings.map((s) => ({
          value: s.entrantId,
          label: `#${s.rank} ${s.entrant?.name ?? "???"}`,
        })),
      ]
    : [];
  const current = summary ? 0 : index + 1;
  const up = steps[current - 1];
  const down = steps[current + 1];

  const show = (value: string) =>
    setSettings(
      produce((settings) => {
        settings.edc.qualifierEntrantId = value;
      }),
    );

  return (
    <div id="edc-qualifier-controls">
      <DataSelect
        label="Team"
        value={steps[current]?.value ?? null}
        options={steps}
        placeholder={steps.length ? "Select" : "No qualifier results"}
        onSelect={show}
      />
      <div className="switcher-select qualifier-steps">
        <button
          className="switcher-option"
          disabled={!down}
          onClick={() => down && show(down.value)}
        >
          ◀ {down?.label ?? "last place"}
        </button>
        <button
          className="switcher-option"
          disabled={!up}
          onClick={() => up && show(up.value)}
        >
          {up?.label ?? "the end"} ▶
        </button>
      </div>
    </div>
  );
}

/**
 * Stream events Centaurea's schedule doesn't have, like a mappool showcase.
 * Typed in the PC's own time like the countdown; the overlay shows them in
 * Estonian time with the matches. Adding one points the countdown at it.
 */
export function EdcScheduleExtras() {
  const [settings, setSettings] = useSettings();
  const [title, setTitle] = useState("Mappool showcase");
  const [when, setWhen] = useState("");

  const extras = settings.edc.scheduleExtras.toSorted((a, b) => a.date - b.date);
  const date = when ? dayjs(when).valueOf() : NaN;
  const canAdd = title.trim() !== "" && Number.isFinite(date);

  const add = () => {
    if (!canAdd) {
      return;
    }
    setSettings(
      produce((settings) => {
        settings.edc.scheduleExtras.push({
          id: crypto.randomUUID(),
          title: title.trim(),
          date,
        });
        if (date > Date.now()) {
          settings.countdown = date;
        }
      }),
    );
    setWhen("");
  };

  const countTo = (date: number) =>
    setSettings(
      produce((settings) => {
        settings.countdown = date;
        settings.showCountdown = true;
      }),
    );

  const remove = (id: string) =>
    setSettings(
      produce((settings) => {
        settings.edc.scheduleExtras = settings.edc.scheduleExtras.filter(
          (extra) => extra.id !== id,
        );
      }),
    );

  return (
    <div id="schedule-extras">
      <div className="section-title">Schedule Extras</div>
      {extras.map((extra) => (
        <div className="schedule-extra" key={extra.id}>
          <span className="schedule-extra-title">{extra.title}</span>
          <span className="schedule-extra-date">
            {dayjs(extra.date).format("ddd D MMM HH:mm")}
            {extra.date < Date.now() && " (over)"}
          </span>
          {extra.date > Date.now() && (
            <button
              className={clsx(
                "schedule-extra-remove",
                settings.countdown === extra.date && "counting",
              )}
              title="Count down to this"
              onClick={() => countTo(extra.date)}
            >
              ⏱
            </button>
          )}
          <button className="schedule-extra-remove" onClick={() => remove(extra.id)}>
            ✕
          </button>
        </div>
      ))}
      <div id="schedule-extra-form">
        <input
          className="schedule-extra-input"
          value={title}
          placeholder="Name"
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="schedule-extra-input"
          type="datetime-local"
          title="Your PC's time, like the countdown"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <button className="switcher-option" disabled={!canAdd} onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}
