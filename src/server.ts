import type { HTMLBundle } from "bun";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "util";
import dashboard from "./dashboard/dashboard.html";
import index from "./index.html";
import {
  dashboardMessageSchema,
  type DashboardMessage,
} from "./schemas/settings";
import { isProduction } from "./util";

const CENTAUREA_API = "https://api.centaurea.ee/api/v1";

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

        const upstream = await fetch(`${CENTAUREA_API}/${path}${url.search}`, {
          headers: { accept: "application/json" },
        });

        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "content-type":
              upstream.headers.get("content-type") ?? "application/json",
          },
        });
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
