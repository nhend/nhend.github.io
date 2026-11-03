const SHOWTIMES_URL = "https://moviemag.net/api/showtimes";
const EXCLUDED_THEATERS = /\b(regal|cinemark)\b/i;

const action = document.querySelector("[data-movie-action]");
const intro = document.querySelector("[data-picker-intro]");
const result = document.querySelector("[data-movie-result]");
const title = document.querySelector("[data-movie-title]");
const meta = document.querySelector("[data-movie-meta]");
const note = document.querySelector("[data-movie-note]");

let movieRequest;
let remainingMovies = [];
let hasShownMovie = false;

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

function displayTime(isoTime) {
  const [hours, minutes] = isoTime.slice(11, 16).split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function movieChoices(payload) {
  return payload.movies
    .map(({ movie, dates }) => {
      const showtimes = dates.flatMap(({ theaters }) =>
        theaters
          .filter(({ theater_name: theaterName }) => !EXCLUDED_THEATERS.test(theaterName))
          .flatMap(({ theater_name: theaterName, showtimes: theaterShowtimes }) =>
            theaterShowtimes
              .filter((showtime) => !showtime.is_sold_out)
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
  title.textContent = movie.title;
  title.href = `https://moviemag.net/movies/${movie.id}?showtime=${showtime.id}`;
  meta.textContent = `${showtime.theaterName} · ${displayTime(showtime.time)}`;
  intro.hidden = true;
  result.hidden = false;
  hasShownMovie = true;

  action.textContent = "Random movie today";
  if (remainingMovies.length === 0) {
    action.disabled = true;
    note.textContent = "That’s every indie movie left today.";
  } else {
    action.disabled = false;
    note.textContent = "";
  }
}

function showNextMovie() {
  if (!remainingMovies.length) return;

  const index = hasShownMovie
    ? Math.floor(Math.random() * remainingMovies.length)
    : 0;
  const [choice] = remainingMovies.splice(index, 1);
  showChoice(choice);
}

action?.addEventListener("click", async () => {
  if (hasShownMovie) {
    showNextMovie();
    return;
  }

  action.disabled = true;
  action.textContent = "Looking…";
  note.textContent = "Checking Portland’s marquees.";

  try {
    remainingMovies = movieChoices(await loadMovies());
    if (remainingMovies.length === 0) {
      action.textContent = "Nothing left today";
      note.textContent = "The indie theaters are done for the night.";
      return;
    }
    showNextMovie();
  } catch {
    action.textContent = "Unavailable tonight";
    note.textContent = "Couldn’t check the marquees just now.";
    action.disabled = true;
  }
});
