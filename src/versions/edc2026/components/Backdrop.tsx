import clsx from "clsx";
import { useEffect } from "react";
import type { ScreenName } from "~/schemas/screens";
import blank from "../static/img/edc/blank.png";
import gameplay from "../static/img/edc/gameplay-chat.png";
import mappool from "../static/img/edc/mappool.png";
import seedings from "../static/img/edc/seedings.png";
import showcase from "../static/img/edc/showcase.png";
import { GAMEPLAY_AREA, SHOWCASE_AREA } from "../screens/defs";
import { GameplaySvgMask } from "./GameplayTransparencyMask";

type Layer = "blank" | "mappool" | "seedings" | "gameplay" | "showcase";

const LAYER_FOR_SCREEN: Record<ScreenName, Layer> = {
  start: "blank",
  winner: "blank",
  playerinfo: "blank",
  mappool: "mappool",
  scheduling: "seedings",
  winnersbracket: "seedings",
  losersbracket: "seedings",
  startingsoon: "seedings",
  ending: "seedings",
  qualresults: "seedings",
  qualteam: "seedings",
  brb: "seedings",
  technical: "seedings",
  standby: "gameplay",
  versus: "gameplay",
  showcase: "showcase",
};

const IMAGE_LAYERS = [
  ["blank", blank],
  ["mappool", mappool],
  ["seedings", seedings],
] as const;

const CUTOUT_LAYERS = [
  ["gameplay", gameplay, GAMEPLAY_AREA],
  ["showcase", showcase, SHOWCASE_AREA],
] as const;

export function Backdrop({ screen }: { screen: ScreenName }) {
  const active = LAYER_FOR_SCREEN[screen];

  // decode up front so a layer's first reveal never paints blank
  useEffect(() => {
    for (const src of [blank, mappool, seedings, gameplay, showcase]) {
      const img = new Image();
      img.src = src;
      img.decode().catch(() => {});
    }
  }, []);

  return (
    <div className="edc-backdrop">
      {IMAGE_LAYERS.map(([name, src]) => (
        <img
          key={name}
          src={src}
          className={clsx("edc-backdrop-layer", active === name && "active")}
        />
      ))}
      {CUTOUT_LAYERS.map(([name, src, area]) => (
        <div
          key={name}
          className={clsx("edc-backdrop-layer", active === name && "active")}
        >
          <GameplaySvgMask image={src} area={area} maskId={`${name}-cutout`} />
        </div>
      ))}
    </div>
  );
}
