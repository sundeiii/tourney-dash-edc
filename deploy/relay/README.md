# Running the relay on a VPS

The relay (`src/relay.ts`) gives other streamers' overlays the qualifier
scores and unreleased pools, using your Centaurea login on their behalf. On the
VPS it listens on localhost only, and Caddy puts HTTPS in front of it.

These steps assume Debian or Ubuntu and that you can `sudo`. Replace
`relay.example.com` with your own (sub)domain everywhere.

## 1. Point a domain at the VPS

Add a DNS **A** record, e.g. `relay.example.com` → your VPS's IP. Caddy needs
it to get the HTTPS certificate.

## 2. Install Bun

```bash
curl -fsSL https://bun.sh/install | sudo env BUN_INSTALL=/usr/local bash
```

Check it with `bun --version`. It should be at `/usr/local/bin/bun`, which is
where the service file looks.

## 3. Check Centaurea answers the VPS

Centaurea sits behind Cloudflare, which sometimes blocks server IPs. Try it
with your cookie before setting anything else up:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "cookie: centaurea_session=YOUR_COOKIE" https://api.centaurea.ee/api/v1/mappools/c6ce03ec-6f22-4a29-9cf6-bfab9e9a6248/full
```

`200` is good. `403` with a Cloudflare page means the VPS is blocked, and
the relay won't work from there.

## 4. Copy the relay over

On the VPS, make a user and folder for it:

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin tourney-relay
sudo mkdir -p /opt/tourney-relay
```

From your PC, in the repo folder, copy the two relay files and the setup
files (replace `you@your-vps`):

```bash
scp src/relay.ts src/centaureaAuth.ts deploy/relay/tourney-relay.service deploy/relay/Caddyfile you@your-vps:/tmp/
```

Back on the VPS:

```bash
sudo mv /tmp/relay.ts /tmp/centaureaAuth.ts /opt/tourney-relay/
```

## 5. Add the secrets

Make a token for the streamers:

```bash
openssl rand -hex 32
```

Create `/opt/tourney-relay/.env` with `sudo nano /opt/tourney-relay/.env`:

```
CENTAUREA_SESSION=your-centaurea_session-cookie
RELAY_TOKEN=the-token-you-just-made
```

Then make it readable by the relay only:

```bash
sudo chown -R tourney-relay:tourney-relay /opt/tourney-relay
sudo chmod 600 /opt/tourney-relay/.env
```

## 6. Start it

```bash
sudo mv /tmp/tourney-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tourney-relay
sudo systemctl status tourney-relay
```

The status should say `active (running)` and log
`Centaurea relay listening on 127.0.0.1:7280`.

## 7. Put HTTPS in front with Caddy

Install Caddy with the commands from
<https://caddyserver.com/docs/install#debian-ubuntu-raspbian>, then:

```bash
sudo nano /tmp/Caddyfile    # put your domain in place of relay.example.com
sudo mv /tmp/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

If you use `ufw`, open the web ports: `sudo ufw allow 80,443/tcp`. Don't open
7280; only Caddy should talk to the relay.

## 8. Test it from your PC

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://relay.example.com/mappools/c6ce03ec-6f22-4a29-9cf6-bfab9e9a6248/full
```

That should be `401` (no token). With the token it should be `200`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "authorization: Bearer THE_TOKEN" https://relay.example.com/mappools/c6ce03ec-6f22-4a29-9cf6-bfab9e9a6248/full
```

## 9. Give streamers the settings

Each streamer puts this in their tourney-dash `.env`, with no
`CENTAUREA_SESSION`:

```
CENTAUREA_RELAY_URL=https://relay.example.com
CENTAUREA_RELAY_TOKEN=the-token
```

Send the token privately, not in a public channel.

## Day to day

- **The cookie expired** (the relay logs `Centaurea said 401`, or overlays
  show results as private again): put a fresh cookie in `.env`, then
  `sudo systemctl restart tourney-relay`.
- **Cut someone off:** change `RELAY_TOKEN`, restart, and send the new token
  to everyone else.
- **Update the relay code:** copy `relay.ts` and `centaureaAuth.ts` again and
  restart.
- **Logs:** `sudo journalctl -u tourney-relay -f`
