/* Home Theater | TV-first spatial focus prototype.
   D-pad simulation: Arrow keys move focus, Enter selects, Escape/Backspace goes back,
   P opens Settings at its first section. Mouse hover mirrors focus (H6 parity). */
(function () {
  "use strict";

  const readJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const savedLayout = readJSON("homeTheaterLayout", {});
  const savedPreferences = readJSON("homeTheaterPreferences", {});
  const savedSources = readJSON("homeTheaterSources", []);
  const profilePalette = { brass: "#c4aa82", blue: "#89a9c5", sage: "#8eaa98", rose: "#c58c8b", violet: "#a197bf", teal: "#80aaa5" };
  const savedProfiles = readJSON("homeTheaterProfiles", []);
  const profiles = Array.isArray(savedProfiles) ? savedProfiles.filter(profile => profile && typeof profile.name === "string" && profile.name.trim()).map(profile => ({
    id: String(profile.id || `profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    name: profile.name.trim().slice(0, 28),
    color: Object.hasOwn(profilePalette, profile.color) ? profile.color : "brass",
  })) : [];
  const savedCurrentProfileId = readJSON("homeTheaterCurrentProfile", null);
  const countSetting = (value, allowed, fallback) => allowed.includes(Number(value)) ? Number(value) : fallback;
  const savedOrientation = savedLayout.artworkOrientation === "portrait" ? "portrait" : "landscape";
  const layoutChoices = savedOrientation === "portrait"
    ? { home: [8, 10, 12], catalog: [4, 6, 8], defaultHome: 10, defaultCatalog: 6 }
    : { home: [4, 5, 6], catalog: [2, 3, 4], defaultHome: 5, defaultCatalog: 3 };

  const state = {
    profiles,
    currentProfile: profiles.find(profile => profile.id === savedCurrentProfileId) || profiles[0] || null,
    profileEditId: null,
    heroIndex: 0,
    heroTimer: null,
    view: "home",
    libraryFilter: "All titles",
    discoverGenre: "All genres",
    searchQuery: "",
    sortOrder: "title-asc",
    layout: {
      artworkOrientation: savedOrientation,
      homeCards: countSetting(savedLayout.homeCards, layoutChoices.home, layoutChoices.defaultHome),
      searchColumns: countSetting(savedLayout.searchColumns, layoutChoices.home, layoutChoices.defaultHome),
      catalogColumns: countSetting(savedLayout.catalogColumns, layoutChoices.catalog, layoutChoices.defaultCatalog),
    },
    preferences: {
      theme: ["default", "twilight-cinema", "cyber-rust"].includes(savedPreferences.theme) ? savedPreferences.theme : "default",
      metadataLookup: savedPreferences.metadataLookup === true,
      scanConcurrency: [1, 2, 4].includes(Number(savedPreferences.scanConcurrency)) ? Number(savedPreferences.scanConcurrency) : 1,
      pauseScanDuringPlayback: savedPreferences.pauseScanDuringPlayback !== false,
      artworkStrategy: ["local-first", "metadata-first", "manual"].includes(savedPreferences.artworkStrategy) ? savedPreferences.artworkStrategy : "local-first",
    },
    sources: Array.isArray(savedSources) ? savedSources : [],
    watchlistIds: new Set(readJSON("homeTheaterWatchlist", [])),
    watchedIds: new Set(readJSON("homeTheaterWatched", [])),
    focusGroups: [],       // array of {el, items: [focusables]}
    groupIndex: 0,
    itemIndex: 0,
    overlayOpen: false,
    detailItem: null,
    detailSeason: null,
    detailReturn: null,
    detailDirty: false,
    focusOrigin: null,
  };

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  function initials(name = "") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "HT";
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : parts[0].slice(0, 2).toUpperCase();
  }

  /* ---------------- Render ---------------- */

  function renderTopnav() {
    const nav = $("#topnav");
    nav.innerHTML = `
      <a class="brand" href="#home" aria-label="Home Theater home">
        <svg class="brand-mark" viewBox="0 0 104 100" aria-hidden="true"><path class="brand-mark-case" d="M5 18Q7 10 18 8h65q16 2 18 12v43q-2 9-14 11H19Q7 72 5 63Z"/><path class="brand-mark-glass" d="M12 24q2-6 10-6h43q8 1 9 8v31q-1 7-8 7H21q-8-1-9-8Z"/><circle class="brand-mark-dial" cx="87" cy="26" r="5"/><circle class="brand-mark-button" cx="86" cy="44" r="3.7"/><circle class="brand-mark-button" cx="96" cy="44" r="2.3"/><path class="brand-mark-speaker" d="M82 55v7m6-7v7m6-7v7M52 74v8M52 82 27 97M52 82l25 15M52 82v15"/></svg>
        <span class="brand-wordmark"><span>HOME</span><span>THEATER</span></span>
      </a>
      <div class="nav-links" aria-label="Sections">
        <button class="nav-tab" data-view="home" ${state.view === "home" ? 'aria-current="page"' : ""}>Home</button>
        <button class="nav-tab" data-view="library" ${state.view === "library" ? 'aria-current="page"' : ""}>Library</button>
        <button class="nav-tab" data-view="discover" ${state.view === "discover" ? 'aria-current="page"' : ""}>Discover</button>
        <button class="nav-tab" data-view="search" ${state.view === "search" ? 'aria-current="page"' : ""}>Search</button>
      </div>
      <div class="topnav-actions">
        <button class="profile-btn profile-settings-entry ${state.view === "settings" ? "active" : ""}" id="profileBtn" aria-label="${state.currentProfile ? `Settings and profile | ${escapeHTML(state.currentProfile.name)}` : "Settings and create a profile"}" title="Settings">
          <span class="profile-initials" aria-hidden="true" ${state.currentProfile ? `style="--profile-color:${profilePalette[state.currentProfile.color]}"` : ""}>${state.currentProfile ? initials(state.currentProfile.name) : "＋"}</span>
        </button>
      </div>`;
  }

  function heroSlideHTML(item, i) {
    return `
      <div class="hero-slide ${i === 0 ? "active" : ""}" data-i="${i}">
        <div class="hero-art" aria-hidden="true"><img src="${item.backdrop || item.art}" alt="" fetchpriority="${i === 0 ? "high" : "low"}"></div>
        <div class="hero-scrim"></div>
        <div class="hero-content">
          <div class="eyebrow">FEATURED FILM <span aria-hidden="true">|</span> ${item.year}</div>
          <h1 class="hero-title">${item.title}</h1>
          <div class="hero-type">${item.genres.slice(0, 2).join(" · ")} <span class="hero-divider">|</span> ${item.runtime} <span class="hero-divider">|</span> <span class="chip rating">${item.rating}</span></div>
          <p class="hero-desc">${item.desc}</p>
          <div class="meta-chips">${(item.caps || []).map(c => `<span class="chip">${c}</span>`).join("")}</div>
          <div class="hero-actions" style="margin-top:22px">
            <button class="pill" data-action="play">▶&nbsp;&nbsp;Play</button>
            <button class="pill ghost" data-action="info">More Info</button>
          </div>
        </div>
      </div>`;
  }

  function cardHTML(item, kind, idx) {
    const displayKind = kind === "rank" ? "rank" : state.layout.artworkOrientation === "portrait" ? "poster" : "landscape";
    const artwork = displayKind === "poster" ? item.poster || item.art || item.backdrop : item.backdrop || item.art || item.poster;
    const artworkHasTitle = displayKind === "poster" && Boolean(item.artTitle);
    const rank = kind === "rank" ? `<span class="rank">${idx + 1}</span>` : "";
    const cardSub = item.seasons
      ? `${item.year} | ${item.seasonCount} seasons | ${item.episodeCount} episodes`
      : `${item.year} | ${item.genres[0]} | IMDb ${item.imdbRating?.toFixed(1) || "n/a"}`;
    const cardMetaSecondary = item.seasons
      ? `${item.runtime} | ${item.rating}`
      : `${item.runtime} | ${item.rating} | IMDb ${item.imdbRating?.toFixed(1) || "n/a"}`;
    const accessibleLabel = [item.title, item.year, ...item.genres, item.runtime, item.rating,
      item.imdbRating ? `IMDb ${item.imdbRating.toFixed(1)}` : ""].filter(Boolean).join(", ");
    const progress = item.progress != null && !state.watchedIds.has(item.id)
      ? `<div class="card-progress"><span style="width:${Math.round(item.progress * 100)}%"></span></div>` : "";
    return `
      <button class="card ${displayKind === "poster" ? "poster" : "landscape"} ${item.seasons ? "series-card" : ""} ${artworkHasTitle ? "has-art-title" : ""}" data-id="${item.id}" aria-label="${accessibleLabel}">
        ${rank}
        <div class="card-art">
          <img class="card-artwork" src="${artwork}" alt="" loading="lazy" decoding="async">
          <div class="card-details" aria-hidden="true">
            ${artworkHasTitle ? "" : `<div class="card-detail-title">${item.title}</div>`}
            <div class="card-extra-meta"><span class="card-meta-primary">${item.year} <i>|</i> ${item.genres.join(" | ")}</span><span class="card-meta-secondary">${cardMetaSecondary}</span></div>
            <p>${item.desc}</p>
          </div>
          ${progress}
        </div>
        <div class="card-label" aria-hidden="true">
          <div class="card-title">${item.title}</div>
          <div class="card-sub">${cardSub}</div>
        </div>
      </button>`;
  }

  function renderShelves() {
    const root = $("#shelves");
    const titles = allCatalogTitles();
    const shelves = [
      { title: "Continue Watching", note: "Pick up where you left off", kind: "landscape", ids: titles.filter(item => item.progress > 0 && !state.watchedIds.has(item.id)).map(item => item.id) },
      { title: "Movies", note: "Feature films", kind: "landscape", ids: titles.filter(item => !item.seasons && !item.isAnime).map(item => item.id) },
      { title: "Series", note: "Television series", kind: "landscape", ids: titles.filter(item => item.seasons && !item.isAnime).map(item => item.id) },
      { title: "Anime", note: "Anime movies and series", kind: "landscape", ids: titles.filter(item => item.isAnime).map(item => item.id) },
    ];
    root.innerHTML = shelves.map(sh => `
      <section class="shelf" aria-label="${sh.title}">
        <div class="shelf-head"><div><h2 class="shelf-title">${sh.title}</h2><p class="shelf-note">${sh.note || ""}</p></div></div>
        <div class="shelf-row">
          <button class="shelf-arrow shelf-arrow-prev" type="button" data-shelf-direction="prev" aria-label="Scroll ${sh.title} left" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
          <div class="shelf-track">
          ${sh.ids.length ? sh.ids.map((id, i) => cardHTML(findCard(id), sh.kind === "landscape" ? "landscape" : "poster", i)).join("") : `<p class="shelf-empty">No matching titles yet.</p>`}
          </div>
          <button class="shelf-arrow shelf-arrow-next" type="button" data-shelf-direction="next" aria-label="Scroll ${sh.title} right"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
        </div>
      </section>`).join("");
    $$(".shelf-track").forEach(track => track.addEventListener("scroll", updateShelfArrows, { passive: true }));
    updateShelfArrows();
  }

  function updateShelfArrows() {
    $$(".shelf-row").forEach(row => {
      const track = $(".shelf-track", row);
      const maxScroll = track.scrollWidth - track.clientWidth;
      $("[data-shelf-direction='prev']", row).disabled = track.scrollLeft <= 1;
      $("[data-shelf-direction='next']", row).disabled = maxScroll <= 1 || track.scrollLeft >= maxScroll - 1;
    });
  }

  function scrollShelfArrow(button) {
    const row = button.closest(".shelf-row");
    const track = $(".shelf-track", row);
    const direction = button.dataset.shelfDirection === "next" ? 1 : -1;
    track.scrollBy({ left: direction * Math.max(220, track.clientWidth * 0.82), behavior: "smooth" });
  }

  function catalogCardGrid(items) {
    return `<div class="catalog-grid" id="catalogGrid">${items.length ? sortTitles(items).map((item, i) => cardHTML(item, "landscape", i)).join("") : `<p class="empty-state">No titles match this selection.</p>`}</div>`;
  }

  function allCatalogTitles() {
    const knownIds = new Set(MOCK.films.map(item => item.id));
    const featuredFilms = MOCK.hero.filter(item => !knownIds.has(item.id));
    return [...MOCK.films, ...featuredFilms, ...MOCK.series];
  }

  function runtimeMinutes(value = "") {
    const [, hours = "0", minutes = "0"] = value.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/) || [];
    return Number(hours) * 60 + Number(minutes);
  }

  function sortTitles(items) {
    return [...items].sort((a, b) => {
      switch (state.sortOrder) {
        case "title-desc": return b.title.localeCompare(a.title);
        case "year-new": return b.year - a.year || a.title.localeCompare(b.title);
        case "year-old": return a.year - b.year || a.title.localeCompare(b.title);
        case "imdb-high": return (b.imdbRating || 0) - (a.imdbRating || 0) || a.title.localeCompare(b.title);
        case "imdb-low": return (a.imdbRating || 0) - (b.imdbRating || 0) || a.title.localeCompare(b.title);
        case "runtime-long": return runtimeMinutes(b.runtime) - runtimeMinutes(a.runtime) || a.title.localeCompare(b.title);
        case "runtime-short": return runtimeMinutes(a.runtime) - runtimeMinutes(b.runtime) || a.title.localeCompare(b.title);
        default: return a.title.localeCompare(b.title);
      }
    });
  }

  function sortControl() {
    const options = [["title-asc", "Title, A to Z"], ["title-desc", "Title, Z to A"], ["year-new", "Year, newest first"], ["year-old", "Year, oldest first"], ["imdb-high", "IMDb rating, highest first"], ["imdb-low", "IMDb rating, lowest first"], ["runtime-long", "Runtime, longest first"], ["runtime-short", "Runtime, shortest first"]];
    return `<label class="sort-control"><span>Sort</span><select id="catalogSort" aria-label="Sort titles">${options.map(([value, label]) => `<option value="${value}" ${state.sortOrder === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function searchMatches() {
    const query = state.searchQuery.trim().toLowerCase();
    return allCatalogTitles().filter(item => !query ||
      `${item.title} ${item.year} ${item.genres.join(" ")}`.toLowerCase().includes(query));
  }

  function renderSearchResults() {
    const titles = searchMatches();
    const count = $(".results-count");
    if (count) count.textContent = `${titles.length} ${titles.length === 1 ? "title" : "titles"}`;
    const grid = $("#catalogGrid");
    if (grid) grid.innerHTML = titles.length
      ? sortTitles(titles).map((item, i) => cardHTML(item, "landscape", i)).join("")
      : `<p class="empty-state">No titles match this search. Try a different title, year, or genre.</p>`;
    buildFocusGroups();
    applyLayoutSettings();
  }

  function filterBar(options, selected, attribute) {
    return `<div class="catalog-filters" role="group" aria-label="Filter titles">${options.map(value =>
      `<button class="filter-chip ${selected === value ? "selected" : ""}" data-${attribute}="${value}" aria-pressed="${selected === value}">${value}</button>`
    ).join("")}</div>`;
  }

  function renderLibrary() {
    const all = allCatalogTitles();
    const titles = getLibraryTitles();
    $("#shelves").innerHTML = `
      <section class="catalog-page" aria-label="Your library">
        <header class="catalog-header"><p class="catalog-kicker">YOUR COLLECTION</p><h1>Library</h1><p>${all.length} titles in this sample library</p></header>
        <div class="catalog-toolbar">${filterBar(["All titles", "Continue Watching", "Not started", "Watched", "Watchlist"], state.libraryFilter, "library-filter")}${sortControl()}</div>
        ${catalogCardGrid(titles)}
      </section>`;
  }

  function getLibraryTitles() {
    const all = allCatalogTitles();
    if (state.libraryFilter === "Continue Watching") return all.filter(item => item.progress > 0 && !state.watchedIds.has(item.id));
    if (state.libraryFilter === "Not started") return all.filter(item => item.progress === 0 && !state.watchedIds.has(item.id));
    if (state.libraryFilter === "Watched") return all.filter(item => state.watchedIds.has(item.id));
    if (state.libraryFilter === "Watchlist") return all.filter(item => state.watchlistIds.has(item.id));
    return all;
  }

  function renderDiscover() {
    const genres = ["All genres", ...new Set(allCatalogTitles().flatMap(item => item.genres).sort())];
    const titles = getDiscoverTitles();
    $("#shelves").innerHTML = `
      <section class="catalog-page" aria-label="Discover films">
        <header class="catalog-header"><p class="catalog-kicker">CURATED FOR YOUR NEXT NIGHT IN</p><h1>Discover</h1><p>Browse the sample catalog by genre.</p></header>
        <div class="catalog-toolbar">${filterBar(genres, state.discoverGenre, "discover-genre")}${sortControl()}</div>
        ${catalogCardGrid(titles)}
      </section>`;
  }

  function getDiscoverTitles() {
    return state.discoverGenre === "All genres" ? allCatalogTitles()
      : allCatalogTitles().filter(item => item.genres.includes(state.discoverGenre));
  }

  function renderSearch() {
    const titles = searchMatches();
    $("#shelves").innerHTML = `
      <section class="catalog-page search-page" aria-label="Search films">
        <header class="catalog-header"><p class="catalog-kicker">YOUR FILM LIBRARY</p><h1>Search</h1><p>Find a title, year, or genre.</p></header>
        <label class="search-box"><span aria-hidden="true">⌕</span><input id="catalogSearch" type="search" value="${escapeHTML(state.searchQuery)}" placeholder="Search titles, years, and genres" autocomplete="off" aria-label="Search titles, years, and genres"></label>
        <div class="catalog-toolbar"><p class="results-count" aria-live="polite">${titles.length} ${titles.length === 1 ? "title" : "titles"}</p>${sortControl()}</div>
        ${catalogCardGrid(titles)}
      </section>`;
  }

  function renderView() {
    const hero = $("#hero");
    hero.hidden = state.view !== "home";
    if (state.view === "home") renderShelves();
    else if (state.view === "library") renderLibrary();
    else if (state.view === "discover") renderDiscover();
    else if (state.view === "search") renderSearch();
    else renderSettings();
    applyLayoutSettings();
  }

  function applyLayoutSettings() {
    document.documentElement.dataset.artworkOrientation = state.layout.artworkOrientation;
    $$(".shelf-track").forEach(track => {
      const style = getComputedStyle(track);
      const available = track.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const gap = parseFloat(style.columnGap) || 0;
      const minWidth = state.layout.artworkOrientation === "portrait" ? 96 : 150;
      const width = Math.max(minWidth, (available - gap * (state.layout.homeCards - 1)) / state.layout.homeCards);
      track.style.setProperty("--shelf-card-width", `${Math.floor(width)}px`);
    });
    $$(".catalog-grid").forEach(grid => {
      const configuredColumns = state.view === "search" ? state.layout.searchColumns : state.layout.catalogColumns;
      const viewportCap = window.innerWidth <= 620 ? (state.layout.artworkOrientation === "portrait" ? 3 : 2)
        : window.innerWidth <= 900 ? (state.layout.artworkOrientation === "portrait" ? 5 : 4) : configuredColumns;
      const columns = Math.min(configuredColumns, viewportCap);
      grid.style.setProperty("--catalog-columns", columns);
    });
    updateShelfArrows();
  }

  function persistPreferences() {
    try { localStorage.setItem("homeTheaterPreferences", JSON.stringify(state.preferences)); } catch { /* local storage may be unavailable */ }
  }

  function setTheme(theme) {
    if (!["default", "twilight-cinema", "cyber-rust"].includes(theme)) return;
    state.preferences.theme = theme;
    document.documentElement.dataset.theme = theme;
    persistPreferences();
    $$("[data-theme-choice]").forEach(button => {
      const selected = button.dataset.themeChoice === theme;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      $(".theme-check", button).textContent = selected ? "✓" : "";
    });
    const selectedCard = $(`[data-theme-choice="${theme}"]`);
    const settingsGroup = state.focusGroups.findIndex(group => group.items.includes(selectedCard));
    if (settingsGroup >= 0) applyFocus(settingsGroup, state.focusGroups[settingsGroup].items.indexOf(selectedCard), { scroll: false, origin: "pointer" });
  }

  function renderSettings() {
    const group = (title, key, values, label, selected = state.layout[key]) => `
      <section class="setting-group" aria-label="${title}">
        <div><h3>${title}</h3><p>${label}</p></div>
        <div class="setting-options" role="group" aria-label="${title}">
          ${values.map(value => `<button class="setting-choice ${selected === value ? "selected" : ""}" data-setting="${key}" data-value="${value}" aria-pressed="${selected === value}">${value}</button>`).join("")}
        </div>
      </section>`;
    const themeCards = [
      ["default", "Midnight", "The current Home Theater look", "#050609", "#F5A524", "#ffffff"],
      ["twilight-cinema", "Twilight Cinema", "Soft glass, indigo, apricot", "#111827", "#ff7a00", "#00d2c4"],
      ["cyber-rust", "Cyber-Rust", "Matte steel, rust, industrial teal", "#060708", "#d9531e", "#00f5d4"],
    ];
    const portrait = state.layout.artworkOrientation === "portrait";
    const homeChoices = portrait ? [8, 10, 12] : [4, 5, 6];
    const catalogChoices = portrait ? [4, 6, 8] : [2, 3, 4];
    const sourceDescription = source => source.location === "network"
      ? `${source.deviceName} | ${source.address} | ${source.protocol.toUpperCase()} | ${source.share}${source.subfolder ? `/${source.subfolder}` : ""}`
      : `${source.serverPath} | local to the Home Theater server`;
    const sourceRows = state.sources.length ? state.sources.map(source => `
      <article class="source-row"><span class="source-icon" aria-hidden="true">${source.location === "network" ? "⌁" : "▤"}</span><div class="source-copy"><strong>${escapeHTML(source.name)}</strong><span>${escapeHTML(sourceDescription(source))}</span><small>Saved in this browser | connection not tested</small></div><button class="source-remove" data-remove-source="${escapeHTML(source.id)}" aria-label="Remove ${escapeHTML(source.name)}">Remove</button></article>`).join("")
      : `<div class="source-empty"><strong>No media sources added</strong><span>Add a folder on the Home Theater server or describe a network share hosted by another device.</span></div>`;
    const serverSourceRows = (state.serverSources || []).length
      ? state.serverSources.map(source => {
          const scanning = (state.scanJobs || {})[source.id] === "running";
          const status = escapeHTML(source.status || "unknown");
          const detail = source.status_detail ? ` | ${escapeHTML(source.status_detail)}` : "";
          const lastScan = source.last_scan_at ? ` | scanned ${escapeHTML(String(source.last_scan_at).replace("T", " "))}` : "";
          return `<article class="source-row"><span class="source-icon" aria-hidden="true">▤</span><div class="source-copy"><strong>${escapeHTML(source.name)}</strong><span>${escapeHTML(source.root_path)}</span><small>${status}${detail}${lastScan}${scanning ? " | scanning now…" : ""}</small></div><span class="profile-card-actions"><button class="profile-edit" data-scan-source="${escapeHTML(source.id)}">${scanning ? "Scanning…" : "Scan"}</button><button class="profile-remove" data-remove-server-source="${escapeHTML(source.id)}" aria-label="Remove source ${escapeHTML(source.name)}">Remove</button></span></article>`;
        }).join("")
      : `<div class="source-empty"><strong>No media sources on the server</strong><span>Add a folder below. The server scans it and merges it into the household library.</span></div>`;
    const editingProfile = state.profiles.find(profile => profile.id === state.profileEditId) || null;
    const profileSection = `
      <section class="settings-section" id="profiles"><div class="settings-section-title"><div><p class="catalog-kicker">HOUSEHOLD</p><h2>Profiles</h2><p>Create a viewing identity and choose its color. Profiles have no password.</p></div><span class="source-count">${state.profiles.length} ${state.profiles.length === 1 ? "profile" : "profiles"}</span></div>
        ${state.profiles.length ? `<div class="profile-settings-grid">${state.profiles.map(profile => `<article class="profile-settings-card ${state.currentProfile?.id === profile.id ? "selected" : ""}"><button class="profile-select" data-profile-id="${escapeHTML(profile.id)}" aria-pressed="${state.currentProfile?.id === profile.id}"><span class="profile-settings-avatar" style="--profile-color:${profilePalette[profile.color]}">${initials(profile.name)}</span><span class="profile-settings-copy"><strong>${escapeHTML(profile.name)}</strong><small>${state.currentProfile?.id === profile.id ? "Currently active" : "Passwordless profile"}</small></span></button><span class="profile-card-actions"><button class="profile-edit" data-profile-edit="${escapeHTML(profile.id)}">Edit</button><button class="profile-remove" data-profile-remove="${escapeHTML(profile.id)}" aria-label="Remove ${escapeHTML(profile.name)}">Remove</button></span></article>`).join("")}</div>` : `<div class="profile-empty"><strong>No profiles created yet</strong><span>Add a name below to personalize this device.</span></div>`}
        <form class="profile-form" id="profileForm"><div class="profile-form-heading"><strong>${editingProfile ? "Edit profile" : "Create a profile"}</strong><span>Choose a display name and avatar color.</span></div><label><span>Name</span><input name="profileName" maxlength="28" autocomplete="off" placeholder="Enter a name" value="${editingProfile ? escapeHTML(editingProfile.name) : ""}" required></label><label><span>Avatar color</span><select name="profileColor">${Object.entries(profilePalette).map(([id]) => `<option value="${id}" ${((editingProfile?.color || "brass") === id) ? "selected" : ""}>${id[0].toUpperCase()}${id.slice(1)}</option>`).join("")}</select></label><div class="profile-form-actions"><button class="settings-primary" type="submit">${editingProfile ? "Save profile" : "Add profile"}</button>${editingProfile ? '<button class="profile-cancel-edit" type="button" data-profile-cancel>Cancel</button>' : ""}</div></form>
        <p class="settings-callout"><strong>Security boundary</strong>Profile selection does not require a password. Deleting media remains an administrator-only server action.</p>
      </section>`;
    $("#shelves").innerHTML = `
      <section class="settings-page" aria-label="Settings">
        <header class="settings-page-header"><div><p class="catalog-kicker">YOUR HOME THEATER</p><h1>Settings</h1><p>Shape the experience and organize where your household media lives.</p></div><span class="settings-demo-tag">Prototype settings</span></header>
        <div class="settings-layout">
          <nav class="settings-rail" aria-label="Settings sections">
            <a href="#profiles">Profiles</a><a href="#appearance">Appearance</a><a href="#layout">Browsing layout</a><a href="#sources">Media sources</a><a href="#artwork">Metadata and artwork</a><a href="#performance">Performance</a>${window.HAS_SERVER ? '<a href="#admin">Administration</a>' : ""}
          </nav>
          <div class="settings-content">
            ${profileSection}
            <section class="settings-section" id="appearance"><div class="settings-section-title"><div><p class="catalog-kicker">LOOK AND FEEL</p><h2>Choose a theme</h2></div><span>Saved on this device</span></div>
              <div class="theme-grid">${themeCards.map(([id, name, desc, bg, accent, second]) => `<button class="theme-card ${state.preferences.theme === id ? "selected" : ""}" data-theme-choice="${id}" aria-pressed="${state.preferences.theme === id}"><span class="theme-preview" style="--preview-bg:${bg};--preview-accent:${accent};--preview-secondary:${second}"><i></i><i></i><i></i></span><span class="theme-copy"><strong>${name}</strong><small>${desc}</small></span><span class="theme-check" aria-hidden="true">${state.preferences.theme === id ? "✓" : ""}</span></button>`).join("")}</div>
            </section>
            <section class="settings-section" id="layout"><div class="settings-section-title"><div><p class="catalog-kicker">BROWSE</p><h2>Browsing layout</h2></div></div>
              <section class="setting-group orientation-setting"><div><h3>Artwork shape</h3><p>Choose wide cinematic frames or portrait posters.</p></div><div class="setting-options" role="group" aria-label="Artwork shape"><button class="setting-choice ${!portrait?"selected":""}" data-orientation="landscape" aria-pressed="${!portrait}">Landscape</button><button class="setting-choice ${portrait?"selected":""}" data-orientation="portrait" aria-pressed="${portrait}">Portrait</button></div></section>
              ${group("Home shelves", "homeCards", homeChoices, `Cards per row | ${portrait ? "portrait default 10" : "landscape default 5"}`)}
              ${group("Search results", "searchColumns", homeChoices, `Columns on wide screens | ${portrait ? "portrait default 10" : "landscape default 5"}`)}
              ${group("Library and Discover", "catalogColumns", catalogChoices, `Columns on wide screens | ${portrait ? "portrait default 6" : "landscape default 3"}`)}
              <p class="settings-footnote">Portrait mode doubles the row and grid defaults. Phone and tablet layouts cap columns for readability.</p>
            </section>
            <section class="settings-section" id="sources"><div class="settings-section-title"><div><p class="catalog-kicker">YOUR COLLECTION</p><h2>Media sources</h2><p>Folders from attached drives and network shares can appear in one consolidated library.</p></div><span class="source-count">${(state.serverSources || []).length || state.sources.length} ${((state.serverSources || []).length || state.sources.length) === 1 ? "source" : "sources"}</span></div>
              ${window.HAS_SERVER ? `<div class="source-list">${serverSourceRows}</div><p id="sourceAddStatus" class="source-discovery-note" aria-live="polite"></p>` : `<div class="source-list">${sourceRows}</div>`}
              <form class="source-form local-source-form" id="localSourceForm"><div class="source-form-heading"><strong>Folder on this server</strong><span>${window.HAS_SERVER ? "Scanned and indexed by the Home Theater server" : "For a disk attached to the Debian/Home Theater server"}</span></div><label><span>Optional label</span><input name="sourceName" maxlength="48" placeholder="Movies drive"></label><label class="source-path-field"><span>Absolute path on Home Theater server</span><input name="serverPath" maxlength="240" placeholder="/srv/media/movies" required></label><button class="settings-primary" type="submit">Add server folder</button></form>
              <form class="source-form network-source-form" id="networkSourceForm" ${window.HAS_SERVER ? 'data-demo-only="true"' : ""}><div class="source-form-heading"><strong>Share from another device</strong><span>${window.HAS_SERVER ? "Not implemented yet | this form is demonstration only" : "For a Windows/Linux desktop, NAS, or another server"}</span></div><div class="network-discovery-row"><button type="button" class="source-discover" data-discover-devices>Find devices</button><p id="deviceDiscoveryStatus" class="source-discovery-note">Enter a known host or preview the future server-side discovery flow.</p></div><label><span>Device name</span><input name="deviceName" maxlength="64" placeholder="Media PC or NAS" required></label><label><span>Device address</span><input name="address" maxlength="128" placeholder="media-pc.local or 192.168.1.40" required></label><label><span>Share protocol</span><select name="protocol"><option value="smb">SMB | Windows share</option><option value="nfs">NFS | Linux/NAS export</option></select></label><label><span>Share or export name</span><input name="share" maxlength="128" placeholder="Movies" required></label><label><span>Folder inside share (optional)</span><input name="subfolder" maxlength="180" placeholder="Series/Anime"></label><label><span>Optional label</span><input name="sourceName" maxlength="48" placeholder="Anime collection"></label><button class="settings-primary" type="submit">Add network share</button></form>
              <p class="settings-callout"><strong>How this works in production</strong>The Home Theater server connects to or mounts each approved share, scans its files, and merges them into one library. Device name and IP alone do not grant file access. Share credentials must be entered and stored securely on the server. A browser client cannot access another computer's folders.</p>
            </section>
            <section class="settings-section" id="artwork"><div class="settings-section-title"><div><p class="catalog-kicker">TITLE INFORMATION</p><h2>Metadata and artwork</h2><p>Automatic matching can fill gaps, with manual corrections when a title is missing or misidentified.</p></div></div>
              <label class="settings-select-row"><span><strong>Artwork priority</strong><small>Choose which sources the server should check first.</small></span><select data-pref="artworkStrategy"><option value="local-first" ${state.preferences.artworkStrategy === "local-first" ? "selected" : ""}>Local artwork and NFO first</option><option value="metadata-first" ${state.preferences.artworkStrategy === "metadata-first" ? "selected" : ""}>Metadata provider first</option><option value="manual" ${state.preferences.artworkStrategy === "manual" ? "selected" : ""}>Manual artwork only</option></select></label>
              <label class="settings-toggle-row"><span><strong>Look up unmatched titles</strong><small>Use the server's metadata provider for titles without local details or artwork.</small></span><input type="checkbox" data-pref="metadataLookup" ${state.preferences.metadataLookup ? "checked" : ""}></label>
              <div class="settings-callout"><strong>Missing poster or episode still?</strong>Use local poster files or NFO metadata first, then an optional metadata provider. Keep a readable title fallback and allow a person to choose the match or add artwork. Episode stills can come from provider data or user-supplied images; optional frame extraction should run slowly in the background.</div>
            </section>
            <section class="settings-section" id="performance"><div class="settings-section-title"><div><p class="catalog-kicker">KEEP PLAYBACK RESPONSIVE</p><h2>Performance</h2><p>Scanning and artwork work should stay out of the way when you're watching.</p></div></div>
              <label class="settings-select-row"><span><strong>Background scan parallelism</strong><small>Lower values reduce disk and CPU pressure on this server.</small></span><select data-pref="scanConcurrency"><option value="1" ${state.preferences.scanConcurrency === 1 ? "selected" : ""}>1 task | quiet</option><option value="2" ${state.preferences.scanConcurrency === 2 ? "selected" : ""}>2 tasks | balanced</option><option value="4" ${state.preferences.scanConcurrency === 4 ? "selected" : ""}>4 tasks | faster scans</option></select></label>
              <label class="settings-toggle-row"><span><strong>Pause scans during playback</strong><small>Prioritize smooth playback on the host.</small></span><input type="checkbox" data-pref="pauseScanDuringPlayback" ${state.preferences.pauseScanDuringPlayback ? "checked" : ""}></label>
              <p class="settings-callout"><strong>Graphics hardware is optional</strong>Library indexing, metadata matching, image caching, and browsing do not need a GPU. Prefer direct play when the client supports the file. Hardware acceleration is only a server-side transcoding option and should be enabled only when the GPU, driver, and media format are verified.</p>
            </section>
            ${window.HAS_SERVER ? adminSettingsSection() : ""}
            <p class="settings-footnote">${window.HAS_SERVER
              ? "Connected to the Home Theater server: profiles and media sources are stored on the server. Appearance, layout, and playback preferences stay in this browser."
              : "Theme, layout, profiles, sources, and preferences are saved in this browser. No media is scanned and no provider credentials are configured."}</p>
          </div>
        </div>
      </section>`;
  }

  function adminSettingsSection() {
    const files = state.adminFiles || null;
    const sourceOptions = (state.serverSources || []).map(s =>
      `<option value="${escapeHTML(s.id)}" ${files?.sourceId === s.id ? "selected" : ""}>${escapeHTML(s.name)}</option>`).join("");
    const fileRows = files?.files.length
      ? files.files.map(f => `
        <article class="source-row"><span class="source-icon" aria-hidden="true">▤</span><div class="source-copy"><strong>${escapeHTML(f.title || f.path)}</strong><span>${escapeHTML(f.path)}</span><small>${f.kind} | ${f.mode}${f.deleted ? " | deleted from disk (record kept)" : ""}</small></div>${f.deleted ? "" : `<button class="source-remove" data-delete-file="${escapeHTML(f.id)}" data-file-path="${escapeHTML(f.path)}" aria-label="Delete file ${escapeHTML(f.path)}">Delete file</button>`}</article>`).join("")
      : "";
    return `<section class="settings-section" id="admin">
      <div class="settings-section-title"><div><p class="catalog-kicker">SERVER</p><h2>Administration</h2><p>The administrator password guards real file deletion. It is verified on the server and never stored in plain text.</p></div></div>
      ${state.adminConfigured
        ? `<p class="settings-callout"><strong>Administrator password is set.</strong> Deleting a file from disk requires it. Wrong attempts are rate limited and every attempt is audited without recording the password.</p>`
        : `<form class="source-form" id="adminSetupForm"><div class="source-form-heading"><strong>Set administrator password</strong><span>At least 8 characters. Stored only as a scrypt hash.</span></div><label><span>Password</span><input type="password" name="adminPassword" minlength="8" autocomplete="new-password" required></label><label><span>Repeat password</span><input type="password" name="adminPasswordConfirm" minlength="8" autocomplete="new-password" required></label><button class="settings-primary" type="submit">Set password</button><p id="adminSetupNote" class="source-discovery-note" aria-live="polite"></p></form>`}
      <div class="source-form-heading"><strong>Indexed files</strong><span>Removing a title from the library is on its detail sheet; deleting the actual file happens here.</span></div>
      ${(state.serverSources || []).length
        ? `<div class="network-discovery-row"><select id="adminSourceSelect" aria-label="Choose a source"><option value="">Choose a source…</option>${sourceOptions}</select><button type="button" class="source-discover" data-load-source-files>List files</button></div>`
        : `<p class="source-discovery-note">Add a media source first.</p>`}
      ${fileRows ? `<div class="source-list">${fileRows}</div>` : files ? `<p class="source-discovery-note">No indexed files in this source.</p>` : ""}
    </section>`;
  }

  async function addMediaSource(form) {
    const data = new FormData(form);
    const id = `source-${Date.now()}`;
    if (form.id === "networkSourceForm") {
      const deviceName = String(data.get("deviceName") || "").trim();
      const address = String(data.get("address") || "").trim();
      const share = String(data.get("share") || "").trim();
      if (!deviceName || !address || !share) return;
      state.sources.push({ id, location: "network", name: String(data.get("sourceName") || "").trim() || share, deviceName, address, protocol: data.get("protocol"), share, subfolder: String(data.get("subfolder") || "").trim() });
    } else {
      const serverPath = String(data.get("serverPath") || "").trim();
      if (!serverPath) return;
      const label = String(data.get("sourceName") || "").trim() || serverPath.split("/").filter(Boolean).pop() || "Media folder";
      if (window.HAS_SERVER) {
        form.reset();
        const statusEl = $("#sourceAddStatus");
        try {
          const r = await apiFetch("/api/sources", jsonOptions("POST", { name: label, root_path: serverPath }));
          if (r.ok === 200 && r.body.id) {
            if (statusEl) statusEl.textContent = "Source added. Scanning…";
            await scanServerSource(r.body.id);
          } else if (statusEl) {
            statusEl.textContent = r.body?.detail || "The server rejected this source.";
          }
        } catch {
          if (statusEl) statusEl.textContent = "Could not reach the server.";
        }
        await refreshServerData();
        return;
      }
      state.sources.push({ id, location: "server", name: label, serverPath });
    }
    try { localStorage.setItem("homeTheaterSources", JSON.stringify(state.sources)); } catch { /* local storage may be unavailable */ }
    form.reset();
    renderSettings();
    buildFocusGroups();
  }

  function removeMediaSource(id) {
    state.sources = state.sources.filter(source => source.id !== id);
    try { localStorage.setItem("homeTheaterSources", JSON.stringify(state.sources)); } catch { /* local storage may be unavailable */ }
    renderSettings();
    buildFocusGroups();
  }

  /* ---------------- Server-backed settings & library actions (window.HAS_SERVER) ---------------- */

  async function apiFetch(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const body = await response.json().catch(() => ({}));
    return { ok: response.status, body };
  }

  function jsonOptions(method, payload) {
    return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
  }

  async function refreshCatalog() {
    if (!window.HAS_SERVER) return;
    try {
      const profile = window.HOME_PROFILE_ID();
      const q = profile ? `?profile=${encodeURIComponent(profile)}` : "";
      const r = await apiFetch(`/api/catalog/shaped${q}`);
      if (r.ok) {
        window.MOCK = r.body;
        // When profile-scoped flags are present, the server is the source of truth for watchlist state.
        const items = [...(r.body.films || []), ...(r.body.series || [])];
        if (items.some(it => "inWatchlist" in it)) {
          state.watchlistIds = new Set(items.filter(it => it.inWatchlist).map(it => it.id));
          try { localStorage.setItem("homeTheaterWatchlist", JSON.stringify([...state.watchlistIds])); } catch { /* storage may be unavailable */ }
        }
        renderView();
        buildFocusGroups();
        renderTopnav();
      }
    } catch { /* keep showing the previous catalog on transient errors */ }
  }

  async function refreshServerData() {
    if (!window.HAS_SERVER) return;
    try {
      const [sources, admin, profiles] = await Promise.all([
        apiFetch("/api/sources"), apiFetch("/api/admin/status"), apiFetch("/api/profiles"),
      ]);
      if (sources.ok) state.serverSources = sources.body.sources || [];
      if (admin.ok) state.adminConfigured = Boolean(admin.body.configured);
      if (profiles.ok) {
        // Server profiles become the household list; ids are stable server ids.
        state.profiles = (profiles.body.profiles || []).map(p => ({ id: p.id, name: p.name, color: p.color || "brass" }));
        const currentId = JSON.parse(localStorage.getItem("homeTheaterCurrentProfile") || "null");
        state.currentProfile = state.profiles.find(p => p.id === currentId) || state.profiles[0] || null;
        if (state.currentProfile) {
          try { localStorage.setItem("homeTheaterCurrentProfile", JSON.stringify(state.currentProfile.id)); } catch { /* storage may be unavailable */ }
        }
        saveProfiles();
      }
      if (state.view === "settings") { renderSettings(); buildFocusGroups(); }
    } catch { /* transient server error; the UI keeps its last known state */ }
  }

  async function scanServerSource(sourceId) {
    state.scanJobs = state.scanJobs || {};
    state.scanJobs[sourceId] = "running";
    renderSettings();
    try {
      const r = await apiFetch(`/api/sources/${encodeURIComponent(sourceId)}/scan`, jsonOptions("POST", {}));
      const jobId = r.body?.job_id;
      if (!jobId) throw new Error("no job");
      for (;;) {
        const job = await apiFetch(`/api/scan-jobs/${encodeURIComponent(jobId)}`);
        if (job.ok !== 200 || job.body.state !== "running") {
          state.scanJobs[sourceId] = job.body.state === "done" ? "done" : "error";
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 700));
      }
    } catch {
      state.scanJobs[sourceId] = "error";
    }
    await refreshServerData();
    await refreshCatalog();
  }

  async function removeServerSource(sourceId) {
    const source = (state.serverSources || []).find(s => s.id === sourceId);
    const name = source?.name || "this source";
    if (!window.confirm(`Remove "${name}" from the library? Index records are deleted, but media files on disk are NOT deleted.`)) return;
    try {
      await apiFetch(`/api/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
    } catch { /* server may be transiently unreachable */ }
    await refreshServerData();
    await refreshCatalog();
  }

  async function loadSourceFiles(sourceId) {
    try {
      const r = await apiFetch(`/api/sources/${encodeURIComponent(sourceId)}/files`);
      state.adminFiles = { sourceId, files: r.ok ? (r.body.files || []) : [] };
    } catch {
      state.adminFiles = { sourceId, files: [] };
    }
    renderSettings();
    buildFocusGroups();
  }

  async function deleteServerFile(fileId, filePath) {
    if (!window.confirm(`Delete this file from disk?\n\n${filePath}\n\nThis permanently removes the file. Removing a catalog entry never does this.`)) return;
    const password = window.prompt(`Administrator password required to delete:\n${filePath}`);
    if (password == null) return;
    try {
      const r = await apiFetch(`/api/files/${encodeURIComponent(fileId)}/delete`,
        jsonOptions("POST", { admin_password: password, confirm_path: filePath }));
      if (r.ok === 200) {
        await refreshCatalog();
        if (state.adminFiles?.sourceId) await loadSourceFiles(state.adminFiles.sourceId);
      } else if (r.ok === 403) {
        window.alert("Administrator authorization failed. The attempt has been recorded in the audit log.");
      } else if (r.ok === 429) {
        window.alert("Too many attempts. Try again shortly.");
      } else if (r.ok === 409) {
        window.alert("No administrator password is configured yet. Set one in the Administration section first.");
      } else {
        window.alert(r.body?.detail || "Deletion failed.");
      }
    } catch {
      window.alert("Could not reach the server.");
    }
  }

  async function setupAdminPassword(form) {
    const data = new FormData(form);
    const password = String(data.get("adminPassword") || "");
    const confirm = String(data.get("adminPasswordConfirm") || "");
    const note = $("#adminSetupNote");
    if (password.length < 8) { note.textContent = "Use at least 8 characters."; return; }
    if (password !== confirm) { note.textContent = "The two passwords do not match."; return; }
    try {
      const r = await apiFetch("/api/admin/setup", jsonOptions("POST", { password }));
      note.textContent = r.ok === 200 ? "Administrator password set." :
        r.ok === 409 ? "An administrator password is already configured." :
        r.body?.detail || "Setup failed.";
      if (r.ok === 200) { form.reset(); await refreshServerData(); }
    } catch {
      note.textContent = "Could not reach the server.";
    }
  }

  function saveLayout() {
    try { localStorage.setItem("homeTheaterLayout", JSON.stringify(state.layout)); } catch { /* local storage may be unavailable */ }
  }

  function updateLayout(setting, value) {
    state.layout[setting] = Number(value);
    saveLayout();
    $$(".setting-choice").forEach(button => {
      const selected = button.dataset.setting === setting && Number(button.dataset.value) === state.layout[setting];
      if (button.dataset.setting === setting) {
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
    });
    applyLayoutSettings();
  }

  function setArtworkOrientation(orientation) {
    if (!["landscape", "portrait"].includes(orientation) || orientation === state.layout.artworkOrientation) return;
    state.layout.artworkOrientation = orientation;
    state.layout.homeCards = orientation === "portrait" ? state.layout.homeCards * 2 : state.layout.homeCards / 2;
    state.layout.searchColumns = orientation === "portrait" ? state.layout.searchColumns * 2 : state.layout.searchColumns / 2;
    state.layout.catalogColumns = orientation === "portrait" ? state.layout.catalogColumns * 2 : state.layout.catalogColumns / 2;
    state.layout.homeCards = countSetting(state.layout.homeCards, orientation === "portrait" ? [8, 10, 12] : [4, 5, 6], orientation === "portrait" ? 10 : 5);
    state.layout.searchColumns = countSetting(state.layout.searchColumns, orientation === "portrait" ? [8, 10, 12] : [4, 5, 6], orientation === "portrait" ? 10 : 5);
    state.layout.catalogColumns = countSetting(state.layout.catalogColumns, orientation === "portrait" ? [4, 6, 8] : [2, 3, 4], orientation === "portrait" ? 6 : 3);
    saveLayout();
    renderView();
    buildFocusGroups();
    applyLayoutSettings();
  }

  function selectProfile(profileId) {
    const selected = state.profiles.find(profile => profile.id === profileId);
    if (!selected) return;
    state.currentProfile = selected;
    try { localStorage.setItem("homeTheaterCurrentProfile", JSON.stringify(selected.id)); } catch { /* local storage may be unavailable */ }
    renderTopnav();
    renderSettings();
    buildFocusGroups();
    if (window.HAS_SERVER) refreshCatalog(); // progress rows follow the selected profile
  }

  function saveProfiles() {
    try { localStorage.setItem("homeTheaterProfiles", JSON.stringify(state.profiles)); } catch { /* local storage may be unavailable */ }
  }

  function editProfile(profileId) {
    state.profileEditId = profileId;
    renderSettings();
    buildFocusGroups();
    const nameField = $("#profileForm [name='profileName']");
    nameField?.focus();
  }

  async function removeProfile(profileId) {
    const profile = state.profiles.find(entry => entry.id === profileId);
    if (!profile || !window.confirm(`Remove the ${profile.name} profile from this device?`)) return;
    if (window.HAS_SERVER) {
      try { await apiFetch(`/api/profiles/${encodeURIComponent(profileId)}`, { method: "DELETE" }); } catch { /* transient */ }
      await refreshServerData();
      if (state.currentProfile?.id === profileId) {
        state.currentProfile = state.profiles[0] || null;
        try { localStorage.setItem("homeTheaterCurrentProfile", JSON.stringify(state.currentProfile?.id || null)); } catch { /* storage may be unavailable */ }
      }
      renderTopnav();
      renderSettings();
      buildFocusGroups();
      return;
    }
    state.profiles = state.profiles.filter(entry => entry.id !== profileId);
    if (state.currentProfile?.id === profileId) state.currentProfile = state.profiles[0] || null;
    if (state.profileEditId === profileId) state.profileEditId = null;
    saveProfiles();
    try { localStorage.setItem("homeTheaterCurrentProfile", JSON.stringify(state.currentProfile?.id || null)); } catch { /* local storage may be unavailable */ }
    renderTopnav();
    renderSettings();
    buildFocusGroups();
  }

  async function submitProfile(form) {
    const data = new FormData(form);
    const name = String(data.get("profileName") || "").trim().slice(0, 28);
    const color = Object.hasOwn(profilePalette, data.get("profileColor")) ? data.get("profileColor") : "brass";
    const editing = state.profiles.find(profile => profile.id === state.profileEditId);
    if (!name) return;
    if (window.HAS_SERVER) {
      // Server-backed profiles (passwordless, keyed by stable server ids).
      try {
        if (editing) {
          await apiFetch(`/api/profiles/${encodeURIComponent(editing.id)}`, jsonOptions("PATCH", { name, color }));
        } else {
          const r = await apiFetch("/api/profiles", jsonOptions("POST", { name, color }));
          const newId = r.ok === 200 ? r.body?.id : null;
          await refreshServerData();
          if (newId && !state.currentProfile) selectProfile(newId);
        }
        state.profileEditId = null;
        renderTopnav();
      } catch { /* transient server error; form keeps its values */ }
      return;
    }
    if (state.profiles.some(profile => profile.id !== editing?.id && profile.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      const input = form.elements.profileName;
      input.setCustomValidity("A profile with that name already exists.");
      input.reportValidity();
      input.addEventListener("input", () => input.setCustomValidity(""), { once: true });
      return;
    }
    if (editing) {
      editing.name = name;
      editing.color = color;
      if (state.currentProfile?.id === editing.id) state.currentProfile = editing;
    } else {
      const profile = { id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, color };
      state.profiles.push(profile);
      if (!state.currentProfile) state.currentProfile = profile;
    }
    state.profileEditId = null;
    saveProfiles();
    try { localStorage.setItem("homeTheaterCurrentProfile", JSON.stringify(state.currentProfile?.id || null)); } catch { /* local storage may be unavailable */ }
    renderTopnav();
    renderSettings();
    buildFocusGroups();
  }

  function switchView(view, { origin = "pointer" } = {}) {
    if (!["home", "library", "discover", "search", "settings"].includes(view)) return;
    state.view = view;
    const profileButton = $("#profileBtn");
    if (profileButton) profileButton.classList.toggle("active", view === "settings");
    $$(".nav-tab").forEach(button => {
      if (button.dataset.view === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    stopHeroTimer();
    renderView();
    buildFocusGroups();
    if (view === "search") $("#catalogSearch").focus();
    else if (origin === "keyboard") focusFirst();
    else {
      $$(".focused").forEach(el => el.classList.remove("focused"));
      state.groupIndex = 0;
      state.itemIndex = state.focusGroups[0].items.indexOf(view === "settings" ? $("#profileBtn") : $(`#topnav [data-view="${view}"]`));
      state.focusOrigin = "pointer";
    }
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
    const groups = [{ items: [...$$("#topnav .nav-tab"), $("#profileBtn")] }];
    if (state.view === "home") {
      groups.push({ items: $$("#heroDots .dot-btn") });
      groups.push({ items: $$("#hero .hero-actions .pill") });
      groups.push(...$$(".shelf").map(sh => ({ items: $$(".card", sh), rowEl: $(".shelf-track", sh) })));
    } else if (state.view === "settings") {
      const controls = $$(".settings-page a, .settings-page button, .settings-page select, .settings-page input");
      if (controls.length) groups.push({ items: controls });
    } else {
      const filters = $$(".filter-chip");
      if (filters.length) groups.push({ items: filters });
      const sortControl = $("#catalogSort");
      if (sortControl) groups.push({ items: [sortControl] });
      const cards = $$("#catalogGrid .card");
      if (cards.length) groups.push({ items: cards });
    }
    state.focusGroups = groups.filter(g => g.items.length);
    state.focusGroups.flatMap(group => group.items).forEach(el => {
      if (el.dataset.pointerExitBound) return;
      el.dataset.pointerExitBound = "true";
      el.addEventListener("mouseleave", () => {
        if (state.focusOrigin === "pointer" && el.classList.contains("focused")) {
          el.classList.remove("focused");
          state.focusOrigin = null;
          lastHoveredTarget = null;
        }
      });
    });
  }

  function applyFocus(gi, ii, { scroll = true, origin = "keyboard" } = {}) {
    const g = state.focusGroups[gi];
    if (!g) return;
    const el = g.items[ii];
    if (!el) return;
    if (state.groupIndex === gi && state.itemIndex === ii && el.classList.contains("focused")) return;
    $$(".focused").forEach(el => el.classList.remove("focused"));
    el.classList.add("focused");
    state.groupIndex = gi; state.itemIndex = ii;
    state.focusOrigin = origin;
    // keep focused card centered in its track
    if (g.rowEl && scroll) {
      const r = el.getBoundingClientRect(), t = g.rowEl.getBoundingClientRect();
      const delta = (r.left - t.left) - (t.width - r.width) / 2;
      g.rowEl.scrollBy({ left: delta, behavior: "smooth" });
    }
    // pause hero auto-advance while user navigates chrome
    stopHeroTimer();
  }

  function focusFirst() {
    if (state.view === "search") { $("#catalogSearch")?.focus(); return; }
    applyFocus(state.view === "home" ? 2 : 1, 0);
    if (state.view === "home") startHeroTimer();
  }

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
    state.detailItem = item;
    state.detailSeason = item.seasons?.[0]?.number ?? null;
    state.detailReturn = { groupIndex: state.groupIndex, itemIndex: state.itemIndex, origin: state.focusOrigin || "keyboard", itemId: item.id };
    state.detailDirty = false;
    $("#detailTitle").textContent = item.title;
    const metadata = [item.type || "Movie", item.year, ...(item.genres || []), item.runtime, item.rating, item.imdbRating ? `IMDb ${item.imdbRating.toFixed(1)}` : ""].filter(Boolean);
    $("#detailType").textContent = metadata.join(" | ");
    $("#detailDesc").textContent = item.desc || "MOCK item | description not available in the prototype.";
    $("#detailArtwork").src = item.backdrop || item.poster || item.art || "";
    $("#detailArtwork").alt = `${item.title} artwork`;
    const removeBtn = $("#detailRemoveBtn");
    if (removeBtn) removeBtn.hidden = !window.HAS_SERVER;
    $("#detailFeedback").textContent = item.seasons ? "Series guide | sample episode data." : "Prototype actions use sample data.";
    renderSeriesBrowser(item);
    updateDetailActionButtons();
    ov.classList.add("open");
    state.overlayOpen = true;
    stopHeroTimer();
    buildOverlayGroup();
  }

  function renderSeriesBrowser(item) {
    const browser = $("#seriesBrowser");
    if (!item?.seasons?.length) {
      browser.hidden = true;
      return;
    }
    browser.hidden = false;
    const season = item.seasons.find(entry => entry.number === state.detailSeason) || item.seasons[0];
    state.detailSeason = season.number;
    $("#seriesEpisodeCount").textContent = `Season ${season.number} | ${season.episodeCount} episodes | ${season.episodes.length} sample tiles`;
    $("#seasonSelector").innerHTML = item.seasons.map(entry =>
      `<button class="season-choice ${entry.number === season.number ? "selected" : ""}" type="button" data-season-number="${entry.number}" aria-pressed="${entry.number === season.number}">Season ${entry.number}</button>`
    ).join("");
    $("#episodeGrid").innerHTML = season.episodes.map(episode => `
      <button class="episode-card" type="button" data-episode-number="${episode.number}" aria-label="Play ${escapeHTML(item.title)} Season ${season.number} Episode ${episode.number}, ${escapeHTML(episode.title)}">
        <span class="episode-art"><img src="${episode.art}" alt="" loading="lazy" decoding="async"><span class="episode-play-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.8v14.4L19 12 7 4.8Z"/></svg></span></span>
        <span class="episode-copy"><span class="episode-meta">Episode ${String(episode.number).padStart(2, "0")} | ${episode.runtime}</span><strong>${escapeHTML(episode.title)}</strong><span class="episode-description">${escapeHTML(episode.desc)}</span></span>
      </button>`).join("");
  }

  function buildOverlayGroup() {
    while (state.focusGroups[state.focusGroups.length - 1]?.overlay) state.focusGroups.pop();
    state.focusGroups.push({ items: $$("#detailOverlay [data-detail-action]"), overlay: true });
    if (state.detailItem?.seasons?.length) {
      state.focusGroups.push({ items: $$("#seasonSelector [data-season-number]"), overlay: true });
      state.focusGroups.push({ items: $$("#episodeGrid [data-episode-number]"), overlay: true });
    }
    applyFocus(state.focusGroups.length - (state.detailItem?.seasons?.length ? 3 : 1), 0);
  }

  function closeOverlay({ restoreFocus = true } = {}) {
    $("#detailOverlay").classList.remove("open");
    while (state.focusGroups[state.focusGroups.length - 1]?.overlay) state.focusGroups.pop();
    state.overlayOpen = false;
    const changedItemId = state.detailDirty ? state.detailReturn?.itemId : null;
    state.detailItem = null;
    state.detailSeason = null;
    if (state.detailDirty) {
      renderView();
      buildFocusGroups();
      applyLayoutSettings();
    }
    if (restoreFocus && state.detailReturn && state.focusGroups[state.detailReturn.groupIndex]) {
      const group = state.focusGroups[state.detailReturn.groupIndex];
      const matchingCard = changedItemId ? group.items.findIndex(el => el.dataset.id === changedItemId) : -1;
      applyFocus(state.detailReturn.groupIndex, matchingCard >= 0 ? matchingCard : Math.min(state.detailReturn.itemIndex, group.items.length - 1), { origin: state.detailReturn.origin });
    } else if (!restoreFocus) {
      $$(".focused").forEach(el => el.classList.remove("focused"));
      state.focusOrigin = null;
    }
    state.detailReturn = null;
    state.detailDirty = false;
    if (state.view === "search" && restoreFocus) $("#catalogSearch")?.focus();
  }

  function firstPlayableUrl(item) {
    if (!item) return null;
    if (item.seasons?.length) {
      for (const season of item.seasons) {
        for (const episode of season.episodes || []) {
          if (episode.stream) return window.HOME_PLAYER_URL(item, season.number, episode.number);
        }
      }
      return null;
    }
    return item.stream ? window.HOME_PLAYER_URL(item) : null;
  }

  function handleDetailAction(action) {
    const item = state.detailItem;
    if (!item) return;
    if (action === "play") {
      if (window.HAS_SERVER) {
        const url = firstPlayableUrl(item);
        if (url) { window.location.href = url; return; }
        $("#detailFeedback").textContent = item.seasons
          ? "No playable episode file is indexed for this series yet."
          : "No playable file is indexed for this title yet.";
        return;
      }
      $("#detailFeedback").textContent = item.seasons
        ? "Series playback is not connected in this prototype."
        : "Playback is not connected in this prototype.";
      return;
    }
    if (action === "remove") {
      if (!window.HAS_SERVER) return;
      if (!window.confirm(`Remove "${item.title}" from the library?\n\nCatalog records are removed. Media files on disk are NOT deleted.`)) return;
      $("#detailFeedback").textContent = "Removing from the library…";
      apiFetch(`/api/catalog/${encodeURIComponent(item.id)}/remove`, jsonOptions("POST", {}))
        .then(r => {
          if (r.ok === 200) {
            $("#detailFeedback").textContent = r.body?.note || "Removed from the library.";
            refreshCatalog();
          } else {
            $("#detailFeedback").textContent = r.body?.detail || "Removal failed.";
          }
        })
        .catch(() => { $("#detailFeedback").textContent = "Could not reach the server."; });
      return;
    }
    if (action === "watchlist" && window.HAS_SERVER) {
      const profile = window.HOME_PROFILE_ID();
      if (profile) {
        const currently = state.watchlistIds.has(item.id);
        // optimistic toggle for immediate UI feedback; the catalog refresh re-syncs from the server
        if (currently) state.watchlistIds.delete(item.id);
        else state.watchlistIds.add(item.id);
        state.detailDirty = true;
        updateDetailActionButtons();
        $("#detailFeedback").textContent = currently ? "Removed from Watchlist." : "Added to Watchlist.";
        apiFetch(`/api/watchlist/${encodeURIComponent(profile)}/${encodeURIComponent(item.id)}`,
          { method: currently ? "DELETE" : "PUT" })
          .then(() => refreshCatalog())
          .catch(() => { $("#detailFeedback").textContent = "Could not reach the server."; });
        return;
      }
      // no active profile: fall through to the browser-local behavior below
    }
    const collection = action === "watchlist" ? state.watchlistIds : state.watchedIds;
    const storageKey = action === "watchlist" ? "homeTheaterWatchlist" : "homeTheaterWatched";
    if (collection.has(item.id)) collection.delete(item.id);
    else collection.add(item.id);
    state.detailDirty = true;
    try { localStorage.setItem(storageKey, JSON.stringify([...collection])); } catch { /* local storage may be unavailable */ }
    if (window.HAS_SERVER && action === "watched") {
      // Watched state also syncs to the server so Continue Watching stays correct.
      const profile = window.HOME_PROFILE_ID();
      if (profile) {
        apiFetch(`/api/playback/${encodeURIComponent(profile)}/${encodeURIComponent(item.id)}`,
          jsonOptions("PUT", { position_sec: 0, duration_sec: 0, watched: collection.has(item.id) }))
          .then(() => refreshCatalog()).catch(() => { /* transient */ });
      }
    }
    updateDetailActionButtons();
    $("#detailFeedback").textContent = action === "watchlist"
      ? (collection.has(item.id) ? "Added to Watchlist." : "Removed from Watchlist.")
      : (collection.has(item.id) ? "Marked as watched." : "Removed from Watched.");
  }

  function updateDetailActionButtons() {
    const item = state.detailItem;
    const watchlist = $("[data-detail-action='watchlist']");
    const watched = $("[data-detail-action='watched']");
    if (!item || !watchlist || !watched) return;
    const inWatchlist = state.watchlistIds.has(item.id);
    const isWatched = state.watchedIds.has(item.id);
    watchlist.setAttribute("aria-pressed", String(inWatchlist));
    watchlist.setAttribute("aria-label", inWatchlist ? "Remove from watchlist" : "Add to watchlist");
    watchlist.title = inWatchlist ? "Remove from watchlist" : "Add to watchlist";
    watchlist.classList.toggle("active", inWatchlist);
    watched.setAttribute("aria-pressed", String(isWatched));
    watched.setAttribute("aria-label", isWatched ? "Mark as unwatched" : "Mark as watched");
    watched.title = isWatched ? "Mark as unwatched" : "Mark as watched";
    watched.classList.toggle("active", isWatched);
  }

  /* ---------------- Events ---------------- */

  function findCard(id) {
    return MOCK.films.find(it => it.id === id) || MOCK.series.find(it => it.id === id) || MOCK.hero.find(h => h.id === id);
  }

  document.addEventListener("click", (e) => {
    const homeLink = e.target.closest(".brand");
    if (homeLink) { e.preventDefault(); switchView("home"); return; }
    const navTab = e.target.closest(".nav-tab");
    if (navTab) { switchView(navTab.dataset.view, { origin: e.detail === 0 ? "keyboard" : "pointer" }); return; }
    const shelfArrow = e.target.closest(".shelf-arrow");
    if (shelfArrow) { scrollShelfArrow(shelfArrow); return; }
    const seasonChoice = e.target.closest("[data-season-number]");
    if (seasonChoice && state.detailItem?.seasons) {
      state.detailSeason = Number(seasonChoice.dataset.seasonNumber);
      renderSeriesBrowser(state.detailItem);
      buildOverlayGroup();
      return;
    }
    const episodeChoice = e.target.closest("[data-episode-number]");
    if (episodeChoice && state.detailItem?.seasons) {
      const season = state.detailItem.seasons.find(entry => entry.number === state.detailSeason);
      const episode = season?.episodes.find(entry => entry.number === Number(episodeChoice.dataset.episodeNumber));
      if (episode) {
        if (window.HAS_SERVER && episode.stream) {
          window.location.href = window.HOME_PLAYER_URL(state.detailItem, state.detailSeason, episode.number);
          return;
        }
        $("#detailFeedback").textContent = `${state.detailItem.title} | S${state.detailSeason} E${episode.number} | playback is not connected in this prototype.`;
      }
      return;
    }
    const libraryFilter = e.target.closest("[data-library-filter]");
    if (libraryFilter) {
      state.libraryFilter = libraryFilter.dataset.libraryFilter;
      renderView(); buildFocusGroups();
      state.groupIndex = 1;
      state.itemIndex = $$(".filter-chip").findIndex(button => button.dataset.libraryFilter === state.libraryFilter);
      return;
    }
    const discoverGenre = e.target.closest("[data-discover-genre]");
    if (discoverGenre) {
      state.discoverGenre = discoverGenre.dataset.discoverGenre;
      renderView(); buildFocusGroups();
      state.groupIndex = 1;
      state.itemIndex = $$(".filter-chip").findIndex(button => button.dataset.discoverGenre === state.discoverGenre);
      state.focusOrigin = null;
      return;
    }
    if (e.target.closest("#profileBtn")) {
      switchView("settings", { origin: e.detail === 0 ? "keyboard" : "pointer" });
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
      return;
    }
    const themeChoice = e.target.closest("[data-theme-choice]");
    if (themeChoice) { setTheme(themeChoice.dataset.themeChoice); return; }
    const orientationChoice = e.target.closest("[data-orientation]");
    if (orientationChoice) { setArtworkOrientation(orientationChoice.dataset.orientation); return; }
    const profileEdit = e.target.closest("[data-profile-edit]");
    if (profileEdit) { editProfile(profileEdit.dataset.profileEdit); return; }
    const profileRemove = e.target.closest("[data-profile-remove]");
    if (profileRemove) { removeProfile(profileRemove.dataset.profileRemove); return; }
    if (e.target.closest("[data-profile-cancel]")) { state.profileEditId = null; renderSettings(); buildFocusGroups(); return; }
    const profileChoice = e.target.closest("[data-profile-id]");
    if (profileChoice) { selectProfile(profileChoice.dataset.profileId); return; }
    const removeSource = e.target.closest("[data-remove-source]");
    if (removeSource) { removeMediaSource(removeSource.dataset.removeSource); return; }
    const scanSourceBtn = e.target.closest("[data-scan-source]");
    if (scanSourceBtn) { scanServerSource(scanSourceBtn.dataset.scanSource); return; }
    const removeServerSourceBtn = e.target.closest("[data-remove-server-source]");
    if (removeServerSourceBtn) { removeServerSource(removeServerSourceBtn.dataset.removeServerSource); return; }
    const loadFilesBtn = e.target.closest("[data-load-source-files]");
    if (loadFilesBtn) {
      const select = $("#adminSourceSelect");
      if (select?.value) loadSourceFiles(select.value);
      return;
    }
    const deleteFileBtn = e.target.closest("[data-delete-file]");
    if (deleteFileBtn) { deleteServerFile(deleteFileBtn.dataset.deleteFile, deleteFileBtn.dataset.filePath); return; }
    if (e.target.closest("[data-discover-devices]")) {
      $("#deviceDiscoveryStatus").textContent = "Network discovery is not connected in this prototype. In production, the Home Theater server will discover supported shares or accept a known address.";
      return;
    }
    const setting = e.target.closest(".setting-choice");
    if (setting) { updateLayout(setting.dataset.setting, setting.dataset.value); return; }
    if (e.target === $("#detailOverlay")) { closeOverlay({ restoreFocus: false }); return; }
    const detailAction = e.target.closest("[data-detail-action]");
    if (detailAction) { handleDetailAction(detailAction.dataset.detailAction); return; }
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
  });

  document.addEventListener("input", (e) => {
    if (e.target.matches("#catalogSearch")) {
      state.searchQuery = e.target.value;
      renderSearchResults();
    }
  });

  document.addEventListener("submit", (e) => {
    if (e.target.matches("#profileForm")) {
      e.preventDefault();
      submitProfile(e.target);
      return;
    }
    if (e.target.matches("#adminSetupForm")) {
      e.preventDefault();
      setupAdminPassword(e.target);
      return;
    }
    if (!e.target.matches("#localSourceForm, #networkSourceForm")) return;
    e.preventDefault();
    addMediaSource(e.target);
  });

  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-pref]")) {
      const key = e.target.dataset.pref;
      state.preferences[key] = e.target.type === "checkbox" ? e.target.checked
        : key === "scanConcurrency" ? Number(e.target.value) : e.target.value;
      persistPreferences();
    }
    if (e.target.matches("#catalogSort")) {
      state.sortOrder = e.target.value;
      const titles = state.view === "library" ? getLibraryTitles()
        : state.view === "discover" ? getDiscoverTitles() : searchMatches();
      const grid = $("#catalogGrid");
      grid.innerHTML = titles.length
        ? sortTitles(titles).map((item, i) => cardHTML(item, "landscape", i)).join("")
        : `<p class="empty-state">No titles match this selection.</p>`;
      buildFocusGroups();
      const sortIndex = state.focusGroups.findIndex(group => group.items.includes($("#catalogSort")));
      if (sortIndex >= 0) { state.groupIndex = sortIndex; state.itemIndex = 0; }
      applyLayoutSettings();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
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
        if (state.view === "settings") switchView("home", { origin: "keyboard" });
        e.preventDefault(); break;
      }
      case "p": case "P": switchView("settings", { origin: "keyboard" }); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })); e.preventDefault(); break;
    }
  });

  function closeOverlayIfOpen() {
    const d = $("#detailOverlay");
    if (d.classList.contains("open")) closeOverlay();
    else { /* No profile modal is needed; profile selection lives in Settings. */ }
  }

  // Hover parity: hovering a card/tile/tab gives it focus (H6), without stealing during keyboard nav on touch
  let hoverLock = false;
  let lastHoveredTarget = null;
  document.addEventListener("mousemove", () => { hoverLock = false; });
  document.addEventListener("mouseover", (e) => {
    const t = e.target.closest(".card, .pill, .nav-tab, .profile-btn, .dot-btn, .filter-chip, .setting-choice, .detail-action, .shelf-arrow, .season-choice, .episode-card, .settings-page a, .theme-card, .profile-select, .profile-edit, .profile-remove, .profile-cancel-edit, .source-remove, .settings-primary, #catalogSort");
    if (!t) { lastHoveredTarget = null; return; }
    if (hoverLock || state.overlayOpen || t === lastHoveredTarget) return;
    lastHoveredTarget = t;
    for (let gi = 0; gi < state.focusGroups.length; gi++) {
      const ii = state.focusGroups[gi].items.indexOf(t);
      if (ii !== -1) { applyFocus(gi, ii, { scroll: !t.matches(".card"), origin: "pointer" }); if (state.view === "home" && !t.matches(".card")) startHeroTimer(); return; }
    }
  });
  document.addEventListener("mouseout", (e) => {
    const t = e.target.closest(".card, .pill, .nav-tab, .profile-btn, .dot-btn, .filter-chip, .setting-choice, .detail-action, .shelf-arrow, .season-choice, .episode-card, .settings-page a, .theme-card, .profile-select, .profile-edit, .profile-remove, .profile-cancel-edit, .source-remove, .settings-primary, #catalogSort");
    if (t && !t.contains(e.relatedTarget)) {
      lastHoveredTarget = null;
      if (state.focusOrigin === "pointer" && t.classList.contains("focused")) {
        t.classList.remove("focused");
        state.focusOrigin = null;
        lastHoveredTarget = null;
      }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key.startsWith("Arrow")) hoverLock = true;
  });

  /* ---------------- Init ---------------- */

  function init() {
    document.documentElement.dataset.theme = state.preferences.theme;
    renderTopnav();
    $("#hero").innerHTML = MOCK.hero.map(heroSlideHTML).join("") + `<div class="hero-dots" id="heroDots"></div>`;
    renderHeroDots();
    renderView();
    buildFocusGroups();
    focusFirst();
    // pause auto-advance when reduced-motion changes
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", startHeroTimer);
    // re-center focus after resize
    window.addEventListener("resize", () => { applyLayoutSettings(); if ($$(".focused").length) applyFocus(state.groupIndex, state.itemIndex); });
    // load server state (sources, profiles, admin status) once the UI is up
    if (window.HAS_SERVER) refreshServerData();
  }

  document.addEventListener("DOMContentLoaded", () => {
    // When the server bridge (api.js) has data ready, render from it; otherwise bundled sample data.
    (window.HOME_DATA_READY || Promise.resolve()).then(() => init());
  });
})();
