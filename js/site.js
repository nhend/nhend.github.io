import {
  STATE_NAMES,
  chooseRandomLandPoint,
  pointInGeometry,
} from "../zone-drop/src/geo.js";

const SHOWTIMES_URL = "https://moviemag.net/api/showtimes";
const EXCLUDED_THEATERS = /\b(regal|cinemark)\b/i;

const movieAction = document.querySelector("[data-movie-action]");
const movieResult = document.querySelector("[data-movie-result]");
const movieTitle = document.querySelector("[data-movie-title]");
const movieMeta = document.querySelector("[data-movie-meta]");
const movieNote = document.querySelector("[data-movie-note]");
const dropAction = document.querySelector("[data-drop-action]");
const dropResult = document.querySelector("[data-drop-result]");
const dropLocation = document.querySelector("[data-drop-location]");
const dropCoordinates = document.querySelector("[data-drop-coordinates]");
const dropNote = document.querySelector("[data-drop-note]");

let movieRequest;
let remainingMovies = [];
let moviesLoaded = false;
let usFeaturesRequest;

function portlandDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
}

function portlandNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}`;
}

function displayTime(isoTime) {
  const [hours, minutes] = isoTime.slice(11, 16).split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function movieChoices(payload) {
  const now = portlandNow();
  return payload.movies
    .map(({ movie, dates }) => {
      const showtimes = dates.flatMap(({ theaters }) =>
        theaters
          .filter(({ theater_name: theaterName }) => !EXCLUDED_THEATERS.test(theaterName))
          .flatMap(({ theater_name: theaterName, showtimes: theaterShowtimes }) =>
            theaterShowtimes
              .filter((showtime) => {
                return !showtime.is_sold_out
                  && showtime.time > now;
              })
              .map((showtime) => ({ ...showtime, theaterName })),
          ),
      );

      showtimes.sort((left, right) => left.time.localeCompare(right.time));
      return showtimes.length ? { movie, showtime: showtimes[0] } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.showtime.time.localeCompare(right.showtime.time));
}

function loadMovies() {
  if (!movieRequest) {
    const date = portlandDate();
    const url = new URL(SHOWTIMES_URL);
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date", date);
    url.searchParams.set("sort", "soonest_showtime");

    movieRequest = fetch(url, {
      credentials: "omit",
      headers: { Accept: "application/json" },
    }).then((response) => {
      if (!response.ok) throw new Error(`Movie Magnet returned ${response.status}`);
      return response.json();
    });
  }

  return movieRequest;
}

function showChoice(choice) {
  const { movie, showtime } = choice;
  movieTitle.textContent = movie.title;
  movieTitle.href = `https://moviemag.net/movies/${movie.id}?showtime=${showtime.id}`;
  movieMeta.textContent = `${showtime.theaterName} · ${displayTime(showtime.time)}`;
  movieResult.hidden = false;

  movieAction.textContent = "Get a random showtime";
  if (remainingMovies.length === 0) {
    movieAction.disabled = true;
    movieNote.textContent = "That’s every indie movie left today.";
  } else {
    movieAction.disabled = false;
    movieNote.textContent = "";
  }
}

function showNextMovie() {
  if (!remainingMovies.length) return;

  const index = Math.floor(Math.random() * remainingMovies.length);
  const [choice] = remainingMovies.splice(index, 1);
  showChoice(choice);
}

movieAction?.addEventListener("click", async () => {
  if (moviesLoaded) {
    showNextMovie();
    return;
  }

  movieAction.disabled = true;
  movieAction.textContent = "Looking…";
  movieNote.textContent = "Checking Portland’s marquees.";

  try {
    remainingMovies = movieChoices(await loadMovies());
    moviesLoaded = true;
    if (remainingMovies.length === 0) {
      movieAction.textContent = "Nothing left today";
      movieNote.textContent = "The indie theaters are done for the night.";
      return;
    }
    showNextMovie();
  } catch {
    movieAction.textContent = "Unavailable tonight";
    movieNote.textContent = "Couldn’t check the marquees just now.";
    movieAction.disabled = true;
  }
});

function loadUSFeatures() {
  if (!usFeaturesRequest) {
    const url = new URL("../zone-drop/data/states.geojson", import.meta.url);
    usFeaturesRequest = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Map data returned ${response.status}`);
        return response.json();
      })
      .then(({ features }) => features);
  }
  return usFeaturesRequest;
}

dropAction?.addEventListener("click", async () => {
  dropAction.disabled = true;
  dropAction.textContent = "Dropping…";
  dropNote.textContent = "";

  try {
    const features = await loadUSFeatures();
    const [longitude, latitude] = chooseRandomLandPoint(features);
    const feature = features.find(({ geometry }) => (
      pointInGeometry([longitude, latitude], geometry)
    ));
    const state = feature?.properties?.STUSAB;
    const locationName = state ? `Somewhere in ${STATE_NAMES[state]}` : "Somewhere in America";
    const coordinateText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    const mapsUrl = new URL("https://www.google.com/maps/search/");
    mapsUrl.searchParams.set("api", "1");
    mapsUrl.searchParams.set("query", `${latitude.toFixed(6)},${longitude.toFixed(6)}`);

    dropLocation.textContent = locationName;
    dropLocation.href = mapsUrl;
    dropCoordinates.textContent = coordinateText;
    dropResult.hidden = false;
    dropAction.textContent = "Drop me somewhere";
    dropAction.disabled = false;
  } catch {
    dropAction.textContent = "Couldn’t drop you";
    dropNote.textContent = "The map is having a little trouble.";
  }
});

loadUSFeatures();
