/* Home Theater — TV-first spatial focus prototype.
   D-pad simulation: Arrow keys move focus, Enter selects, Escape/Backspace goes back,
   P opens the passwordless profile switcher. Mouse hover mirrors focus (H6 parity). */
(function () {
  "use strict";

  const state = {
    currentProfile: MOCK.profiles[0],
    heroIndex: 0,
    heroTimer: null,
    focusGroups: [],       // array of {el, items: [focusables]}
    groupIndex: 0,
    itemIndex: 0,
    overlayOpen: false,
  };

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* ---------------- Render ---------------- */

  function renderTopnav() {
    const nav = $("#topnav");
    nav.innerHTML = `
      <div class="brand">Home<span class="dot">Theater</span></div>
      <button class="nav-tab" aria-current="page">Home</button>
      <button class="nav-tab">Library</button>
      <button class="nav-tab">Discover</button>
      <button class="nav-tab">Search</button>
      <button class="profile-btn" id="profileBtn" aria-label="Switch profile">
        <span class="avatar" style="background:${state.currentProfile.color}">${state.currentProfile.initial}</span>
        <span>${state.currentProfile.name}</span>
      </button>`;
  }

  function heroSlideHTML(item, i) {
    return `
      <div class="hero-slide ${i === 0 ? "active" : ""}" data-i="${i}">
        <div class="hero-art" style="background:${item.art}"></div>
        <div class="hero-scrim"></div>
        <div class="hero-content">
          <h1 class="hero-title">${item.title}</h1>
          <div class="hero-type">${item.type} · ${item.genres.join(" · ")} · <span class="chip rating">${item.rating}</span></div>
          <p class="hero-desc">${item.desc}</p>
          <div class="meta-chips">${item.caps.map(c => `<span class="chip">${c}</span>`).join("")}</div>
          <div class="hero-actions" style="margin-top:22px">
            <button class="pill" data-action="play">▶&nbsp;&nbsp;Play</button>
            <button class="pill ghost" data-action="info">More Info</button>
          </div>
        </div>
      </div>`;
  }

  function cardHTML(item, kind, idx) {
    const rank = kind === "rank" ? `<span class="rank">${idx + 1}</span>` : "";
    const progress = item.progress != null
      ? `<div class="card-progress"><span style="width:${Math.round(item.progress * 100)}%"></span></div>` : "";
    const gradTitle = kind === "poster" ? `<div class="card-grad-title">${item.title}</div>` : "";
    return `
      <button class="card ${kind === "poster" ? "poster" : "landscape"}" data-id="${item.id}" data-title="${item.title}">
        ${rank}
        <div class="card-art">
          <div class="card-grad" style="background:${item.art}"></div>
          <div class="card-scrim"></div>
          ${gradTitle}
          ${progress}
        </div>
        <div class="card-label">
          <div class="card-title">${item.title}</div>
          <div class="card-sub">${item.sub || ""}</div>
        </div>
      </button>`;
  }

  function renderShelves() {
    const root = $("#shelves");
    root.innerHTML = MOCK.shelves.map(sh => `
      <section class="shelf">
        <div class="shelf-head"><h2 class="shelf-title">${sh.title}</h2></div>
        <div class="shelf-row"><div class="shelf-track">
          ${sh.items.map((it, i) => cardHTML(it, sh.kind === "landscape" ? "landscape" : "poster", i)).join("")}
        </div></div>
      </section>`).join("");
  }

  function renderHeroDots() {
    $("#heroDots").innerHTML = MOCK.hero.map((_, i) =>
      `<button class="dot-btn ${i === state.heroIndex ? "active" : ""}" data-i="${i}" aria-label="Featured ${i + 1}"></button>`).join("");
  }

  function setHero(i) {
    state.heroIndex = i;
    $$(".hero-slide").forEach(el => el.classList.toggle("active", +el.dataset.i === i));
    $$(".hero-dots .dot-btn").forEach(el => el.classList.toggle("active", +el.dataset.i === i));
  }

  function startHeroTimer() {
    stopHeroTimer();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    state.heroTimer = setInterval(() => setHero((state.heroIndex + 1) % MOCK.hero.length), 7000);
  }
  function stopHeroTimer() { if (state.heroTimer) { clearInterval(state.heroTimer); state.heroTimer = null; } }

  /* ---------------- Focus engine (spatial, group-based) ---------------- */

  function buildFocusGroups() {
    state.focusGroups = [
      { items: $$("#topnav .nav-tab") },
      { items: [$("#profileBtn")] },
      { items: $$("#heroDots .dot-btn") },
      { items: $$("#hero .hero-actions .pill") },
      ...$$(".shelf").map(sh => ({ items: $$(".card", sh), rowEl: $(".shelf-track", sh) })),
    ].filter(g => g.items.length);
  }

  function applyFocus(gi, ii) {
    const g = state.focusGroups[gi];
    if (!g) return;
    $$(".focused").forEach(el => el.classList.remove("focused"));
    const el = g.items[ii];
    if (!el) return;
    el.classList.add("focused");
    state.groupIndex = gi; state.itemIndex = ii;
    // keep focused card centered in its track
    if (g.rowEl) {
      const r = el.getBoundingClientRect(), t = g.rowEl.getBoundingClientRect();
      const delta = (r.left - t.left) - (t.width - r.width) / 2;
      g.rowEl.scrollBy({ left: delta, behavior: "smooth" });
    }
    // pause hero auto-advance while user navigates chrome
    stopHeroTimer();
  }

  function focusFirst() { applyFocus(3, 0); startHeroTimer(); }

  function moveFocus(dx, dy) {
    const { groupIndex: gi, itemIndex: ii } = state;
    if (dy < 0) { // up: prefer previous group
      if (gi > 0) applyFocus(gi - 1, Math.min(state.focusGroups[gi - 1].items.length - 1, nearestInPrev(gi)));
      return;
    }
    if (dy > 0) {
      if (gi < state.focusGroups.length - 1) applyFocus(gi + 1, 0);
      return;
    }
    const g = state.focusGroups[gi];
    const ni = ii + dx;
    if (ni >= 0 && ni < g.items.length) applyFocus(gi, ni);
    else if (ni < 0 && gi > 0) applyFocus(gi - 1, state.focusGroups[gi - 1].items.length - 1);
    else if (ni >= g.items.length && gi < state.focusGroups.length - 1) applyFocus(gi + 1, 0);
  }

  function nearestInPrev(gi) {
    // align by horizontal position when moving up
    const cur = state.focusGroups[gi].items[state.itemIndex];
    const prev = state.focusGroups[gi - 1];
    if (!cur || !prev) return 0;
    const cx = cur.getBoundingClientRect().left;
    let best = 0, bd = Infinity;
    prev.items.forEach((el, i) => {
      const d = Math.abs(el.getBoundingClientRect().left - cx);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /* ---------------- Detail overlay (MOCK) ---------------- */

  function openDetail(item) {
    const ov = $("#detailOverlay");
    $("#detailTitle").textContent = item.title;
    $("#detailType").textContent = `${item.type || "Movie"} · ${(item.genres || []).join(" · ")}${item.meta ? " · " + item.meta : ""}`;
    $("#detailDesc").textContent = item.desc || "MOCK item — description not available in the prototype.";
    $("#detailCaps").innerHTML = (item.caps || ["HD", "CC"]).map(c => `<span class="chip">${c}</span>`).join("");
    ov.classList.add("open");
    state.overlayOpen = true;
    stopHeroTimer();
    setTimeout(() => applyFocus(state.focusGroups.length, 0), 0); // overlay group appended below
    buildOverlayGroup();
  }

  function buildOverlayGroup() {
    const items = $$("#detailOverlay .pill");
    state.focusGroups.push({ items, overlay: true });
    applyFocus(state.focusGroups.length - 1, 0);
  }

  function closeOverlay() {
    $("#detailOverlay").classList.remove("open");
    if (state.focusGroups[state.focusGroups.length - 1].overlay) state.focusGroups.pop();
    state.overlayOpen = false;
    focusFirst();
  }

  /* ---------------- Profile switcher (passwordless) ---------------- */

  function openProfiles() {
    const ov = $("#profileOverlay"), grid = $("#profileGrid");
    grid.innerHTML = MOCK.profiles.map(p => `
      <button class="profile-tile" data-id="${p.id}">
        <span class="avatar" style="background:${p.color}">${p.initial}</span>
        <span class="name">${p.name}</span>
      </button>`).join("");
    ov.classList.add("open");
    state.focusGroups.push({ items: $$(".profile-tile", grid), overlay: true });
    applyFocus(state.focusGroups.length - 1, 0);
  }

  function closeProfiles(pickId) {
    const ov = $("#profileOverlay");
    ov.classList.remove("open");
    if (state.focusGroups[state.focusGroups.length - 1].overlay) state.focusGroups.pop();
    if (pickId) {
      state.currentProfile = MOCK.profiles.find(p => p.id === pickId) || state.currentProfile;
      renderTopnav();
    }
    buildFocusGroups();
    focusFirst();
  }

  /* ---------------- Events ---------------- */

  function findCard(id) {
    for (const sh of MOCK.shelves) {
      const hit = sh.items.find(it => it.id === id);
      if (hit) return hit;
    }
    return MOCK.hero.find(h => h.id === id);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#detailClose")) { closeOverlay(); return; }
    const card = e.target.closest(".card");
    if (card) { openDetail(findCard(card.dataset.id) || {}); return; }
    if (e.target.closest('[data-action="play"]') || e.target.closest('[data-action="info"]')) {
      const slide = e.target.closest(".hero-slide");
      const item = MOCK.hero[+slide.dataset.i];
      e.target.closest('[data-action="play"]') ? openDetail(item) : openDetail(item);
      return;
    }
    const dot = e.target.closest(".dot-btn");
    if (dot) { setHero(+dot.dataset.i); startHeroTimer(); return; }
    if (e.target.closest("#profileBtn")) { openProfiles(); return; }
    const tile = e.target.closest(".profile-tile");
    if (tile) { closeProfiles(tile.dataset.id); return; }
  });

  document.addEventListener("keydown", (e) => {
    if (state.overlayOpen) {
      if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); state.overlayOpen ? closeOverlayIfOpen() : null; }
      else if (e.key === "ArrowLeft") moveFocus(-1, 0);
      else if (e.key === "ArrowRight") moveFocus(1, 0);
      else if (e.key === "ArrowUp") moveFocus(0, -1);
      else if (e.key === "ArrowDown") moveFocus(0, 1);
      return;
    }
    switch (e.key) {
      case "ArrowLeft": moveFocus(-1, 0); e.preventDefault(); break;
      case "ArrowRight": moveFocus(1, 0); e.preventDefault(); break;
      case "ArrowUp": moveFocus(0, -1); e.preventDefault(); break;
      case "ArrowDown": moveFocus(0, 1); e.preventDefault(); break;
      case "Enter": {
        const f = $(".focused");
        if (f) f.click();
        e.preventDefault(); break;
      }
      case "Backspace":
      case "Escape": {
        const ov = $(".overlay.open");
        if (ov && ov.id === "profileOverlay") closeProfiles();
        e.preventDefault(); break;
      }
      case "p": case "P": openProfiles(); e.preventDefault(); break;
    }
  });

  function closeOverlayIfOpen() {
    const d = $("#detailOverlay");
    if (d.classList.contains("open")) closeOverlay();
    else { const p = $("#profileOverlay"); if (p.classList.contains("open")) closeProfiles(); }
  }

  // Hover parity: hovering a card/tile/tab gives it focus (H6), without stealing during keyboard nav on touch
  let hoverLock = false;
  document.addEventListener("mousemove", () => { hoverLock = false; });
  document.addEventListener("mouseover", (e) => {
    if (hoverLock) return;
    const t = e.target.closest(".card, .pill, .nav-tab, .profile-btn, .dot-btn, .profile-tile");
    if (!t || state.overlayOpen) return;
    for (let gi = 0; gi < state.focusGroups.length; gi++) {
      const ii = state.focusGroups[gi].items.indexOf(t);
      if (ii !== -1) { applyFocus(gi, ii); startHeroTimer(); return; }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key.startsWith("Arrow")) hoverLock = true;
  });

  /* ---------------- Init ---------------- */

  function init() {
    renderTopnav();
    $("#hero").innerHTML = MOCK.hero.map(heroSlideHTML).join("") + `<div class="hero-dots" id="heroDots"></div>`;
    renderHeroDots();
    renderShelves();
    buildFocusGroups();
    focusFirst();
    // pause auto-advance when reduced-motion changes
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", startHeroTimer);
    // re-center focus after resize
    window.addEventListener("resize", () => applyFocus(state.groupIndex, state.itemIndex));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
