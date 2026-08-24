# Tiny Bubbles Docker (PWA + Cloud)

This folder contains Dockerfiles and a compose file to run:
- **tinybubbles-app**: the desktop web/PWA build, served by Nginx
- **tinybubbles-cloud**: the lightweight sync server

## Quick start (HTTP compose)

You do not need to clone the repository. Download the Compose file into an empty directory:

```bash
curl -LO https://raw.githubusercontent.com/Ameyakashid/tinybubbles/main/docker/compose.yaml
```

Create a `.env` file next to it (Compose reads this automatically):

```dotenv
TINYBUBBLES_CLOUD_AUTH_TOKENS=replace_with_a_token_at_least_20_characters_long
TINYBUBBLES_CLOUD_CORS_ORIGIN=http://localhost:5173
```

`TINYBUBBLES_CLOUD_CORS_ORIGIN` must contain the exact address where you open the PWA in your browser, including scheme and port. `http://localhost:5173` only works when the browser runs on the Docker host itself. From any other machine, use the host's address, for example `http://192.168.1.20:5173`. To authorize more than one app origin, provide a comma-separated list.

Then pull and start the published images:

```bash
docker compose pull
docker compose up -d
```

Then open:
- PWA: `http://localhost:5173`
- Cloud health: `http://localhost:8787/health`
- Self-Hosted URL for local testing: `http://localhost:8787`
- REST API base URL: `http://localhost:8787/v1`

From a phone or another computer, replace `localhost` with the Docker host's LAN IP. In Tiny Bubbles, use the cloud port (`http://HOST_IP:8787`) as the Self-Hosted URL, not the PWA port (`:5173`).

To build from source instead, clone the repository and run `docker compose -f docker/compose.yaml up --build -d` from its root.

This HTTP compose file is best for local testing. Tiny Bubbles desktop and mobile clients accept HTTP for localhost, private IPs, and local hostnames. Public URLs should use HTTPS.

## Dropbox sync and the Docker PWA

The `tinybubbles-app` Docker image serves the browser/PWA build. Native Dropbox OAuth sync is not available in this runtime because Dropbox connection is implemented by the native desktop and mobile apps. Supplying `VITE_DROPBOX_APP_KEY` or `DROPBOX_APP_KEY` through `.env`, `env_file`, or compose runtime environment will not enable Dropbox in Docker.

For Docker-hosted sync, use the bundled self-hosted cloud server or WebDAV. If the self-hosted endpoint is behind Authelia or another interactive SSO proxy, configure the proxy to let the Tiny Bubbles sync/API path use Tiny Bubbles's bearer token directly; the mobile app cannot complete an Authelia browser login in front of `/v1/data`.

## HTTPS quick start (Cloud + Caddy)

Use the HTTPS compose file when syncing real desktop or mobile clients to a self-hosted cloud server:

```bash
cp docker/.env.https.example docker/.env.https.local
```

Edit `docker/.env.https.local`:

```dotenv
TINYBUBBLES_CLOUD_DOMAIN=tinybubbles.example.com
TINYBUBBLES_CLOUD_AUTH_TOKENS=your_long_random_token
TINYBUBBLES_CLOUD_CORS_ORIGIN=https://app.tinybubbles.example.com
TINYBUBBLES_CADDYFILE=Caddyfile.https
```

Start the HTTPS stack:

```bash
docker compose --env-file docker/.env.https.local -f docker/compose.https.yaml up -d
```

Then check:

```bash
curl https://tinybubbles.example.com/health
```

In Tiny Bubbles Settings -> Sync -> Self-Hosted, use:

```text
https://tinybubbles.example.com
```

Tiny Bubbles will automatically append `/v1/data`.

The CORS value is the browser app's origin, not the Cloud API origin. If the app is served
from more than one origin, list each origin separated by commas.

### LAN-only HTTPS

For a hostname that only resolves on your home network, change:

```dotenv
TINYBUBBLES_CLOUD_DOMAIN=tinybubbles.home.arpa
TINYBUBBLES_CLOUD_CORS_ORIGIN=https://app.tinybubbles.home.arpa
TINYBUBBLES_CADDYFILE=Caddyfile.local-https
```

This uses Caddy's internal certificate authority. Each client device must trust Caddy's local root certificate before Tiny Bubbles will accept the HTTPS connection. Public Let's Encrypt certificates are the more reliable option for mobile clients.

After the LAN-only stack starts, you can export Caddy's local root certificate with:

```bash
docker compose --env-file docker/.env.https.local -f docker/compose.https.yaml cp caddy:/data/caddy/pki/authorities/local/root.crt ./tinybubbles-caddy-root.crt
```

Install that certificate as a trusted root on each device that will sync to this hostname.

## Configure sync token

The cloud server expects a token. In `docker/compose.yaml`, set:

```
TINYBUBBLES_CLOUD_AUTH_TOKENS=your_token_here
```

`TINYBUBBLES_CLOUD_TOKEN` is still accepted for backward compatibility, but deprecated.

For Docker secrets, you can point to a mounted file instead:

```
TINYBUBBLES_CLOUD_AUTH_TOKENS_FILE=/run/secrets/tinybubbles_cloud_tokens
```

Use the **same token** in Tiny Bubbles Settings → Sync → Self-Hosted.
Set the Self-Hosted URL to the **base** endpoint, for example:

```
http://localhost:8787
```

Tiny Bubbles will automatically append `/v1/data` and store `data.json` (and attachments) under that endpoint.

Example to generate a token:

```
cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w 50 | head -n 1
```

Or you can use https://it-tools.tech/token-generator

## API (task automation)

The cloud container now exposes the REST API on the same host/port as sync, using the **same Bearer token**.

Base URL:

```
http://localhost:8787/v1
```

Create a task:

```
curl -X POST \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"input":"Review invoice from Paperless /due:tomorrow #finance"}' \
  http://localhost:8787/v1/tasks
```

List tasks:

```
curl -H "Authorization: Bearer your_token_here" \
  "http://localhost:8787/v1/tasks?status=next"
```

## Volumes

Persist cloud data by mounting a host path:

```
./data:/app/cloud_data
```

If you switch to a custom host path, make sure it is writable by the container user (uid 1000):

```
sudo chown -R 1000:1000 /path/data_dir
```

## Build without compose (optional)

```bash
# PWA
docker build -f docker/app/Dockerfile -t tinybubbles-app .

# Cloud
docker build -f docker/cloud/Dockerfile -t tinybubbles-cloud .
```

## Notes

- The PWA uses client-side rendering; Nginx is configured with `try_files` to avoid 404s on refresh.
- Bun is pinned to `1.3` and the build uses C++20 flags for `better-sqlite3`.
