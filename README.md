# tourney!dash

A (work-in-progress) multipurpose streaming overlay for osu! tournaments.

Currently used by [NDC](https://ndc.huismetbenen.nl) and [PNK](https://pnk.huismetbenen.nl).

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

To build as a single file app:

```bash
bun build
```

## Private qualifier scores and mappools

Centaurea only shows qualifier scores to the public once the event's results
visibility is "full", and mappools once they're released. To show them on the
overlay before that, put the host's
session cookie (DevTools > Network > any api.centaurea.ee request > Request
Cookies > `centaurea_session`) in a `.env` file next to the app:

```
CENTAUREA_SESSION=paste-the-cookie-here
```

It's only sent with qualifier score and mappool requests. The cookie expires, so refresh it
if the results go back to showing as private or a new pool doesn't appear.

## Relay for other streamers

Streamers without a Centaurea staff login get the private qualifier scores
and unreleased pools from the host's relay at `https://relay.sundei.eu`. The
overlay uses it automatically when there's no `CENTAUREA_SESSION`, so
streamers need no `.env` and no setup.

That means anyone who finds the relay can read the qualifier scores and
unreleased pools early. The staff list and player profiles (used by the
Discord reminder bot) still need the relay's token.

The host runs the relay next to their own `.env` with `CENTAUREA_SESSION` in
it, plus a long random token for the bot:

```
RELAY_TOKEN=make-this-long-and-random
RELAY_PORT=7280
```

```bash
bun run relay
```

The relay only answers the qualifier scores, mappool, match staff and profile
paths. It's separate from the overlay, so putting it online doesn't expose
your dashboard. Put it behind HTTPS, for example with a tunnel. See
[deploy/relay](deploy/relay/README.md) for running it on a VPS.

To point an overlay at a different relay, set `CENTAUREA_RELAY_URL` in its
`.env`.
