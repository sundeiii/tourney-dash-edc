import { produce } from "immer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EdcSettings } from "~/schemas/settings";
import {
  useEdcBracket,
  useEdcEntrants,
  useEdcSchedule,
  type EdcMatch,
} from "~/state/centaurea";
import { useSettings } from "~/state/dashboard";

type Option = { value: string; label: string };

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
          settings.edc = {
            matchId: match.id,
            roundId: match.round.id,
            redEntrantId: match.red?.id ?? null,
            blueEntrantId: match.blue?.id ?? null,
          };

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
    () => rounds.map((r) => ({ value: r.id, label: `${r.name} (${r.label})` })),
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
