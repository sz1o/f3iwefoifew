# N.S Vault

Games, apps, learning tools and a built-in web proxy — glossy red / green / white, with snow.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer. There is nothing to install.

```bash
node server.js          # http://localhost:8080
PORT=3000 node server.js
```

`server.js` does two jobs in one process:

1. serves the site (`/` redirects to `/home/`)
2. runs the proxy backend at `/bare/` (the Bare v1 protocol Ultraviolet talks to, including WebSockets)

The proxy uses a service worker, so the site must be opened over **https** (or `localhost`).

### Hosting

Deploy it anywhere that can run a Node process (Render, Railway, Fly.io, a VPS…) with the start command `node server.js`.
Static-only hosts (GitHub Pages, Netlify static, Vercel static) can show the site, but **cannot run the proxy backend**.
If you must stay static, host `server.js` somewhere else and set `bare` in `home/uv/uv.config.js` to that URL
(for example `https://my-proxy.example/bare/`; it has to send CORS headers).

The site lives under `/home/` — keep that path, the proxy config uses it.

### Safety

The proxy refuses to connect to localhost, private networks and cloud-metadata addresses, so it cannot be used to reach the
machine it runs on. `NS_ALLOW_PRIVATE=1` turns that off for local testing only — never set it on a public server.

## Project layout

```
server.js            static server + Bare v1 proxy backend
home/
  index.html         home + search
  g.html a.html      games / apps (data: games.json, apps.json)
  learning.html      learning tools (learning.json)
  404.html
  ns.css ns.js       shared styles + behaviour (snow, dock, settings, cloak, proxy launcher)
  uv-sw.js uv/       Ultraviolet service worker + bundle
```

Add or edit entries in the `.json` files (`name`, `link`, `image`, optional `categories`). Entries whose link starts with
`/` are treated as games hosted on this server and only appear when those files actually exist.

## Credits & license

N.S Vault is a reworked version of **AJH's Vault V6**, released under
[CC BY-NC-SA 4.0](LICENSE) — attribution to the original work is required, it can't be used commercially, and
derivatives must keep the same license. Web proxying is powered by
[Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) by Titanium Network.
