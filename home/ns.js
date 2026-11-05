/* ==========================================================================
   N.S Vault — shared behaviour
   snow · dock · settings · tab cloak · proxy launcher · listing pages · home
   ========================================================================== */
(() => {
  "use strict";

  const SCRIPT = document.currentScript;
  const BASE = new URL("./", SCRIPT ? SCRIPT.src : location.href);
  const url = (p) => new URL(p, BASE).href;
  const $ = (s, el = document) => el.querySelector(s);

  /* ---------------------------------------------------------------- store */
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("ns:" + key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("ns:" + key, JSON.stringify(value)); } catch { /* private mode */ }
    },
  };

  /* ---------------------------------------------------------------- icons */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v12h13V9"/><path d="M10 21v-6h4v6"/>',
    game: '<rect x="2" y="7" width="20" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="18" cy="13.7" r=".9" fill="currentColor"/>',
    apps: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    learn: '<path d="M2 9 12 4l10 5-10 5z"/><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5"/><path d="M22 9v6"/>',
    tune: '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.4"/><circle cx="8" cy="17" r="2.4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    flake: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
  };
  const icon = (name, cls = "ico") =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  const MARK = `<svg class="ns-mark" viewBox="0 0 100 100" role="img" aria-label="N.S Vault">
    <defs>
      <linearGradient id="nsg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a7f"/><stop offset=".55" stop-color="#e0233f"/><stop offset="1" stop-color="#8f0f25"/></linearGradient>
      <linearGradient id="nsg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="nsc"><circle cx="50" cy="50" r="46"/></clipPath>
    </defs>
    <circle cx="50" cy="50" r="46" fill="url(#nsg1)"/>
    <ellipse cx="50" cy="26" rx="36" ry="21" fill="url(#nsg2)" clip-path="url(#nsc)"/>
    <circle cx="50" cy="50" r="44.5" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2"/>
    <path d="M19 72a38 38 0 0 0 62 0" fill="none" stroke="#43d98f" stroke-width="5" stroke-linecap="round"/>
    <text x="50" y="60" text-anchor="middle" font-family="Outfit, 'Arial Black', Arial, sans-serif" font-weight="800" font-size="38" fill="#fff">NS</text>
  </svg>`;

  /* ---------------------------------------------------------------- toast */
  let toastEl, toastTimer;
  function toast(message, kind = "") {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "ns-toast glass";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.toggle("err", kind === "err");
    requestAnimationFrame(() => toastEl.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), kind === "err" ? 6500 : 2600);
  }

  /* ----------------------------------------------------------- tab cloaks */
  const fav = (d) => `https://www.google.com/s2/favicons?domain=${d}&sz=64`;
  const CLOAKS = [
    { id: "google", label: "Google", title: "Google", icon: fav("google.com") },
    { id: "drive", label: "Google Drive", title: "My Drive - Google Drive", icon: fav("drive.google.com") },
    { id: "classroom", label: "Google Classroom", title: "Classroom", icon: fav("classroom.google.com") },
    { id: "docs", label: "Google Docs", title: "Untitled document - Google Docs", icon: fav("docs.google.com") },
    { id: "slides", label: "Google Slides", title: "Untitled presentation - Google Slides", icon: fav("slides.google.com") },
    { id: "gmail", label: "Gmail", title: "Inbox - Gmail", icon: fav("mail.google.com") },
    { id: "calendar", label: "Google Calendar", title: "Google Calendar", icon: fav("calendar.google.com") },
    { id: "meet", label: "Google Meet", title: "Meet", icon: fav("meet.google.com") },
    { id: "canvas", label: "Canvas", title: "Dashboard", icon: fav("instructure.com") },
    { id: "khan", label: "Khan Academy", title: "Khan Academy", icon: fav("khanacademy.org") },
    { id: "desmos", label: "Desmos", title: "Desmos | Graphing Calculator", icon: fav("desmos.com") },
    { id: "zoom", label: "Zoom", title: "Zoom", icon: fav("zoom.us") },
  ];
  const ORIGINAL_TITLE = document.title;

  function setFavicon(href) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.removeAttribute("type");
    link.href = href;
  }
  function applyCloak() {
    const c = CLOAKS.find((x) => x.id === store.get("cloak", ""));
    if (c) { document.title = c.title; setFavicon(c.icon); }
    else { document.title = ORIGINAL_TITLE; setFavicon(url("icon.png")); }
  }

  /* ----------------------------------------------------------------- snow */
  const Snow = (() => {
    let canvas, ctx, w = 0, h = 0, dpr = 1, flakes = [], raf = 0, last = 0;
    let wind = 0, windTarget = 0, enabled = true, level = 1;
    const sprites = {};
    const calm = matchMedia("(prefers-reduced-motion: reduce)");

    function sprite(rgb) {
      if (sprites[rgb]) return sprites[rgb];
      const s = document.createElement("canvas");
      s.width = s.height = 64;
      const g = s.getContext("2d");
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(0.35, `rgba(${rgb},0.85)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      return (sprites[rgb] = s);
    }
    const WHITE = "255,255,255", ROSE = "255,170,185", MINT = "150,255,205";

    function spawn(top) {
      const z = Math.random();
      const roll = Math.random();
      return {
        x: Math.random() * w,
        y: top ? -20 - Math.random() * 40 : Math.random() * h,
        z,
        r: 1.4 + z * z * 5.4,
        vy: 16 + z * 54,
        ph: Math.random() * Math.PI * 2,
        sw: 0.5 + Math.random() * 1.1,
        amp: 6 + z * 26,
        a: 0.3 + z * 0.65,
        s: sprite(roll < 0.06 ? ROSE : roll < 0.11 ? MINT : WHITE),
      };
    }
    function target() {
      const mult = [0.45, 1, 2.1][level] ?? 1;
      const base = (w * h) / 7500;
      return Math.max(24, Math.min(520, Math.round(base * mult * (calm.matches ? 0.5 : 1))));
    }
    function fit() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = innerWidth; h = innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = target();
      while (flakes.length < n) flakes.push(spawn(false));
      flakes.length = Math.min(flakes.length, n);
    }
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      const speed = calm.matches ? 0.35 : 1;
      wind += (windTarget + Math.sin(t / 5200) * 16 - wind) * Math.min(1, dt * 1.4);
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        f.y += f.vy * dt * speed;
        f.x += (wind * (0.25 + f.z) + Math.sin(t / 1000 * f.sw + f.ph) * f.amp * 0.55) * dt * speed;
        if (f.y > h + 12) { Object.assign(f, spawn(true)); }
        if (f.x > w + 12) f.x = -12;
        else if (f.x < -12) f.x = w + 12;
        ctx.globalAlpha = f.a;
        ctx.drawImage(f.s, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      }
      ctx.globalAlpha = 1;
    }
    function start() { if (!raf && enabled && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }

    return {
      init() {
        canvas = $("#ns-snow");
        ctx = canvas.getContext("2d");
        enabled = store.get("snow", true);
        level = store.get("snowLevel", 1);
        fit();
        addEventListener("resize", fit, { passive: true });
        addEventListener("pointermove", (e) => { windTarget = (e.clientX / w - 0.5) * 70; }, { passive: true });
        document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
        canvas.style.display = enabled ? "" : "none";
        start();
      },
      setEnabled(on) {
        enabled = on;
        store.set("snow", on);
        canvas.style.display = on ? "" : "none";
        on ? start() : stop();
      },
      setLevel(n) { level = n; store.set("snowLevel", n); fit(); },
    };
  })();

  /* ---------------------------------------------------------------- proxy */
  const ENGINES = {
    duckduckgo: "https://duckduckgo.com/?q=%s",
    google: "https://www.google.com/search?q=%s",
    bing: "https://www.bing.com/search?q=%s",
    brave: "https://search.brave.com/search?q=%s",
  };

  const ENGINE_NAMES = { duckduckgo: "DuckDuckGo", google: "Google", bing: "Bing", brave: "Brave" };

  function toUrl(input, template) {
    try { return new URL(input).toString(); } catch { /* not a full URL */ }
    try {
      const u = new URL("http://" + input);
      if (u.hostname.includes(".") && !/\s/.test(input)) return u.toString();
    } catch { /* not a host */ }
    return template.replace("%s", encodeURIComponent(input));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }

  let uvReady;
  function loadUV() {
    if (!uvReady) {
      uvReady = (async () => {
        if (!window.Ultraviolet) await loadScript(url("uv/uv.bundle.js"));
        if (!window.__uv$config) await loadScript(url("uv/uv.config.js"));
      })().catch((e) => { uvReady = null; throw e; });
    }
    return uvReady;
  }

  async function waitActive(reg) {
    const sw = reg.installing || reg.waiting || reg.active;
    if (!sw || sw.state === "activated") return;
    await new Promise((resolve, reject) => {
      sw.addEventListener("statechange", () => {
        if (sw.state === "activated") resolve();
        else if (sw.state === "redundant") reject(new Error("The service worker failed to install."));
      });
    });
  }

  let proxyReady;
  function ensureProxy() {
    if (!proxyReady) {
      proxyReady = (async () => {
        if (!("serviceWorker" in navigator)) throw new Error("This browser doesn't support service workers.");
        if (!window.isSecureContext) throw new Error("The proxy needs https:// (or localhost).");
        await loadUV();
        let ok = false;
        try {
          const r = await fetch(new URL(__uv$config.bare, location.href), { cache: "no-store" });
          const info = await r.json();
          ok = r.ok && Array.isArray(info.versions) && info.versions.includes("v1");
        } catch { ok = false; }
        if (!ok) throw new Error("The proxy backend isn't reachable. Run the N.S server (see readme) or point bare at one in uv/uv.config.js.");
        const reg = await navigator.serviceWorker.register(url("uv-sw.js"), { scope: __uv$config.prefix });
        await waitActive(reg);
      })().catch((e) => { proxyReady = null; throw e; });
    }
    return proxyReady;
  }

  async function go(target) {
    try {
      toast("Opening through the N.S proxy…");
      await ensureProxy();
      location.href = __uv$config.prefix + __uv$config.encodeUrl(target);
    } catch (e) {
      toast(e.message || "Could not start the proxy.", "err");
    }
  }

  function launch(item) {
    if (item.local || !store.get("proxy", true)) { window.open(item.url, "_blank", "noopener"); return; }
    go(item.url);
  }

  /* ------------------------------------------------------------- about:blank */
  function aboutBlank() {
    const win = window.open("about:blank", "_blank");
    if (!win) { toast("Pop-up blocked — allow pop-ups for this site and try again.", "err"); return; }
    const doc = win.document;
    doc.title = document.title;
    const link = doc.createElement("link");
    link.rel = "icon";
    link.href = (document.querySelector("link[rel~='icon']") || {}).href || url("icon.png");
    doc.head.appendChild(link);
    doc.body.style.cssText = "margin:0;background:#03120c";
    const frame = doc.createElement("iframe");
    frame.src = url("./");
    frame.style.cssText = "border:0;width:100vw;height:100vh;display:block";
    doc.body.appendChild(frame);
    location.replace("https://classroom.google.com");
  }

  /* ---------------------------------------------------------------- chrome */
  function buildChrome() {
    const page = location.pathname.split("/").pop() || "index.html";
    const items = [
      ["index.html", "home", "Home"],
      ["g.html", "game", "Games"],
      ["a.html", "apps", "Apps"],
      ["learning.html", "learn", "Learn"],
    ];
    const here = (f) => (f === "index.html" ? page === "index.html" || page === "" : page === f);
    const body = document.body;

    body.insertAdjacentHTML("afterbegin",
      `<div class="ns-bg" aria-hidden="true"><i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i></div>
       <canvas id="ns-snow" aria-hidden="true"></canvas><div class="ns-hill" aria-hidden="true"></div>`);

    const nav = document.createElement("nav");
    nav.className = "ns-dock glass";
    nav.setAttribute("aria-label", "Main");
    nav.innerHTML =
      items.map(([f, i, label]) =>
        `<a href="${url(f === "index.html" ? "./" : f)}"${here(f) ? ' class="active" aria-current="page"' : ""}>${icon(i)}<span>${label}</span></a>`
      ).join("") +
      `<i class="sep"></i><button type="button" id="ns-open-settings" aria-haspopup="dialog">${icon("tune")}<span>Settings</span></button>`;
    body.appendChild(nav);

    const current = store.get("cloak", "");
    const engine = store.get("engine", "duckduckgo");
    const overlay = document.createElement("div");
    overlay.className = "ns-overlay";
    overlay.id = "ns-overlay";
    overlay.innerHTML = `
      <div class="ns-modal glass" role="dialog" aria-modal="true" aria-labelledby="ns-set-title">
        <button class="x" type="button" aria-label="Close settings" id="ns-close">${icon("x")}</button>
        <h2 id="ns-set-title">Settings</h2>
        <p class="lead">Everything saves automatically on this device.</p>

        <div class="row"><div class="t"><b>Snowfall</b><span>Falling snow in the background</span></div>
          <label class="switch"><input type="checkbox" id="ns-snow-on" aria-label="Snowfall"><i></i></label></div>
        <div class="row"><div class="t"><b>Snow amount</b><span>Light, normal or blizzard</span></div>
          <input class="range" id="ns-snow-level" type="range" min="0" max="2" step="1" aria-label="Snow amount"></div>
        <div class="row"><div class="t"><b>Open links through the proxy</b><span>Turn off to open sites directly in a new tab</span></div>
          <label class="switch"><input type="checkbox" id="ns-proxy-on" aria-label="Open links through the proxy"><i></i></label></div>
        <div class="row"><div class="t"><b>Search engine</b><span>Used by the search bar</span></div>
          <select class="field" id="ns-engine" aria-label="Search engine">
            ${Object.keys(ENGINES).map((k) => `<option value="${k}"${k === engine ? " selected" : ""}>${ENGINE_NAMES[k]}</option>`).join("")}
          </select></div>
        <div class="row col"><div class="t"><b>Tab cloak</b><span>Change the tab title and icon</span></div>
          <div class="inline">
            <select class="field" id="ns-cloak" aria-label="Tab cloak" style="flex:1">
              <option value="">None</option>
              ${CLOAKS.map((c) => `<option value="${c.id}"${c.id === current ? " selected" : ""}>${c.label}</option>`).join("")}
            </select>
            <button class="btn sm" type="button" id="ns-cloak-set">Apply</button>
            <button class="btn sm ghost" type="button" id="ns-cloak-reset">Reset</button>
          </div></div>
        <div class="row"><div class="t"><b>about:blank launch</b><span>Opens N.S Vault in a blank tab</span></div>
          <button class="btn sm green" type="button" id="ns-blank">Launch</button></div>
      </div>`;
    body.appendChild(overlay);

    const snowOn = $("#ns-snow-on"), snowLevel = $("#ns-snow-level"), proxyOn = $("#ns-proxy-on");
    snowOn.checked = store.get("snow", true);
    snowLevel.value = store.get("snowLevel", 1);
    proxyOn.checked = store.get("proxy", true);

    let opener = null;
    const open = () => { opener = document.activeElement; overlay.classList.add("open"); $("#ns-close").focus(); };
    const close = () => { overlay.classList.remove("open"); if (opener && opener.focus) opener.focus(); };
    $("#ns-open-settings").addEventListener("click", open);
    $("#ns-close").addEventListener("click", close);
    overlay.addEventListener("pointerdown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("open")) close(); });

    snowOn.addEventListener("change", () => Snow.setEnabled(snowOn.checked));
    snowLevel.addEventListener("input", () => Snow.setLevel(Number(snowLevel.value)));
    proxyOn.addEventListener("change", () => store.set("proxy", proxyOn.checked));
    $("#ns-engine").addEventListener("change", (e) => store.set("engine", e.target.value));
    $("#ns-cloak-set").addEventListener("click", () => {
      store.set("cloak", $("#ns-cloak").value);
      applyCloak();
      toast($("#ns-cloak").value ? "Tab cloak applied" : "Tab cloak cleared");
    });
    $("#ns-cloak-reset").addEventListener("click", () => {
      store.set("cloak", "");
      $("#ns-cloak").value = "";
      applyCloak();
      toast("Tab cloak reset");
    });
    $("#ns-blank").addEventListener("click", aboutBlank);
  }

  /* ----------------------------------------------------------- data lists */
  const LABELS = { "2p": "2 Player", featured: "Featured", emulator: "Emulators", android: "Android", flash: "Flash", sports: "Sports", strategy: "Strategy", site: "Game Sites" };
  const label = (c) => LABELS[c] || c.charAt(0).toUpperCase() + c.slice(1);

  function clean(raw) {
    if (!raw || !raw.link) return null;
    const name = String(raw.name || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\(\s*vault exclusive\s*\)/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) return null;
    const local = raw.link.startsWith("/");
    const cats = [...new Set((raw.categories || []).map((c) => String(c).toLowerCase()).filter((c) => c && c !== "all"))];
    return { name, url: local ? new URL(raw.link, location.origin).href : raw.link, local, image: raw.image || "", cats };
  }

  async function probe(href) {
    try { return (await fetch(href, { method: "HEAD", cache: "no-store" })).ok; } catch { return false; }
  }

  const cache = {};
  function loadItems(file) {
    if (!cache[file]) {
      cache[file] = (async () => {
        const res = await fetch(url(file), { cache: "no-cache" });
        if (!res.ok) throw new Error(file + " " + res.status);
        let items = (await res.json()).map(clean).filter(Boolean);
        // Entries hosted on this origin only show when their files are really here.
        const local = items.filter((i) => i.local);
        if (local.length) {
          const ok = (await probe(local[0].url)) || (local[1] && (await probe(local[1].url)));
          if (!ok) items = items.filter((i) => !i.local);
        }
        const seen = new Set();
        items = items.filter((i) => { const k = i.name.toLowerCase() + "|" + i.url; if (seen.has(k)) return false; seen.add(k); return true; });
        items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
        return items;
      })();
    }
    return cache[file];
  }

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  function cardFor(item, i) {
    const a = document.createElement("a");
    a.className = "card sheen";
    a.href = item.url;
    a.style.setProperty("--i", Math.min(i, 24));
    a.rel = "noopener";
    if (item.local) a.target = "_blank";
    const thumb = document.createElement("div");
    thumb.className = "thumb " + (hash(item.name) % 2 ? "t-g" : "t-r");
    const letter = document.createElement("span");
    letter.className = "letter";
    letter.textContent = (item.name.match(/[A-Za-z0-9]/) || ["•"])[0].toUpperCase();
    thumb.appendChild(letter);
    if (item.image) {
      const img = new Image();
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.style.position = "absolute";
      img.style.inset = "0";
      img.addEventListener("error", () => img.remove());
      img.src = item.image.startsWith("/") ? new URL(item.image, location.origin).href : item.image;
      thumb.appendChild(img);
    }
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = item.name;
    a.append(thumb, name);
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      launch(item);
    });
    return a;
  }

  async function initList(grid) {
    const file = grid.dataset.list;
    const noun = grid.dataset.noun || "items";
    const q = $("#ns-q"), chipsEl = $("#ns-chips"), countEl = $("#ns-count");
    grid.setAttribute("aria-busy", "true");
    grid.innerHTML = Array.from({ length: 18 }, () => '<div class="card skeleton"></div>').join("");

    let items;
    try { items = await loadItems(file); }
    catch (e) {
      grid.innerHTML = `<div class="empty"><b>Couldn't load ${noun}</b>Check your connection and refresh the page.</div>`;
      grid.removeAttribute("aria-busy");
      return;
    }

    const counts = {};
    items.forEach((i) => i.cats.forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
    const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    let active = "all";

    if (cats.length > 1) {
      chipsEl.innerHTML = ["all", ...cats].map((c) => `<button type="button" class="chip${c === "all" ? " on" : ""}" data-c="${c}">${c === "all" ? "All" : label(c)}</button>`).join("");
      chipsEl.addEventListener("click", (e) => {
        const b = e.target.closest(".chip");
        if (!b) return;
        active = b.dataset.c;
        chipsEl.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b));
        render();
      });
    } else if (chipsEl) chipsEl.remove();

    function render() {
      const term = q.value.trim().toLowerCase();
      const list = items.filter((i) => (active === "all" || i.cats.includes(active)) && (!term || i.name.toLowerCase().includes(term)));
      const frag = document.createDocumentFragment();
      list.forEach((it, idx) => frag.appendChild(cardFor(it, idx)));
      grid.replaceChildren(frag);
      if (!list.length) grid.innerHTML = `<div class="empty"><b>Nothing found</b>Try a different word${active !== "all" ? " or pick another category" : ""}.</div>`;
      countEl.textContent = term || active !== "all" ? `${list.length} of ${items.length} ${noun}` : `${items.length} ${noun}`;
      grid.removeAttribute("aria-busy");
    }
    q.addEventListener("input", render);
    render();
  }

  /* ------------------------------------------------------------------ home */
  const QUOTES = [
    "Fresh snow, fresh tabs.",
    "Search anything. Go anywhere.",
    "Smooth as fresh powder.",
    "Stay frosty.",
    "Bookmark this page — future you says thanks.",
    "Built to be fast. Dressed to be festive.",
    "Nice and cool in here.",
    "Tip: Settings lets you turn the snow up to blizzard.",
    "Cozy corner of the internet.",
    "Quiet on the network. Loud on the leaderboard.",
  ];

  function initHome() {
    const form = $("#ns-form"), input = $("#ns-address");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      go(toUrl(v, ENGINES[store.get("engine", "duckduckgo")] || ENGINES.duckduckgo));
    });
    document.querySelectorAll("[data-go]").forEach((c) =>
      c.addEventListener("click", () => { input.value = c.dataset.go; form.requestSubmit(); }));

    const sub = $("#ns-quote");
    let qi = Math.floor(Math.random() * QUOTES.length);
    sub.textContent = QUOTES[qi];
    setInterval(() => {
      sub.classList.add("swap");
      setTimeout(() => { qi = (qi + 1) % QUOTES.length; sub.textContent = QUOTES[qi]; sub.classList.remove("swap"); }, 500);
    }, 7000);

    const clock = $("#ns-clock");
    const tick = () => {
      const d = new Date();
      clock.textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) + "  ·  " +
        d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    };
    tick();
    setInterval(tick, 15000);

    [["g", "games.json"], ["a", "apps.json"], ["l", "learning.json"]].forEach(([k, f]) =>
      loadItems(f).then((items) => { const el = $("#ns-n-" + k); if (el) el.textContent = items.length + (items.length >= 100 ? "+" : "") + " and counting"; }).catch(() => {}));

    // warm up the proxy in the background so the first search is instant
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(() => ensureProxy().catch(() => {}));
  }

  /* ------------------------------------------------------------------ boot */
  applyCloak();
  document.addEventListener("DOMContentLoaded", () => {
    buildChrome();
    Snow.init();
    applyCloak();
    const mark = $("[data-mark]");
    if (mark) mark.innerHTML = MARK;
    const grid = $("[data-list]");
    if (grid) initList(grid);
    if ($("#ns-form")) initHome();
  });

  window.NS = { go, toast, store, toUrl };
})();
