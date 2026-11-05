#!/usr/bin/env node
/**
 * N.S Vault server
 * ----------------
 * One dependency-free Node process that
 *   1. serves the static site, and
 *   2. runs the Bare v1 backend (HTTP + WebSocket) that Ultraviolet talks to.
 *
 *   node server.js            -> http://localhost:8080
 *   PORT=3000 node server.js  -> custom port
 *
 * Needs Node 18+. No npm install required.
 */
"use strict";

const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const dns = require("node:dns");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const BARE = "/bare/";
// Only for local testing: lets the proxy reach localhost / LAN targets.
const ALLOW_PRIVATE = process.env.NS_ALLOW_PRIVATE === "1";
const UPSTREAM_TIMEOUT = 30_000;

/* ------------------------------------------------------------------ */
/* Safety: an open proxy must never reach the host's own network.      */
/* ------------------------------------------------------------------ */
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
    if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);
    const list = Array.isArray(address) ? address : [{ address, family }];
    if (!ALLOW_PRIVATE && list.some((a) => isPrivateAddress(a.address))) {
      const blocked = new Error("Target address is not allowed");
      blocked.code = "FORBIDDEN_ADDRESS";
      return callback(blocked);
    }
    if (options && options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

/* ------------------------------------------------------------------ */
/* Bare v1 helpers                                                     */
/* ------------------------------------------------------------------ */
class BareError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(data),
    "cache-control": "no-store",
  });
  res.end(data);
}

function bareFail(res, err) {
  if (res.headersSent) return res.destroy();
  const status = err instanceof BareError ? err.status : 500;
  json(res, status, {
    code: err.code || "UNKNOWN",
    id: "error",
    message: err.message || "Unknown error",
  });
}

function readRemote(headers) {
  const protocol = headers["x-bare-protocol"];
  const host = headers["x-bare-host"];
  const port = headers["x-bare-port"];
  const pathname = headers["x-bare-path"];
  if (!protocol || !host || !port || !pathname) {
    throw new BareError(400, "MISSING_BARE_HEADER", "Missing x-bare-* headers");
  }
  if (protocol !== "http:" && protocol !== "https:") {
    throw new BareError(400, "INVALID_BARE_HEADER", "Unsupported protocol");
  }
  const p = Number(port);
  if (!Number.isInteger(p) || p < 1 || p > 65535) {
    throw new BareError(400, "INVALID_BARE_HEADER", "Bad port");
  }
  if (!pathname.startsWith("/")) {
    throw new BareError(400, "INVALID_BARE_HEADER", "Bad path");
  }
  return { protocol, host, port: p, path: pathname };
}

function parseJSONHeader(value, name, fallback) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new BareError(400, "INVALID_BARE_HEADER", `Bad JSON in ${name}`);
  }
}

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
]);

function buildUpstreamHeaders(req, remote) {
  const requested = parseJSONHeader(req.headers["x-bare-headers"], "x-bare-headers", {});
  const forward = parseJSONHeader(req.headers["x-bare-forward-headers"], "x-bare-forward-headers", []);
  const out = {};
  for (const [k, v] of Object.entries(requested)) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  for (const name of forward) {
    const key = String(name).toLowerCase();
    if (HOP_BY_HOP.has(key) && key !== "upgrade" && key !== "connection") continue;
    if (req.headers[key] !== undefined) out[key] = req.headers[key];
  }
  // Host must always match the remote, whatever the client claims.
  for (const k of Object.keys(out)) if (k.toLowerCase() === "host") delete out[k];
  const defaultPort = remote.protocol === "https:" ? 443 : 80;
  out.host = remote.port === defaultPort ? remote.host : `${remote.host}:${remote.port}`;
  return out;
}

function requestOptions(remote, method, headers) {
  const lib = remote.protocol === "https:" ? https : http;
  // dns.lookup is skipped for IP literals, so check those here (strip [] from IPv6).
  const literal = remote.host.replace(/^\[|\]$/g, "");
  if (net.isIP(literal) && !ALLOW_PRIVATE && isPrivateAddress(literal)) {
    throw new BareError(403, "FORBIDDEN_ADDRESS", "That address is not allowed");
  }
  return {
    lib,
    options: {
      host: literal,
      port: remote.port,
      path: remote.path,
      method,
      headers,
      lookup: safeLookup,
      servername: net.isIP(literal) ? undefined : literal,
      timeout: UPSTREAM_TIMEOUT,
      agent: false,
    },
  };
}

