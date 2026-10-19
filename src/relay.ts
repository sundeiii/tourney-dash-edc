import { timingSafeEqual } from "node:crypto";
import { CENTAUREA_API, CENTAUREA_AUTHED_PATH } from "./centaureaAuth";

/**
 * Hands the host's private Centaurea data (qualifier scores, unreleased
 * pools) to other streamers' overlays, so they need a relay token instead of
 * a Centaurea login. Separate from the overlay server so putting it online
 * doesn't expose anyone's dashboard.
 *
 *   CENTAUREA_SESSION  the host's "centaurea_session" cookie
 *   RELAY_TOKEN        what streamers put in CENTAUREA_RELAY_TOKEN
 *   RELAY_PORT         defaults to 7280
 *   RELAY_HOST         defaults to 127.0.0.1, for running behind an HTTPS
 *                      proxy like Caddy; 0.0.0.0 serves plain HTTP to anyone
 */

const session = Bun.env.CENTAUREA_SESSION?.trim();
const token = Bun.env.RELAY_TOKEN?.trim();
const port = Number(Bun.env.RELAY_PORT ?? 7280);
const hostname = Bun.env.RELAY_HOST?.trim() || "127.0.0.1";

if (!session || !token) {
  console.error("the relay needs CENTAUREA_SESSION and RELAY_TOKEN in .env");
  process.exit(1);
}
if (token.length < 24) {
  console.error("RELAY_TOKEN is too easy to guess, use at least 24 characters");
  process.exit(1);
}

// every streamer's overlay asks on load and the pools barely change, so
// Centaurea sees one request per path per half minute
const CACHE_TTL = 30_000;
const cache = new Map<string, { at: number; status: number; body: string }>();

const authorized = (req: Request) => {
  const given = Buffer.from(
    req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "",
  );
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

const server = Bun.serve({
  hostname,
  port,
  async fetch(req) {
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!authorized(req)) {
      return new Response("Bad token", { status: 401 });
    }

    const path = new URL(req.url).pathname.replace(/^\//, "");
    if (!CENTAUREA_AUTHED_PATH.test(path)) {
      return new Response("Not relayed", { status: 404 });
    }

    const cached = cache.get(path);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      return new Response(cached.body, {
        status: cached.status,
        headers: { "content-type": "application/json" },
      });
    }

    const upstream = await fetch(`${CENTAUREA_API}/${path}`, {
      headers: {
        accept: "application/json",
        cookie: `centaurea_session=${session}`,
      },
    });
    const body = await upstream.text();

    if (upstream.status === 401) {
      console.error(
        `Centaurea said 401 for ${path}; the session cookie has probably expired`,
      );
    }
    if (upstream.ok) {
      cache.set(path, { at: Date.now(), status: upstream.status, body });
    }

    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  },
});

console.log(`Centaurea relay listening on ${hostname}:${server.port}`);
