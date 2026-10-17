/* Gulberg Motors — scroll-scrubbed hero (LC300 frame sequence) */
(() => {
  const section = document.querySelector(".scrub");
  const canvas = document.getElementById("scrubCanvas");
  if (!section || !canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const TOTAL = 300;
  const SRC_W = 1280, SRC_H = 720;
  const path = (n) => `assets/hero-frames/f${String(n).padStart(3, "0")}.jpg`;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Phones / data-saver: every 2nd frame (150 frames ≈ 3 MB) — still smooth at scroll speed.
  const saveData = navigator.connection && navigator.connection.saveData;
  const step = (matchMedia("(max-width: 767px)").matches || saveData) ? 2 : 1;
  const frameNums = [];
  for (let n = 1; n <= TOTAL; n += step) frameNums.push(n);
  const N = frameNums.length;
  const frames = new Array(N);      // HTMLImageElement once decoded
  let loaded = 0;

  const countEl = document.getElementById("scrubCount");
  const barEl = document.getElementById("scrubBar");
  const loaderEl = document.getElementById("scrubLoader");
  const beats = [...section.querySelectorAll("[data-beat]")].map((el) => {
    const [a, b] = el.dataset.beat.split(" ").map(Number);
    return { el, a, b, on: false, ticked: false };
  });

  /* ---------- Canvas sizing & drawing ---------- */
  let cw = 0, ch = 0, dpr = 1;
  // iOS Safari fires resize constantly while its toolbar collapses/expands, and can report a
  // tiny/zero box during load or back-forward restore. Only rebuild the bitmap when the canvas
  // box really changed and has a sane size — otherwise a stale bitmap gets CSS-stretched.
  const resize = (force = false) => {
    const r = canvas.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 50 || h < 50) return;
    const nd = Math.min(window.devicePixelRatio || 1, 2);
    if (!force && w === cw && h === ch && nd === dpr) return;
    dpr = nd; cw = w; ch = h;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    drawn = -1;
    draw(Math.round(current));
  };

  // Where the frame lands: full-bleed "cover" on landscape; on portrait, a band at the top
  // cropped around the car (focal x ≈ 62%), leaving room below for the copy.
  const destRect = () => {
    const focalX = 0.62;
    let w, h, x, y;
    if (cw / ch >= 1) {
      const s = Math.max(cw / SRC_W, ch / SRC_H);
      w = SRC_W * s; h = SRC_H * s; y = (ch - h) / 2;
      x = cw * (cw > 1100 ? 0.68 : 0.62) - w * 0.625; // car centre (≈62.5% of frame) sits right of the copy
    } else {
      h = Math.max(ch * 0.6, cw * SRC_H / SRC_W);
      w = h * SRC_W / SRC_H; y = 0;
      x = cw / 2 - w * focalX;
    }
    x = Math.min(0, Math.max(cw - w, x));
    return [x, y, w, h];
  };

  let drawn = -1;
  const nearestLoaded = (i) => {
    if (frames[i]) return i;
    for (let d = 1; d < N; d++) {
      if (frames[i - d]) return i - d;
      if (frames[i + d]) return i + d;
    }
    return -1;
  };
  function draw(i) {
    const k = nearestLoaded(i);
    if (k < 0 || k === drawn) return;
    const [x, y, w, h] = destRect();
    ctx.fillStyle = "#0b0b0c";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(frames[k], x, y, w, h);
    // portrait: melt the frame's bottom edge into the page ink (no hard seam)
    if (y + h < ch - 1) {
      const g = ctx.createLinearGradient(0, y + h * 0.62, 0, y + h);
      g.addColorStop(0, "rgba(11,11,12,0)");
      g.addColorStop(1, "rgba(11,11,12,1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, y + h * 0.62, cw, h * 0.38 + 1);
    }
    drawn = k;
    if (!section.classList.contains("is-ready")) section.classList.add("is-ready");
  }

  /* ---------- Preload: coarse → fine so scrubbing works early ---------- */
  const order = [];
  const seen = new Set();
  [0, 16, 8, 4, 2, 1].forEach((gap, pass) => {
    for (let i = 0; i < N; i += gap || N) {
      if (!seen.has(i)) { seen.add(i); order.push(i); }
      if (pass === 0) break;
    }
  });
  for (let i = 0; i < N; i++) if (!seen.has(i)) order.push(i);

  const load = (i) => new Promise((res) => {
    const img = new Image();
    img.decoding = "async";
    img.src = path(frameNums[i]);
    const done = () => {
      frames[i] = img; loaded++;
      if (loaderEl) loaderEl.firstElementChild.style.transform = `scaleX(${loaded / N})`;
      if (loaded === N && loaderEl) loaderEl.classList.add("is-done");
      // redraw if a closer frame just arrived
      const t = Math.round(current);
      if (drawn !== t && Math.abs(i - t) <= Math.abs(drawn - t)) { drawn = -1; draw(t); }
      res();
    };
    img.onload = done; // (img.decode() can stall in background tabs — onload is enough)
    img.onerror = () => { loaded++; res(); };
  });

  // Small pool so the first frames aren't starved by 300 parallel requests.
  const POOL = 6;
  let cursor = 0;
  const worker = async () => { while (cursor < order.length) await load(order[cursor++]); };
  load(order[cursor++]).then(() => { for (let k = 0; k < POOL; k++) worker(); });

  /* ---------- Scroll → frame + beats ---------- */
  let target = 0, current = 0, raf = 0;
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  const progress = () => {
    const r = section.getBoundingClientRect();
    const span = section.offsetHeight - window.innerHeight;
    return span > 0 ? clamp01(-r.top / span) : 0;
  };

  const tick = (el) => {
    el.querySelectorAll("[data-tick]").forEach((n) => {
      const end = parseFloat(n.dataset.tick), dec = +(n.dataset.dec || 0);
      if (reduceMotion) return;
      const t0 = performance.now();
      const f = (t) => {
        const p = Math.min((t - t0) / 900, 1);
        n.textContent = (end * (1 - Math.pow(1 - p, 3))).toFixed(dec);
        if (p < 1) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
  };

  const updateBeats = (p) => {
    const F = 0.06;
    beats.forEach((bt) => {
      const fin = bt.a <= 0 ? 1 : smooth(clamp01((p - bt.a) / F));
      const fout = bt.b >= 1 ? 1 : 1 - smooth(clamp01((p - (bt.b - F)) / F));
      const o = Math.min(fin, fout);
      const leaving = p > (bt.a + bt.b) / 2;
      const y = reduceMotion ? 0 : (1 - o) * (leaving ? -36 : 36);
      bt.el.style.opacity = o.toFixed(3);
      bt.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      const on = o > 0.5;
      if (on !== bt.on) {
        bt.on = on;
        bt.el.classList.toggle("is-on", on);
        bt.el.setAttribute("aria-hidden", String(!on));
        if (on && !bt.ticked && bt.el.querySelector("[data-tick]")) { bt.ticked = true; tick(bt.el); }
      }
    });
  };

  const frame = () => {
    const diff = target - current;
    current = reduceMotion || Math.abs(diff) < 0.05 ? target : current + diff * 0.18;
    const i = Math.round(current);
    draw(i);
    if (countEl) countEl.textContent = `${String(frameNums[i]).padStart(3, "0")} / ${TOTAL}`;
    raf = current !== target ? requestAnimationFrame(frame) : 0;
  };

  const onScroll = () => {
    const p = progress();
    target = p * (N - 1);
    if (barEl) barEl.style.transform = `scaleX(${p})`;
    section.classList.toggle("is-moving", p > 0.02);
    updateBeats(p);
    if (!raf) raf = requestAnimationFrame(frame);
  };

  addEventListener("scroll", onScroll, { passive: true });
  let rq = 0;
  const queueResize = () => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; resize(); onScroll(); }); };
  if ("ResizeObserver" in window) new ResizeObserver(queueResize).observe(canvas);
  addEventListener("resize", queueResize);
  addEventListener("orientationchange", () => setTimeout(() => resize(true), 300));
  // Safari back/forward cache restores the page without re-running scripts
  addEventListener("pageshow", (e) => { if (e.persisted) { resize(true); onScroll(); } });
  resize(true);
  onScroll();
})();
