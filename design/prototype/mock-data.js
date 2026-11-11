// Real film examples and metadata for this visual demo. Viewing progress is invented demo data.
// Film metadata and artwork: TMDb. This is not a live library or playback integration.
window.MOCK = {
  hero: [
    { id: "dune-2", title: "Dune: Part Two", type: "Movie", year: 2024, genres: ["Science Fiction", "Adventure"],
      runtime: "2h 47m", rating: "PG-13",
      desc: "Paul Atreides unites with Chani and the Fremen while seeking justice for his family and confronting a choice that could reshape the universe.",
      tmdbId: 693134, imdbRating: 8.4, art: "art/tmdb/posters/dune-part-two.jpg", poster: "art/tmdb/posters/dune-part-two.jpg", backdrop: "art/tmdb/backdrops/dune-part-two.jpg" },
    { id: "interstellar", title: "Interstellar", type: "Movie", year: 2014, genres: ["Adventure", "Drama", "Science Fiction"],
      runtime: "2h 49m", rating: "PG-13",
      desc: "As Earth becomes harder to inhabit, a pilot joins a mission through a wormhole in search of a future for humanity.",
      tmdbId: 157336, imdbRating: 8.7, art: "art/tmdb/posters/interstellar.jpg", poster: "art/tmdb/posters/interstellar.jpg", backdrop: "art/tmdb/backdrops/interstellar.jpg" },
    { id: "spider-verse", title: "Spider-Man: Across the Spider-Verse", type: "Movie", year: 2023, genres: ["Animation", "Action", "Adventure"],
      runtime: "2h 20m", rating: "PG",
      desc: "Miles Morales crosses paths with a team of Spider-People and faces a choice that tests what it means to be a hero.",
      tmdbId: 569094, imdbRating: 8.5, art: "art/tmdb/posters/spider-verse.jpg", poster: "art/tmdb/posters/spider-verse.jpg", backdrop: "art/tmdb/backdrops/spider-verse.jpg" },
  ],
  series: [
    {
      id: "arcane", title: "Arcane", type: "Animated series", year: 2021,
      genres: ["Animation", "Action", "Fantasy"], runtime: "2 seasons | 18 episodes",
      rating: "TV-14", seasonCount: 2, episodeCount: 18, tmdbId: 94605,
      poster: "art/tv/posters/arcane-poster.jpg", backdrop: "art/tv/backdrops/arcane-backdrop.jpg",
      desc: "Two sisters find themselves on opposing sides of a conflict between the cities of Piltover and Zaun.",
      seasons: [
        { number: 1, year: 2021, episodeCount: 9, episodes: [
          { number: 1, title: "Welcome to the Playground", runtime: "44m", art: "art/tv/episodes/arcane-s1e1.jpg", desc: "Vi and Powder run into trouble in Zaun after a heist in Piltover." },
          { number: 2, title: "Some Mysteries Are Better Left Unsolved", runtime: "41m", art: "art/tv/episodes/arcane-s1e2.jpg", desc: "Inventor Jayce pushes his experiments forward while Silco tests a dangerous new substance." },
          { number: 3, title: "The Base Violence Necessary for Change", runtime: "45m", art: "art/tv/episodes/arcane-s1e3.jpg", desc: "A clash between old rivals changes Zaun, while Jayce and Viktor risk their research." },
        ]},
        { number: 2, year: 2024, episodeCount: 9, episodes: [
          { number: 1, title: "Heavy Is the Crown", runtime: "41m", art: "art/tv/episodes/arcane-s2e1.jpg", desc: "Vi and Caitlyn face the aftermath of a tragedy as tensions rise between the cities." },
          { number: 2, title: "Watch It All Burn", runtime: "40m", art: "art/tv/episodes/arcane-s2e2.jpg", desc: "Piltover prepares for war as Jinx keeps a low profile in the Undercity." },
          { number: 3, title: "Finally Got the Name Right", runtime: "41m", art: "art/tv/episodes/arcane-s2e3.jpg", desc: "Caitlyn intensifies her search for Jinx while Ambessa pursues a meeting." },
        ]},
      ],
    },
    {
      id: "spy-family", title: "SPY x FAMILY", type: "Anime series", isAnime: true, year: 2022,
      genres: ["Anime", "Animation", "Action", "Comedy"], runtime: "3 seasons | 50 episodes",
      rating: "TV-14", seasonCount: 3, episodeCount: 50, tmdbId: 120089,
      poster: "art/tv/posters/spy-family-poster.jpg", backdrop: "art/tv/backdrops/spy-family-backdrop.jpg",
      desc: "A spy, an assassin, and a telepath form a pretend family while keeping their real identities secret.",
      seasons: [
        { number: 1, year: 2022, episodeCount: 25, episodes: [
          { number: 1, title: "OPERATION STRIX", runtime: "25m", art: "art/tv/episodes/spy-s1e1.jpg", desc: "Twilight begins Operation Strix, adopts Anya, and discovers that family life changes the mission." },
          { number: 2, title: "SECURE A WIFE", runtime: "25m", art: "art/tv/episodes/spy-s1e2.jpg", desc: "Loid meets Yor, who has a secret identity of her own, and asks her to join the family plan." },
          { number: 3, title: "PREPARE FOR THE INTERVIEW", runtime: "25m", art: "art/tv/episodes/spy-s1e3.jpg", desc: "The new family prepares for Anya's school interview and tries to look convincing together." },
        ]},
      ],
    },
  ],
  films: [
    { id: "inception", title: "Inception", year: 2010, genres: ["Action", "Science Fiction"], runtime: "2h 28m", rating: "PG-13", imdbRating: 8.8, tmdbId: 27205, poster: "art/tmdb/posters/inception.jpg", backdrop: "art/tmdb/backdrops/inception.jpg", desc: "A specialist in entering dreams is offered a chance to return home by planting an idea in a target's mind.", progress: .64, progressLabel: "1h 35m left" },
    { id: "interstellar", title: "Interstellar", year: 2014, genres: ["Adventure", "Drama", "Science Fiction"], runtime: "2h 49m", rating: "PG-13", imdbRating: 8.7, tmdbId: 157336, poster: "art/tmdb/posters/interstellar.jpg", backdrop: "art/tmdb/backdrops/interstellar.jpg", desc: "As Earth becomes harder to inhabit, a pilot joins a mission through a wormhole in search of a future for humanity.", progress: .38, progressLabel: "1h 45m left" },
    { id: "parasite", title: "Parasite", year: 2019, genres: ["Drama", "Thriller"], runtime: "2h 13m", rating: "R", imdbRating: 8.5, tmdbId: 496243, poster: "art/tmdb/posters/parasite.jpg", backdrop: "art/tmdb/backdrops/parasite.jpg", desc: "A cash-strapped family finds its way into a wealthy household, with consequences that shift from comic to unsettling.", progress: .81, progressLabel: "25m left" },
    { id: "dark-knight", title: "The Dark Knight", year: 2008, genres: ["Action", "Crime", "Drama"], runtime: "2h 32m", rating: "PG-13", imdbRating: 9.1, tmdbId: 155, poster: "art/tmdb/posters/dark-knight.jpg", backdrop: "art/tmdb/backdrops/dark-knight.jpg", artTitle: true, desc: "Batman faces a new criminal force pushing Gotham into chaos and testing the city’s limits.", progress: .22, progressLabel: "1h 59m left" },
    { id: "spider-verse", title: "Spider-Man: Across the Spider-Verse", year: 2023, genres: ["Animation", "Action", "Adventure"], runtime: "2h 20m", rating: "PG", imdbRating: 8.5, tmdbId: 569094, poster: "art/tmdb/posters/spider-verse.jpg", backdrop: "art/tmdb/backdrops/spider-verse.jpg", desc: "Miles Morales crosses paths with a team of Spider-People and faces a choice that tests what it means to be a hero.", progress: .47, progressLabel: "1h 14m left" },
    { id: "grand-budapest", title: "The Grand Budapest Hotel", year: 2014, genres: ["Comedy", "Drama"], runtime: "1h 40m", rating: "R", imdbRating: 8.1, tmdbId: 120467, poster: "art/tmdb/posters/grand-budapest.jpg", backdrop: "art/tmdb/backdrops/grand-budapest.jpg", artTitle: true, desc: "A hotel concierge and his young protégé become caught up in a stolen painting and a family inheritance dispute.", progress: .12, progressLabel: "1h 28m left" },
    { id: "the-batman", title: "The Batman", year: 2022, genres: ["Crime", "Mystery", "Thriller"], runtime: "2h 57m", rating: "PG-13", imdbRating: 7.8, tmdbId: 414906, poster: "art/tmdb/posters/the-batman.jpg", backdrop: "art/tmdb/backdrops/the-batman.jpg", artTitle: true, desc: "A young Batman follows a trail of riddles through Gotham and uncovers corruption tied to the city’s past.", progress: .0, progressLabel: "Not started" },
  ],
  credits: "This product uses the TMDB API but is not endorsed or certified by TMDB.",
};
