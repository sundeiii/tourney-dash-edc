import type { HTMLBundle } from "bun";
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "util";
import dashboard from "./dashboard/dashboard.html";
import index from "./index.html";
import type { OsuMatch } from "./schemas/osuMatch";
import {
  dashboardMessageSchema,
  type DashboardMessage,
} from "./schemas/settings";
import { CENTAUREA_API, CENTAUREA_AUTHED_PATH } from "./centaureaAuth";
import { isProduction } from "./util";

// the host's "centaurea_session" cookie, from .env, so the overlay can read
// qualifier scores and mappools before they're public. Other streamers set
// a relay instead (src/relay.ts), which asks with the host's cookie for them
const CENTAUREA_SESSION = Bun.env.CENTAUREA_SESSION?.trim();
const CENTAUREA_RELAY_URL = Bun.env.CENTAUREA_RELAY_URL?.trim().replace(/\/$/, "");
const CENTAUREA_RELAY_TOKEN = Bun.env.CENTAUREA_RELAY_TOKEN?.trim();

// osu-web serves match and room pages as JSON to its own live view, no API
// key needed
const OSU_JSON_HEADERS = {
  accept: "application/json",
  "x-requested-with": "XMLHttpRequest",
};

type OsuGameJson = {
  beatmap_id: number | null;
  end_time: string | null;
  scores: { user_id: number; total_score: number }[];
};

/** osu! throttled us or is down; worth asking again later, unlike a 404 */
class OsuUnavailableError extends Error {}

// osu-web throttles bursts, and an event's lobbies all load at once, so only
// a couple of requests go out at a time
const OSU_CONCURRENCY = 2;
let osuActive = 0;
const osuWaiting: (() => void)[] = [];

