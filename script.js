/* Gulberg Motors — interactions */
(() => {
  const WA = "924235758890";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.classList.add("js");
  $("#yr").textContent = new Date().getFullYear();

  /* ---------- Header: scrolled state + hide on scroll down ---------- */
  const hdr = $("#hdr");
  const mbar = $("#mbar");
  const hero = $(".scrub");
  let lastY = scrollY;
  let ticking = false;

  const onScroll = () => {
    const y = scrollY;
    hdr.classList.toggle("is-scrolled", y > 24);
    // header stays pinned for the whole page (no hide-on-scroll)
    mbar.classList.toggle("is-visible", y > hero.offsetTop + hero.offsetHeight - innerHeight * 0.9);
    lastY = y;
    ticking = false;
  };
  addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  /* ---------- In-page links: smooth scroll, keep URL clean (no #fleet left in the address bar) ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^=\"#\"]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute("href");
    if (id === "#") return;
    const target = id === "#top" ? document.body : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (id === "#top") scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    else target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });

  /* ---------- Mobile drawer ---------- */
  const drawer = $("#drawer");
  const menuBtn = $("#menuBtn");
  const closeBtn = $("#menuClose");

  const openMenu = () => {
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add("is-open"));
    document.body.classList.add("no-scroll");
    menuBtn.setAttribute("aria-expanded", "true");
    closeBtn.focus();
  };
  const closeMenu = (restoreFocus = true) => {
    drawer.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
    menuBtn.setAttribute("aria-expanded", "false");
    setTimeout(() => { drawer.hidden = true; }, reduceMotion ? 0 : 280);
    if (restoreFocus) menuBtn.focus();
  };
  menuBtn.addEventListener("click", openMenu);
  closeBtn.addEventListener("click", () => closeMenu());
  $$("a", drawer).forEach((a) => a.addEventListener("click", () => closeMenu(false)));
  addEventListener("keydown", (e) => {
    if (drawer.hidden) return;
    if (e.key === "Escape") closeMenu();
    if (e.key === "Tab") {
      const f = $$("a, button", drawer);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  matchMedia("(min-width: 1200px)").addEventListener("change", (e) => { if (e.matches && !drawer.hidden) closeMenu(false); });

  /* ---------- Active nav link ---------- */
  const navLinks = $$("[data-nav]");
  const sections = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const navObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id));
      moveInd();
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => navObs.observe(s));

  // iOS-style white pill that glides to the active link
  const ind = $(".hdr__ind");
  function moveInd() {
    if (!ind) return;
    const a = $(".hdr__nav a.is-active");
    if (!a || !a.offsetWidth) { ind.style.opacity = "0"; return; }
    ind.style.opacity = "1";
    ind.style.width = a.offsetWidth + "px";
    ind.style.transform = `translateX(${a.offsetLeft}px)`;
  }
  addEventListener("resize", moveInd);
  document.fonts && document.fonts.ready.then(moveInd);

  /* ---------- Reveal on scroll ---------- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); revealObs.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  $$(".reveal").forEach((el) => {
    // stagger siblings slightly
    const sibs = $$(":scope > .reveal", el.parentElement);
    const i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty("--d", Math.min(i * 60, 300) + "ms");
    revealObs.observe(el);
  });

  /* ---------- Stat count-up ---------- */
  const countObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const end = +el.dataset.count;
      countObs.unobserve(el);
      if (reduceMotion) return;
      const t0 = performance.now();
      const dur = 1100;
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      el.textContent = "0";
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countObs.observe(el));

  /* ---------- Fleet filter + mobile carousel ---------- */
  const track = $("#fleetTrack");
  const cars = $$(".car", track);
  const chips = $$(".chip");
  const countEl = $("#fleetCount");
  const prev = $("#fleetPrev");
  const next = $("#fleetNext");
  const empty = $("#fleetEmpty");

  chips.forEach((chip) => {
    const f = chip.dataset.filter;
    const n = f === "all" ? cars.length : cars.filter((c) => c.dataset.cat.split(" ").includes(f)).length;
    chip.insertAdjacentHTML("beforeend", `<span class="n">${n}</span>`);
    chip.addEventListener("click", () => {
      chips.forEach((c) => { c.classList.toggle("is-active", c === chip); c.setAttribute("aria-pressed", c === chip); });
      cars.forEach((c) => { c.hidden = !(f === "all" || c.dataset.cat.split(" ").includes(f)); c.classList.add("is-in"); });
      empty.hidden = cars.some((c) => !c.hidden);
      track.scrollTo({ left: 0, behavior: reduceMotion ? "auto" : "smooth" });
      updateCarousel();
    });
  });

  const visibleCars = () => cars.filter((c) => !c.hidden);
  const offsetOf = (el) => {
    const padL = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    return el.getBoundingClientRect().left - track.getBoundingClientRect().left - padL;
  };
  const currentIndex = () => {
    let best = 0, bestD = Infinity;
    visibleCars().forEach((c, i) => { const d = Math.abs(offsetOf(c)); if (d < bestD) { bestD = d; best = i; } });
    return best;
  };
  const updateCarousel = () => {
    const v = visibleCars();
    const i = currentIndex();
    countEl.textContent = v.length ? `${i + 1} / ${v.length}` : "0 / 0";
    prev.disabled = i <= 0;
    next.disabled = i >= v.length - 1 || track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  };
  const go = (dir) => {
    const v = visibleCars();
    const target = v[Math.max(0, Math.min(v.length - 1, currentIndex() + dir))];
    if (target) track.scrollBy({ left: offsetOf(target), behavior: reduceMotion ? "auto" : "smooth" });
  };
  prev.addEventListener("click", () => go(-1));
  next.addEventListener("click", () => go(1));
  let sT;
  track.addEventListener("scroll", () => { clearTimeout(sT); sT = setTimeout(updateCarousel, 60); }, { passive: true });
  addEventListener("resize", updateCarousel);
  updateCarousel();

  /* ---------- Booking form ---------- */
  const form = $("#book");
  const pick = $("#f-pick");
  const ret = $("#f-ret");
  const addr = $("#f-addr");
  const car = $("#f-car");
  const msg = $("#f-ret-err");

  const toLocal = (d) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const now = new Date();
  const t1 = new Date(now); t1.setDate(t1.getDate() + 1); t1.setHours(10, 0, 0, 0);
  const t2 = new Date(t1); t2.setDate(t2.getDate() + 3); t2.setHours(20, 0, 0, 0);
  pick.value = toLocal(t1);
  ret.value = toLocal(t2);
  pick.min = toLocal(now);
  ret.min = pick.value;
  pick.addEventListener("change", () => {
    ret.min = pick.value;
    if (ret.value && ret.value <= pick.value) {
      const d = new Date(pick.value); d.setDate(d.getDate() + 1); ret.value = toLocal(d);
    }
  });

  const setMsg = (text, type) => { msg.textContent = text; msg.className = "book__msg " + (type ? "is-" + type : ""); };
  [addr, pick, ret].forEach((el) => el.addEventListener("input", () => { el.removeAttribute("aria-invalid"); setMsg(""); }));

  const fmt = (v) => new Date(v).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let bad = null;
    if (!addr.value.trim()) bad = [addr, "Please add a delivery address."];
    else if (!pick.value) bad = [pick, "Please choose a pick-up time."];
    else if (!ret.value || ret.value <= pick.value) bad = [ret, "Return must be after pick-up."];
    if (bad) {
      bad[0].setAttribute("aria-invalid", "true");
      bad[0].focus();
      setMsg(bad[1], "error");
      return;
    }
    const mode = form.querySelector("input[name=mode]:checked").value;
    const text =
      `Hello Gulberg Motors, I'd like to check availability:\n` +
      `• Vehicle: ${car.value}\n• Mode: ${mode}\n• Delivery: ${addr.value.trim()}\n` +
      `• Pick-up: ${fmt(pick.value)}\n• Return: ${fmt(ret.value)}`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setMsg("Opening WhatsApp — our concierge will confirm within minutes.", "ok");
  });

  /* Reserve buttons (cards + peek popup) → preselect vehicle & jump to form */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-reserve]");
    if (!btn) return;
    closePeek(true);
    car.value = btn.dataset.reserve;
    form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    setTimeout(() => car.focus({ preventScroll: true }), reduceMotion ? 0 : 600);
    setMsg(`${btn.dataset.reserve} selected — pick your dates.`, "ok");
  });

  /* ---------- Netflix-style peek: hold cursor 2s on a car card ---------- */
  const HOLD_MS = 2000;
  const DETAILS = {
    "Toyota Land Cruiser LC300 GR Sport": {
      tagline: "The definitive status symbol in Punjab. Bespoke blackout aero styling, crawl-control telematics and quad-zone executive climate.",
      stats: [["0–100", "6.7s"], ["Power", "409 HP"], ["Seats", "7"], ["Drive", "Full-time 4WD"]],
      perks: ["Crawl Control", "Quad-zone climate", "B6 armour option", "Chauffeur or self-drive"],
    },
    "Range Rover Autobiography LWB": {
      tagline: "The quiet-luxury benchmark — long-wheelbase calm for diplomats and dynasties.",
      stats: [["0–100", "4.6s"], ["Power", "523 HP"], ["Seats", "5"], ["Drive", "AWD"]],
      perks: ["Executive rear lounge", "Massage seats", "Meridian audio", "Air suspension"],
    },
    "Porsche Cayenne Turbo": {
      tagline: "Grand-tourer pace with SUV poise — for when the motorway calls.",
      stats: [["0–100", "3.9s"], ["Power", "541 HP"], ["Seats", "5"], ["Drive", "AWD"]],
      perks: ["Sport Chrono", "Panoramic roof", "Bose surround", "Adaptive air ride"],
    },
    "BMW X7 xDrive40i M-Sport": {
      tagline: "Seven seats of first-class calm under a starlit Sky Lounge roof.",
      stats: [["0–100", "5.8s"], ["Power", "375 HP"], ["Seats", "7"], ["Drive", "xDrive AWD"]],
      perks: ["Sky Lounge roof", "Captain’s chairs", "Harman Kardon", "Gesture control"],
    },
    "GWM Tank 500 Luxury Hybrid": {
      tagline: "Hybrid hush meets body-on-frame grit — Murree-ready in Nappa comfort.",
      stats: [["0–100", "7.8s"], ["Power", "348 HP"], ["Seats", "7"], ["Drive", "4WD · 3 diff-locks"]],
      perks: ["Nappa massage seats", "360° camera", "Ambient lighting", "Hybrid efficiency"],
    },
  };

  const canHover = matchMedia("(hover: hover) and (pointer: fine)");
  let armTimer = null;
  let peek = null; // { el, card, from }
  let peekBusy = false;

  const buildPeek = (card) => {
    const name = card.querySelector("[data-reserve]").dataset.reserve;
    const d = DETAILS[name] || { stats: [], perks: [] };
    const el = document.createElement("div");
    el.className = "peek";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", `${name} — quick preview`);

    const media = document.createElement("div");
    media.className = "car__media peek__media";
    const main = card.querySelector(".tile--main").cloneNode(true);
    main.querySelector(".car__hold")?.remove();
    main.querySelector("img").loading = "eager";
    media.append(...main.childNodes);

    const body = document.createElement("div");
    body.className = "peek__body";
    const desc = d.tagline || "";
    const badge = card.classList.contains("car--feature") ? '<span class="badge">Atelier Flagship</span>' : '<span class="badge">Ready today</span>';
    const price = card.dataset.price || "";
    const wa = "https://wa.me/924235758890?text=" + encodeURIComponent("Inquiry regarding " + name);
    body.innerHTML = `
      <div class="peek__title"><h3 class="car__name">${name}</h3>${badge}</div>
      <p class="peek__desc">${desc}</p>
      <dl class="peek__stats">${d.stats.map(([k, v], i) => `<div style="--i:${i}"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
      <ul class="peek__perks">${d.perks.map((p, i) => `<li style="--i:${i}">${p}</li>`).join("")}</ul>`;
    body.insertAdjacentHTML("beforeend", `
      <div class="car__foot">
        <div class="price"><span class="lbl">Daily tariff</span><span class="price__val">${price}<small>/ day</small></span></div>
        <div class="car__actions">
          <a class="icon-btn icon-btn--soft" href="${wa}" target="_blank" rel="noopener noreferrer" aria-label="Ask about ${name} on WhatsApp"><svg class="i"><use href="#i-chat"/></svg></a>
          <button class="btn btn--gold btn--sm" type="button" data-reserve="${name}">Reserve</button>
        </div>
      </div>`);

    el.append(media, body);
    return el;
  };

  const openPeek = (card) => {
    if (peek || peekBusy) return;
    const r = card.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const el = buildPeek(card);
    const scale = r.width > 600 ? 1.12 : 1.38;
    const w = Math.min(r.width * scale, innerWidth - 32);
    el.style.width = w + "px";
    el.style.maxHeight = innerHeight - 32 + "px";
    el.style.visibility = "hidden";
    document.body.appendChild(el);
    const h = el.offsetHeight;
    const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, innerWidth - 16 - w));
    const top = Math.max(16, Math.min(r.top + r.height / 2 - h / 2, innerHeight - 16 - h));
    Object.assign(el.style, { left: left + "px", top: top + "px", visibility: "" });

    // FLIP: grow out of the card's own box
    const from = `translate(${r.left + r.width / 2 - (left + w / 2)}px, ${r.top + r.height / 2 - (top + h / 2)}px) scale(${r.width / w})`;
    card.classList.add("is-peeking");
    el.animate([{ transform: from, opacity: 0.5 }, { transform: "none", opacity: 1 }],
      { duration: reduceMotion ? 1 : 440, easing: "cubic-bezier(.22,1,.36,1)" });
    requestAnimationFrame(() => el.classList.add("is-open"));
    peek = { el, card, from };
    el.addEventListener("mouseleave", () => closePeek());
  };

  function closePeek(instant = false) {
    if (!peek || peekBusy) return;
    const { el, card, from } = peek;
    peekBusy = true;
    const done = () => {
      if (!peek) return;
      el.remove(); card.classList.remove("is-peeking", "is-arming"); peek = null; peekBusy = false;
    };
    if (instant || reduceMotion) return done();
    el.classList.remove("is-open");
    el.animate([{ transform: "none", opacity: 1 }, { transform: from, opacity: 0 }],
      { duration: 260, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }).onfinish = done;
    setTimeout(done, 320); // fallback if animations are throttled
  }

  const disarm = (card) => { clearTimeout(armTimer); armTimer = null; card.classList.remove("is-arming"); };

  cars.forEach((card) => {
    const bar = document.createElement("span");
    bar.className = "car__hold";
    bar.setAttribute("aria-hidden", "true");
    card.querySelector(".tile--main").appendChild(bar);

    card.addEventListener("mouseenter", () => {
      if (!canHover.matches || peek) return;
      card.classList.add("is-arming");
      armTimer = setTimeout(() => openPeek(card), HOLD_MS);
    });
    card.addEventListener("mouseleave", () => disarm(card));
    // pressing a button inside means "act now", not "preview"
    card.addEventListener("mousedown", () => disarm(card));
  });

  document.addEventListener("pointermove", (e) => {
    if (!peek || peekBusy) return;
    const r = peek.el.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closePeek();
  }, { passive: true });
  addEventListener("scroll", () => closePeek(), { passive: true });
  addEventListener("resize", () => closePeek(true));
  addEventListener("keydown", (e) => { if (e.key === "Escape") closePeek(); });

  /* ---------- Ripple on press ---------- */
  document.addEventListener("pointerdown", (e) => {
    const t = e.target.closest(".btn, .icon-btn, .chip, .mbar__btn");
    if (!t || reduceMotion) return;
    const r = t.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const rip = document.createElement("span");
    rip.className = "ripple";
    Object.assign(rip.style, {
      width: size + "px", height: size + "px",
      left: e.clientX - r.left - size / 2 + "px", top: e.clientY - r.top - size / 2 + "px",
    });
    t.appendChild(rip);
    rip.addEventListener("animationend", () => rip.remove());
  });

  /* ---------- FAQ: smooth open/close ---------- */
  $$(".faq details").forEach((det) => {
    const body = det.querySelector("p");
    det.querySelector("summary").addEventListener("click", (e) => {
      if (reduceMotion) return;
      e.preventDefault();
      if (det.classList.contains("is-closing")) return;
      if (det.open) {
        det.classList.add("is-closing");
        const finish = () => { if (!det.classList.contains("is-closing")) return; det.open = false; det.classList.remove("is-closing"); };
        body.animate([{ height: body.offsetHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
          { duration: 260, easing: "cubic-bezier(.4,0,.2,1)" }).onfinish = finish;
        setTimeout(finish, 320); // fallback if animations are throttled
      } else {
        det.open = true;
        body.animate([{ height: "0px", opacity: 0 }, { height: body.offsetHeight + "px", opacity: 1 }],
          { duration: 340, easing: "cubic-bezier(.22,1,.36,1)" });
      }
    });
  });
})();