function mapNetworkError(err) {
  if (err instanceof BareError) return err;
  switch (err.code) {
    case "FORBIDDEN_ADDRESS": return new BareError(403, "FORBIDDEN_ADDRESS", "That address is not allowed");
    case "ENOTFOUND": case "EAI_AGAIN": return new BareError(500, "HOST_NOT_FOUND", "Host not found");
    case "ECONNREFUSED": return new BareError(500, "CONNECTION_REFUSED", "Connection refused");
    case "ECONNRESET": return new BareError(500, "CONNECTION_RESET", "Connection reset");
    case "ETIMEDOUT": case "ESOCKETTIMEDOUT": return new BareError(500, "CONNECTION_TIMEOUT", "Connection timed out");
    default: return new BareError(500, err.code || "UNKNOWN", err.message || "Request failed");
  }
}

/* ------------------------------------------------------------------ */
/* Bare v1: HTTP                                                       */
/* ------------------------------------------------------------------ */
function handleBareHTTP(req, res) {
  let remote, headers, lib, options;
  try {
    remote = readRemote(req.headers);
    headers = buildUpstreamHeaders(req, remote);
    ({ lib, options } = requestOptions(remote, req.method, headers));
  } catch (err) {
    return bareFail(res, mapNetworkError(err));
  }

  const upstream = lib.request(options, (up) => {
    const raw = {};
    for (let i = 0; i < up.rawHeaders.length; i += 2) {
      const key = up.rawHeaders[i];
      const val = up.rawHeaders[i + 1];
      const lower = key.toLowerCase();
      if (lower in raw || key in raw) {
        const k = key in raw ? key : lower;
        raw[k] = Array.isArray(raw[k]) ? [...raw[k], val] : [raw[k], val];
      } else {
        raw[key] = val;
      }
    }

    const out = {
      "x-bare-status": String(up.statusCode),
      "x-bare-status-text": up.statusMessage || "",
      "x-bare-headers": JSON.stringify(raw),
      "cache-control": "no-store",
    };
    for (const pass of ["content-encoding", "content-length", "last-modified"]) {
      if (up.headers[pass] !== undefined) out[pass] = up.headers[pass];
    }

    // 204 / 304 must stay bodyless; everything else (incl. 3xx) is wrapped as 200.
    const outer = up.statusCode === 204 || up.statusCode === 304 ? up.statusCode : 200;
    res.writeHead(outer, out);
    up.pipe(res);
    up.on("error", () => res.destroy());
  });

  upstream.on("timeout", () => upstream.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
  upstream.on("error", (err) => bareFail(res, mapNetworkError(err)));
  res.on("close", () => upstream.destroy());
  req.pipe(upstream);
}

/* ------------------------------------------------------------------ */
/* Bare v1: WebSocket (raw tunnel — handshake is forwarded verbatim)   */
/* ------------------------------------------------------------------ */
function rejectUpgrade(socket, status, text) {
  if (socket.writable) {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }
  socket.destroy();
}

function decodeProtocol(value) {
  // Bare encodes JSON into the Sec-WebSocket-Protocol token with %XX escapes.
  return JSON.parse(decodeURIComponent(value));
}

function handleBareUpgrade(req, socket, head) {
  let meta, remote, headers, lib, options;
  try {
    const protos = String(req.headers["sec-websocket-protocol"] || "")
      .split(",").map((s) => s.trim());
    if (protos[0] !== "bare" || !protos[1]) throw new Error("bad protocol");
    meta = decodeProtocol(protos[1]);
    const r = meta.remote || {};
    const scheme = r.protocol === "wss:" ? "https:" : r.protocol === "ws:" ? "http:" : null;
    if (!scheme) throw new Error("bad scheme");
    remote = readRemote({
      "x-bare-protocol": scheme,
      "x-bare-host": r.host,
      "x-bare-port": String(r.port),
      "x-bare-path": r.path,
    });
    headers = {};
    for (const [k, v] of Object.entries(meta.headers || {})) {
      if (!HOP_BY_HOP.has(k.toLowerCase()) || k.toLowerCase() === "upgrade") headers[k] = v;
    }
    for (const name of meta.forward_headers || []) {
      const key = String(name).toLowerCase();
      if (req.headers[key] !== undefined) headers[key] = req.headers[key];
    }
    for (const k of Object.keys(headers)) {
      const l = k.toLowerCase();
      if (l === "host" || l === "sec-websocket-protocol") delete headers[k];
    }
    const defaultPort = remote.protocol === "https:" ? 443 : 80;
    headers.host = remote.port === defaultPort ? remote.host : `${remote.host}:${remote.port}`;
    headers.connection = "Upgrade";
    headers.upgrade = "websocket";
    if (meta.headers && meta.headers["Sec-WebSocket-Protocol"]) {
      headers["sec-websocket-protocol"] = meta.headers["Sec-WebSocket-Protocol"];
    }
    ({ lib, options } = requestOptions(remote, "GET", headers));
  } catch {
    return rejectUpgrade(socket, 400, "Bad Request");
  }

  const upstream = lib.request(options);

  upstream.on("upgrade", (up, upSocket, upHead) => {
    const lines = ["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade"];
    if (up.headers["sec-websocket-accept"]) lines.push(`Sec-WebSocket-Accept: ${up.headers["sec-websocket-accept"]}`);
    if (up.headers["sec-websocket-extensions"]) lines.push(`Sec-WebSocket-Extensions: ${up.headers["sec-websocket-extensions"]}`);
    lines.push("Sec-WebSocket-Protocol: bare", "", "");
    socket.write(lines.join("\r\n"));
    if (upHead && upHead.length) socket.write(upHead);
    if (head && head.length) upSocket.write(head);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
    const kill = () => { socket.destroy(); upSocket.destroy(); };
    socket.on("error", kill); upSocket.on("error", kill);
    socket.on("close", kill); upSocket.on("close", kill);
  });
  upstream.on("response", (up) => {
    up.resume();
    rejectUpgrade(socket, 502, "Bad Gateway");
  });
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => rejectUpgrade(socket, 502, "Bad Gateway"));
  socket.on("error", () => upstream.destroy());
  upstream.end();
}