async function fetchOsuJson<T>(url: string): Promise<T | null> {
  if (osuActive >= OSU_CONCURRENCY) {
    // a finishing request hands its slot straight over
    await new Promise<void>((resolve) => osuWaiting.push(resolve));
  } else {
    osuActive++;
  }

  try {
    const response = await fetch(url, { headers: OSU_JSON_HEADERS });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new OsuUnavailableError(`${response.status} from ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    const next = osuWaiting.shift();
    if (next) {
      next();
    } else {
      osuActive--;
    }
  }
}

async function fetchStableMatch(id: string): Promise<OsuMatch | null> {
  const games: OsuMatch["games"] = [];
  let after = 0;

  // events come 100 at a time, oldest first
  for (;;) {
    const page = await fetchOsuJson<{
      latest_event_id: number;
      events: { id: number; game?: OsuGameJson }[];
    }>(`https://osu.ppy.sh/community/matches/${id}?after=${after}&limit=100`);
    if (!page) {
      return null;
    }
    for (const { game } of page.events) {
      // an aborted or still-running game has no final scores
      if (game?.end_time && game.scores.length > 0) {
        games.push({
          beatmapId: game.beatmap_id ?? 0,
          scores: game.scores.map((s) => ({
            userId: s.user_id,
            score: s.total_score,
          })),
        });
      }
    }

    const last = page.events.at(-1)?.id;
    if (!last || last >= page.latest_event_id) {
      return { games };
    }
    after = last;
  }
}

async function fetchLazerRoom(id: string): Promise<OsuMatch | null> {
  const room = await fetchOsuJson<{
    playlist_items: {
      beatmap_id: number;
      scores?: { user_id: number; total_score: number }[];
    }[];
  }>(`https://osu.ppy.sh/multiplayer/rooms/${id}/events`);
  if (!room) {
    return null;
  }

  return {
    games: room.playlist_items
      .filter((item) => item.scores?.length)
      .map((item) => ({
        beatmapId: item.beatmap_id,
        scores: item.scores!.map((s) => ({
          userId: s.user_id,
          score: s.total_score,
        })),
      })),
  };
}

// lazer room ids are still in the millions while stable match ids passed 100
// million years ago, so try the likelier kind first; the other is a fallback
const LAZER_ROOM_ID_LIMIT = 50_000_000;

async function fetchOsuMatch(id: string) {
  const [first, second] =
    Number(id) < LAZER_ROOM_ID_LIMIT
      ? [fetchLazerRoom, fetchStableMatch]
      : [fetchStableMatch, fetchLazerRoom];
  return (await first(id)) ?? (await second(id));
}

// a played lobby doesn't change, so don't ask osu! again on every reload
const osuMatchCache = new Map<string, { at: number; match: OsuMatch }>();
const OSU_MATCH_TTL = 60_000;

const args = parseArgs({
  args: process.argv,
  options: {
    help: {
      type: "boolean",
      short: "h",
    },
    host: {
      type: "string",
      // only localhost is whitelisted for the huismetbenen API (CORS) right now
      default: "localhost",
    },
    port: {
      type: "string",
      default: "7270",
      short: "p",
    },
  },
  strict: true,
  allowPositionals: true,
}).values;

if (args.help) {
  console.log(`tourney-dash [--host localhost] [-p|--port 7270]`);
  process.exit();
}

async function overrideHtmlEtags(htmlFiles: HTMLBundle[], value: string) {
  htmlFiles.forEach((htmlFile) =>
    htmlFile.files?.forEach((file) => {
      if (file.loader === "html") {
        file.headers.etag = value;
      }
    }),
  );
}

async function run() {
  let lastMessage: DashboardMessage | null = null;

  // Bun.build does not seem to change the etag header on changing the hash part
  // of asset filenames because the content of the original HTML file didn't
  // change, leading to 404s, so instead we inject our own at build time
  if (typeof BUILD_TIME_ETAG !== "undefined") {
    await overrideHtmlEtags([index, dashboard], BUILD_TIME_ETAG);
  }

  return Bun.serve({
    hostname: args.host,
    port: args.port,
    routes: {
      "/dashboard": dashboard,
      "/ws": (req, server) => {
        if (server.upgrade(req)) {
          return;
        }
        return new Response("Upgrade failed", { status: 400 });
      },
      // mappools that aren't released on Centaurea yet, from JSON files in pools/
      "/local-pools": async () => {
        const dir = isProduction
          ? join(dirname(process.execPath), "pools")
          : fileURLToPath(new URL("../pools", import.meta.url));

        const pools: unknown[] = [];
        for (const name of await readdir(dir).catch(() => [])) {
          if (!name.endsWith(".json")) {
            continue;
          }
          try {
            pools.push(JSON.parse(await Bun.file(join(dir, name)).text()));
          } catch (e) {
            console.error(`skipping pools/${name}:`, e);
          }
        }

        return Response.json(pools);
      },
      "/versions/*": (req) => {
        const pathname = new URL(req.url).pathname;
        const relativePath = pathname.replace(/^\/versions\//, "");
        const versionsPath = isProduction
          ? join(dirname(process.execPath), "versions")
          : fileURLToPath(new URL("./versions", import.meta.url));
        const file = Bun.file(join(versionsPath, relativePath));

        if (!file.exists()) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(file);
      },
      // Centaurea only allows its own origin via CORS, so the overlay goes through us
      "/centaurea/*": async (req) => {
        if (req.method !== "GET") {
          return new Response("Method not allowed", { status: 405 });
        }

        const url = new URL(req.url);
        const path = url.pathname.replace(/^\/centaurea\//, "");
        if (!/^[\w-]+(\/[\w-]+)*$/.test(path)) {
          return new Response("Bad path", { status: 400 });
        }

        const authed = CENTAUREA_AUTHED_PATH.test(path);
        const headers: Record<string, string> = { accept: "application/json" };
        let target = `${CENTAUREA_API}/${path}${url.search}`;
        if (authed && CENTAUREA_SESSION) {
          headers.cookie = `centaurea_session=${CENTAUREA_SESSION}`;
        } else if (authed && CENTAUREA_RELAY_URL && CENTAUREA_RELAY_TOKEN) {
          headers.authorization = `Bearer ${CENTAUREA_RELAY_TOKEN}`;
          target = `${CENTAUREA_RELAY_URL}/${path}`;
        }

        let upstream: Response;
        try {
          upstream = await fetch(target, { headers });
        } catch (e) {
          console.error(`couldn't reach ${new URL(target).host}:`, e);
          return new Response("Upstream unreachable", { status: 502 });
        }

        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "content-type":
              upstream.headers.get("content-type") ?? "application/json",
          },
        });
      },
      // a qualifier lobby's per-player scores; Centaurea only keeps team totals.
      // Centaurea's lobby ids can be stable matches or lazer rooms
      "/osu-match/:id": async (req) => {
        const { id } = req.params;
        if (!/^\d+$/.test(id)) {
          return new Response("Bad id", { status: 400 });
        }

        const cached = osuMatchCache.get(id);
        if (cached && Date.now() - cached.at < OSU_MATCH_TTL) {
          return Response.json(cached.match);
        }

        let match: OsuMatch | null;
        try {
          match = await fetchOsuMatch(id);
        } catch (e) {
          if (e instanceof OsuUnavailableError) {
            console.error(`osu! match ${id}:`, e.message);
            return new Response("osu! is unavailable, try again", { status: 503 });
          }
          throw e;
        }
        if (!match) {
          return new Response("No such match or room", { status: 404 });
        }

        osuMatchCache.set(id, { at: Date.now(), match });
        return Response.json(match);
      },
      "/favicon.ico": () => new Response(null, { status: 204 }),
      "/": index,
    },
    websocket: {
      open(ws) {
        console.log(`client has connected`);
        ws.subscribe("settings");

        if (typeof GIT_COMMIT !== "undefined") {
          ws.send(
            JSON.stringify({
              type: "HELLO",
              gitCommit: GIT_COMMIT,
            } satisfies DashboardMessage),
          );
        }

        if (lastMessage) {
          ws.send(JSON.stringify(lastMessage satisfies DashboardMessage));
        }
      },
      close(ws) {
        console.log(`client has disconnected`);
        ws.unsubscribe("settings");
      },
      message(ws, message) {
        try {
          const parsedMessage = dashboardMessageSchema.parse(
            JSON.parse(message.toString()),
          );
          ws.publish("settings", JSON.stringify(parsedMessage));
          lastMessage = parsedMessage;
        } catch (e) {
          console.error(
            "failed to forward settings sent by either overlay or dashboard:",
            e,
          );
        }
      },
      idleTimeout: 30,
    },
    development: !isProduction && {
      hmr: true,
      console: true,
    },
  });
}

export const Server = { run };
