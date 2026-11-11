// MOCK DATA — sample content only. No server, no real media, no external URLs.
// Gradient "artwork" is generated locally so the prototype works offline.
window.MOCK = {
  profiles: [
    { id: "p1", name: "Harsha", color: "#F5A524", initial: "H" },
    { id: "p2", name: "Sahana", color: "#5AB0FF", initial: "S" },
    { id: "p3", name: "Guest",  color: "#8E8E93", initial: "G" },
  ],
  hero: [
    { id: "m1", title: "The Silent Orbit", type: "Movie", genres: ["Sci-Fi", "Drama"],
      meta: "2025 · 2h 18m", rating: "PG-13", caps: ["4K", "HDR", "CC"],
      desc: "A lone station engineer keeps humanity's last orbital relay alive, until a signal arrives that nobody sent.",
      art: "linear-gradient(135deg,#0b1e3a 0%,#1c3d6e 45%,#3a6ea5 100%)" },
    { id: "m2", title: "Ember Lane", type: "Series", genres: ["Mystery"],
      meta: "2024 · 3 Seasons", rating: "TV-14", caps: ["4K", "CC", "AD"],
      desc: "Six neighbors. One burned-down bakery. Every one of them is lying about the night it happened.",
      art: "linear-gradient(120deg,#3a120c 0%,#7a2e1c 55%,#c05a2a 100%)" },
    { id: "m3", title: "Fjord", type: "Movie", genres: ["Documentary"],
      meta: "2026 · 1h 32m", rating: "G", caps: ["4K", "Dolby Atmos", "CC"],
      desc: "A year above the Arctic Circle, where the water freezes and the village refuses to.",
      art: "linear-gradient(160deg,#0d2b2b 0%,#1e5c55 50%,#7fb9a6 100%)" },
  ],
  shelves: [
    { title: "Continue Watching", kind: "landscape", items: [
      { id: "s1", title: "Ember Lane", sub: "S2 E4 · 22 min left", progress: 0.62, art: "linear-gradient(120deg,#42140d,#8a3b1e)" },
      { id: "s2", title: "The Cartographer", sub: "41 min left", progress: 0.35, art: "linear-gradient(120deg,#243447,#5a7d9a)" },
      { id: "s3", title: "Night Market", sub: "S1 E9 · 9 min left", progress: 0.86, art: "linear-gradient(120deg,#3d1d4e,#8250a8)" },
      { id: "s4", title: "Fjord", sub: "18 min left", progress: 0.75, art: "linear-gradient(120deg,#123b38,#4d8a7d)" },
      { id: "s5", title: "The Long Rally", sub: "S3 E2 · 31 min left", progress: 0.48, art: "linear-gradient(120deg,#40300e,#9a7a2a)" },
    ]},
    { title: "Top Movies in Your Library", kind: "poster", items: [
      { id: "t1", title: "Signal Fires",    sub: "Drama · 2h 5m",  art: "linear-gradient(160deg,#2b0f14,#7a3040)" },
      { id: "t2", title: "Salt & Static",   sub: "Thriller · 1h 58m", art: "linear-gradient(160deg,#101c2b,#3c5a7a)" },
      { id: "t3", title: "Greenhouse",      sub: "Comedy · 1h 44m", art: "linear-gradient(160deg,#122b12,#3f7a3f)" },
      { id: "t4", title: "The Understudy",  sub: "Drama · 2h 12m", art: "linear-gradient(160deg,#2b1230,#6a3a80)" },
      { id: "t5", title: "Northbound",      sub: "Adventure · 1h 51m", art: "linear-gradient(160deg,#0e2436,#2f6a8f)" },
      { id: "t6", title: "Paper Boats",     sub: "Family · 1h 37m", art: "linear-gradient(160deg,#332a10,#8a7433)" },
    ]},
    { title: "Recently Added", kind: "poster", items: [
      { id: "r1", title: "Ember Lane",      sub: "Series · 3 Seasons", art: "linear-gradient(160deg,#3a120c,#b06030)" },
      { id: "r2", title: "The Silent Orbit",sub: "Sci-Fi · 2h 18m", art: "linear-gradient(160deg,#0b1e3a,#4a7ab5)" },
      { id: "r3", title: "Cellar Door",     sub: "Horror · 1h 39m", art: "linear-gradient(160deg,#1a0f1a,#5c2a5c)" },
      { id: "r4", title: "Fjord",           sub: "Documentary · 1h 32m", art: "linear-gradient(160deg,#0d2b2b,#5a9a86)" },
    ]},
  ],
};