/* ------------------------------------------------------------------ */
/* Static files                                                        */
/* ------------------------------------------------------------------ */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};
// Never publish server-side or repo files.
const HIDDEN = new Set(["server.js", "package.json", "package-lock.json", "readme.md", "license", "dockerfile"]);

function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    return res.end();
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }
  if (pathname === "/") {
    res.writeHead(302, { location: "/home/" });
    return res.end();
  }
  let file = path.normalize(path.join(ROOT, pathname));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  const rel = path.relative(ROOT, file).split(path.sep);
  if (rel.some((p) => p.startsWith(".") || p === "node_modules") || HIDDEN.has(rel[0].toLowerCase())) {
    return notFound(res);
  }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!pathname.endsWith("/")) {
        res.writeHead(301, { location: pathname + "/" });
        return res.end();
      }
      file = path.join(file, "index.html");
    }
    fs.stat(file, (err2, st2) => {
      if (err2 || !st2.isFile()) return notFound(res);
      const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
      const headers = {
        "content-type": type,
        "content-length": st2.size,
        "cache-control": /\.(png|jpe?g|webp|gif|svg|woff2)$/i.test(file)
          ? "public, max-age=604800"
          : "no-cache",
      };
      // The UV worker is registered from /home/ but must be allowed to control /home/go/.
      if (file.endsWith(path.join("home", "uv-sw.js"))) headers["service-worker-allowed"] = "/home/";
      res.writeHead(200, headers);
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });
}

function notFound(res) {
  const page = path.join(ROOT, "home", "404.html");
  fs.readFile(page, (err, data) => {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(err ? "Not found" : data);
  });
}

/* ------------------------------------------------------------------ */
/* Wire it up                                                          */
/* ------------------------------------------------------------------ */
const server = http.createServer((req, res) => {
  if (req.url.startsWith(BARE)) {
    const sub = req.url.slice(BARE.length).split("?")[0];
    if (sub === "" ) {
      return json(res, 200, {
        versions: ["v1"],
        language: "NodeJS",
        memoryUsage: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
      });
    }
    if (sub === "v1" || sub === "v1/") return handleBareHTTP(req, res);
    return json(res, 404, { code: "NOT_FOUND", id: "error", message: "Unknown bare endpoint" });
  }
  serveStatic(req, res);
});

server.on("upgrade", (req, socket, head) => {
  if (req.url.startsWith(BARE + "v1")) return handleBareUpgrade(req, socket, head);
  rejectUpgrade(socket, 404, "Not Found");
});

server.on("clientError", (err, socket) => {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

process.on("uncaughtException", (err) => console.error("[ns-vault] uncaught:", err.message));
process.on("unhandledRejection", (err) => console.error("[ns-vault] unhandled:", err && err.message));

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`N.S Vault is running -> http://localhost:${PORT}`);
    console.log(`Proxy backend         -> http://localhost:${PORT}${BARE}`);
  });
}

module.exports = server;
