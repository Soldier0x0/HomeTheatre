/* Server bridge (ADR-0004).
 *
 * Runs before the app. When the Home Theater server responds, it replaces the
 * bundled sample catalog (window.MOCK) with real server data and sets
 * window.HAS_SERVER. Without a server the prototype keeps its clearly labeled
 * sample data. Also syncs the browser-local active profile to the server so
 * playback progress has a server-side owner.
 */
(function () {
  "use strict";

  async function syncProfile() {
    try {
      const profiles = JSON.parse(localStorage.getItem("homeTheaterProfiles") || "[]");
      const currentId = JSON.parse(localStorage.getItem("homeTheaterCurrentProfile") || "null");
      const current = profiles.find(p => p.id === currentId);
      if (!current) return;
      const r = await fetch("/api/profiles", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: current.name, color: current.color }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j && j.id) window.SERVER_PROFILE_ID = j.id;
      }
    } catch { /* profile sync is best-effort */ }
  }

  window.HOME_DATA_READY = (async () => {
    try {
      const health = await fetch("/api/health", { cache: "no-store" });
      if (!health.ok) return false;
      window.HAS_SERVER = true;
      await syncProfile();
      const profile = window.HOME_PROFILE_ID();
      const q = profile ? `?profile=${encodeURIComponent(profile)}` : "";
      const catalog = await (await fetch(`/api/catalog/shaped${q}`, { cache: "no-store" })).json();
      window.MOCK = catalog; // same contract as mock-data.js; sample data stays in mock-data.js
      return true;
    } catch {
      window.HAS_SERVER = false;
      return false; // fall back to the bundled sample catalog
    }
  })();

  window.HOME_PROFILE_ID = function () {
    return window.SERVER_PROFILE_ID ||
      JSON.parse(localStorage.getItem("homeTheaterCurrentProfile") || "null") || null;
  };

  window.HOME_PLAYER_URL = function (item, season, episode) {
    const q = new URLSearchParams({ title: item.id });
    if (season != null) q.set("s", String(season));
    if (episode != null) q.set("e", String(episode));
    const profile = window.HOME_PROFILE_ID();
    if (profile) q.set("profile", String(profile));
    return "player.html?" + q.toString();
  };
})();
