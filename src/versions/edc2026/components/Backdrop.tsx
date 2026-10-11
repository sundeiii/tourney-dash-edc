import clsx from "clsx";
import { useEffect } from "react";
import type { ScreenName } from "~/schemas/screens";
import blank from "../static/img/edc/blank.png";
import gameplay from "../static/img/edc/gameplay-chat.png";
import mappool from "../static/img/edc/mappool.png";
import seedings from "../static/img/edc/seedings.png";
import { GAMEPLAY_AREA } from "../screens/defs";
import { GameplaySvgMask } from "./GameplayTransparencyMask";

type Layer = "blank" | "mappool" | "seedings" | "gameplay";

const LAYER_FOR_SCREEN: Record<ScreenName, Layer> = {
  start: "blank",
  winner: "blank",
  playerinfo: "blank",
  mappool: "mappool",
  scheduling: "seedings",
  winnersbracket: "seedings",
  losersbracket: "seedings",
  standby: "gameplay",
  versus: "gameplay",
};

const IMAGE_LAYERS = [
  ["blank", blank],
  ["mappool", mappool],
  ["seedings", seedings],
] as const;

export function Backdrop({ screen }: { screen: ScreenName }) {
  const active = LAYER_FOR_SCREEN[screen];

  // decode up front so a layer's first reveal never paints blank
  useEffect(() => {
    for (const src of [blank, mappool, seedings, gameplay]) {
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
      <div
        className={clsx(
          "edc-backdrop-layer",
          active === "gameplay" && "active",
        )}
      >
        <GameplaySvgMask area={GAMEPLAY_AREA} />
      </div>
    </div>
  );
}
