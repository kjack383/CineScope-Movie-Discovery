/* CineScope — IT 4403 Movie Discovery SPA
   jQuery, AJAX, JSON, TMDB API, localStorage, dynamic single-page rendering.
*/
(function ($) {
  "use strict";
  const API_BASE = "https://api.themoviedb.org/3";
  const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
  const FALLBACK_IMAGE = "https://image.tmdb.org/t/p/w342";
  const STORAGE_KEY = "cinescope-watchlist-v1";
  const $grid = $("#movie-grid");
  const $status = $("#status-region");
  const $settings = $("#settings-dialog");
  const $details = $("#details-dialog");
  let apiToken = sessionStorage.getItem("cinescope_tmdb_token") || "";
  let apiKey = sessionStorage.getItem("cinescope_tmdb_key") || "";
  let currentPage = 1;
  let totalPages = 1;
  let currentMode = "popular";
  let currentQuery = "";
  let currentGenre = "";
  let currentSort = "popularity.desc";
  let genres = [];
  let currentMovies = [];
  let suggestionTimer = null;
  let lastRequest = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }
  function watchlist() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch (_) { return []; }
  }
  function saveWatchlist(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    updateWatchlistCount();
  }
  function updateWatchlistCount() { $("#watchlist-count").text(watchlist().length); }
  function isSaved(id) { return watchlist().some(m => Number(m.id) === Number(id)); }
  function imageUrl(path) { return path ? IMAGE_BASE + path : ""; }

  function showStatus(message, type) {
    $status.html('<div class="status-card ' + (type === "error" ? "error" : "") + '">' + message + '</div>');
  }
  function clearStatus() { $status.empty(); }
  function loading(message) {
    showStatus('<span class="spinner" aria-hidden="true"></span>' + escapeHtml(message || "Loading movies…"));
  }
  function showError(error) {
    const msg = error && error.message ? error.message : "Something went wrong while loading movie data.";
    showStatus('<strong>Unable to load movies.</strong> ' + escapeHtml(msg) +
      ' Check your API credentials and connection, then try again.', "error");
  }
  function apiRequest(path, params) {
    const options = $.extend({}, params || {});
    if (apiToken) {
      return $.ajax({
        url: API_BASE + path, method: "GET", data: options, dataType: "json",
        headers: { Authorization: "Bearer " + apiToken, accept: "application/json" }
      });
    }
    if (apiKey) {
      options.api_key = apiKey;
      return $.ajax({ url: API_BASE + path, method: "GET", data: options, dataType: "json" });
    }
    return $.Deferred().reject({ responseJSON: { status_message: "Please add your TMDB API Read Access Token or v3 API key using API settings." }, message: "TMDB API credentials are missing." }).promise();
  }
  function apiErrorMessage(xhr) {
    if (xhr && xhr.responseJSON && xhr.responseJSON.status_message) return xhr.responseJSON.status_message;
    if (xhr && xhr.status === 401) return "TMDB did not accept these credentials. Check the token or API key.";
    if (xhr && xhr.status === 429) return "Too many requests. Wait a moment and try again.";
    if (xhr && xhr.status === 0) return "Network request failed. Check your internet connection.";
    return xhr && xhr.message ? xhr.message : "Please try again.";
  }

  function renderMovies(movies) {
    currentMovies = movies || [];
    if (!currentMovies.length) {
      $grid.html('<div class="empty-state"><h3>No movies found</h3><p>Try a different title or clear your filters.</p></div>');
      return;
    }
    const html = currentMovies.map(movie => {
      const title = movie.title || movie.name || "Untitled movie";
      const year = (movie.release_date || "").slice(0, 4) || "Year unknown";
      const poster = imageUrl(movie.poster_path);
      const saved = isSaved(movie.id);
      return `<article class="movie-card">
        <button class="poster-button movie-open" type="button" data-id="${Number(movie.id)}" aria-label="View details for ${escapeHtml(title)}">
          ${poster ? `<img src="${poster}" alt="Movie poster for ${escapeHtml(title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.hidden=false">` : ""}
          <span class="poster-placeholder" ${poster ? "hidden" : ""}>${escapeHtml(title)}</span>
        </button>
        <button class="favorite-button" type="button" data-favorite="${Number(movie.id)}" aria-label="${saved ? "Remove" : "Add"} ${escapeHtml(title)} ${saved ? "from" : "to"} watchlist" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button>
        <button class="movie-title movie-open" type="button" data-id="${Number(movie.id)}">${escapeHtml(title)}</button>
        <div class="movie-meta"><span>${escapeHtml(year)}</span><span class="rating">★ ${Number(movie.vote_average || 0).toFixed(1)}</span></div>
      </article>`;
    }).join("");
    $grid.html(html);
  }

  function renderPagination() {
    const visible = currentMode !== "favorites" && totalPages > 1;
    $("#pagination").prop("hidden", !visible);
    $("#page-label").text(`Page ${currentPage} of ${totalPages}`);
    $("#prev-page").prop("disabled", currentPage <= 1);
    $("#next-page").prop("disabled", currentPage >= totalPages);
  }
  function setSection(title, summary) {
    $("#section-title").text(title);
    $("#result-summary").text(summary);
  }
  function loadPopular(page) {
    currentMode = "popular"; currentPage = page || 1;
    setSection("Popular right now", "Popular picks for your next movie night.");
    loading("Finding popular movies…");
    if (lastRequest && lastRequest.abort) lastRequest.abort();
    lastRequest = apiRequest("/movie/popular", { page: currentPage });
    lastRequest.done(data => {
      clearStatus(); totalPages = Math.min(data.total_pages || 1, 500);
      renderMovies(data.results || []); renderPagination();
    }).fail(xhr => { if (xhr.statusText !== "abort") showError(apiErrorMessage(xhr)); });
  }
  function searchMovies(query, page) {
    currentMode = "search"; currentQuery = query.trim(); currentPage = page || 1;
    if (!currentQuery) return loadPopular(1);
    setSection("Search results", `Results for “${currentQuery}”`);
    loading("Searching movie titles…");
    if (lastRequest && lastRequest.abort) lastRequest.abort();
    lastRequest = apiRequest("/search/movie", { query: currentQuery, page: currentPage, include_adult: false });
    lastRequest.done(data => {
      clearStatus(); totalPages = Math.min(data.total_pages || 1, 500);
      renderMovies(data.results || []); renderPagination();
    }).fail(xhr => { if (xhr.statusText !== "abort") showError(apiErrorMessage(xhr)); });
  }
  function loadDiscover(page) {
    currentMode = "discover"; currentPage = page || 1;
    const params = { page: currentPage, sort_by: currentSort, include_adult: false, include_video: false };
    if (currentGenre) params.with_genres = currentGenre;
    setSection(currentGenre ? "Movies by genre" : "Explore movies", currentGenre ? "Filtered by your selected genre." : "Explore movies by popularity, rating, release date, or title.");
    loading("Finding movies that match your filters…");
    if (lastRequest && lastRequest.abort) lastRequest.abort();
    lastRequest = apiRequest("/discover/movie", params);
    lastRequest.done(data => {
      clearStatus(); totalPages = Math.min(data.total_pages || 1, 500);
      renderMovies(data.results || []); renderPagination();
    }).fail(xhr => { if (xhr.statusText !== "abort") showError(apiErrorMessage(xhr)); });
  }
  function loadGenres() {
    apiRequest("/genre/movie/list", {}).done(data => {
      genres = data.genres || [];
      $("#genre-select").append(genres.map(g => `<option value="${Number(g.id)}">${escapeHtml(g.name)}</option>`).join(""));
    }).fail(() => { /* Genre filtering remains available once credentials are corrected. */ });
  }
  function getMovie(id) {
    const found = currentMovies.find(m => Number(m.id) === Number(id)) || watchlist().find(m => Number(m.id) === Number(id));
    return found || { id: Number(id), title: "Movie details" };
  }
  function openDetails(id) {
    $details[0].showModal();
    $("#details-content").html('<button class="dialog-close" id="details-close" type="button" aria-label="Close movie details">×</button><div class="details-loading"><span class="spinner" aria-hidden="true"></span>Loading movie details…</div>');
    apiRequest("/movie/" + Number(id), { append_to_response: "credits" }).done(movie => {
      const title = movie.title || "Untitled movie";
      const poster = imageUrl(movie.poster_path);
      const release = movie.release_date || "Release date unavailable";
      const genreNames = (movie.genres || []).map(g => g.name).join(", ") || "Genres unavailable";
      const cast = movie.credits && movie.credits.cast ? movie.credits.cast.slice(0, 5).map(p => p.name).join(", ") : "Cast details unavailable";
      const saved = isSaved(movie.id);
      $("#details-content").html(`<button class="dialog-close" id="details-close" type="button" aria-label="Close movie details">×</button>
        <div class="details-layout">${poster ? `<img class="details-poster" src="${poster}" alt="Movie poster for ${escapeHtml(title)}">` : `<div class="poster-placeholder">No poster available</div>`}
        <div class="details-copy"><p class="eyebrow">MOVIE DETAILS</p><h2 id="details-title">${escapeHtml(title)}</h2>
        <p>${escapeHtml(release)} · ★ ${Number(movie.vote_average || 0).toFixed(1)} / 10</p>
        <p><strong>Genres:</strong> ${escapeHtml(genreNames)}</p><p><strong>Cast:</strong> ${escapeHtml(cast)}</p>
        <p class="details-overview">${escapeHtml(movie.overview || "No overview is available for this title.")}</p>
        <div class="details-actions"><button type="button" data-favorite="${Number(movie.id)}" aria-pressed="${saved}">${saved ? "♥ Saved to watchlist" : "♡ Add to watchlist"}</button><button type="button" class="button-secondary" id="details-done">Close</button></div></div></div>`);
      $("#details-content").find(".details-actions [data-favorite]").attr("aria-label", (saved ? "Remove " : "Add ") + title + (saved ? " from" : " to") + " watchlist");
    }).fail(xhr => {
      $("#details-content").html('<button class="dialog-close" id="details-close" type="button" aria-label="Close movie details">×</button><div class="details-loading"><h2 id="details-title">Could not load details</h2><p>' + escapeHtml(apiErrorMessage(xhr)) + '</p></div>');
    });
  }
  function toggleFavorite(id) {
    const current = watchlist();
    const existing = current.find(m => Number(m.id) === Number(id));
    let updated;
    if (existing) updated = current.filter(m => Number(m.id) !== Number(id));
    else {
      const movie = getMovie(id);
      updated = current.concat([{
        id: Number(movie.id), title: movie.title || movie.name || "Untitled movie",
        poster_path: movie.poster_path || null, release_date: movie.release_date || "",
        vote_average: Number(movie.vote_average || 0), overview: movie.overview || ""
      }]);
    }
    saveWatchlist(updated);
    if (currentMode === "favorites") renderFavorites();
    else renderMovies(currentMovies);
    if ($details[0].open) {
      const $button = $("#details-content [data-favorite]");
      if ($button.length && Number($button.attr("data-favorite")) === Number(id)) {
        const saved = isSaved(id);
        $button.attr("aria-pressed", saved).text(saved ? "♥ Saved to watchlist" : "♡ Add to watchlist");
      }
    }
  }
  function renderFavorites() {
    currentMode = "favorites"; totalPages = 1; currentPage = 1;
    setSection("My watchlist", "Your saved movies stay in this browser.");
    clearStatus(); $("#pagination").prop("hidden", true);
    renderMovies(watchlist());
    if (!watchlist().length) $grid.html('<div class="empty-state"><h3>Your watchlist is waiting</h3><p>Use the heart on any movie to save it here.</p><button type="button" class="button-secondary" id="browse-movies">Browse popular movies</button></div>');
  }
  function showSuggestions(query) {
    if (!query.trim() || !apiToken && !apiKey) { $("#suggestions").prop("hidden", true).empty(); return; }
    apiRequest("/search/movie", { query: query.trim(), page: 1, include_adult: false }).done(data => {
      const results = (data.results || []).slice(0, 5);
      if (!results.length) { $("#suggestions").prop("hidden", true).empty(); return; }
      $("#suggestions").html(results.map(m => `<li role="option"><button type="button" data-suggestion="${Number(m.id)}" data-title="${escapeHtml(m.title || "")}">${escapeHtml(m.title || "Untitled")} <span style="color:#a9b0c1">· ${(m.release_date || "").slice(0,4)}</span></button></li>`).join("")).prop("hidden", false);
    }).fail(() => $("#suggestions").prop("hidden", true).empty());
  }
  function connect() {
    $("#api-hint").text(apiToken || apiKey ? "TMDB connected. Search and discover live movie data." : "Add your TMDB API key in API settings to load live movie data.");
    if (apiToken || apiKey) { loadGenres(); loadPopular(1); }
    else {
      showStatus("To use live movie data, open <strong>API settings</strong> and add your TMDB credentials. The rest of the interface is ready to explore.", "error");
      renderMovies([]);
      $grid.html('<div class="empty-state"><h3>Connect to discover movies</h3><p>Add your TMDB API credentials in API settings to load live titles, posters, genres, and details.</p><button type="button" id="connect-now">Open API settings</button></div>');
    }
  }

  $("#settings-open").on("click", () => {
    $("#api-token").val(apiToken); $("#api-key").val(apiKey); $("#settings-message").text("");
    $settings[0].showModal(); $("#api-token").trigger("focus");
  });
  $("#settings-form").on("submit", function (event) {
    event.preventDefault();
    apiToken = $("#api-token").val().trim(); apiKey = $("#api-key").val().trim();
    sessionStorage.setItem("cinescope_tmdb_token", apiToken); sessionStorage.setItem("cinescope_tmdb_key", apiKey);
    $("#settings-message").text("Credentials saved for this browser session.");
    $settings[0].close(); connect();
  });
  $("#clear-credentials").on("click", () => {
    apiToken = ""; apiKey = ""; sessionStorage.removeItem("cinescope_tmdb_token"); sessionStorage.removeItem("cinescope_tmdb_key");
    $("#api-token,#api-key").val(""); $("#settings-message").text("Credentials cleared.");
  });
  $("#search-form").on("submit", event => {
    event.preventDefault(); $("#suggestions").prop("hidden", true);
    const query = $("#search-input").val().trim();
    currentGenre = ""; $("#genre-select").val(""); searchMovies(query, 1);
  });
  $("#search-input").on("input", function () {
    const query = $(this).val();
    clearTimeout(suggestionTimer);
    suggestionTimer = setTimeout(() => showSuggestions(query), 350);
  });
  $("#search-input").on("keydown", event => { if (event.key === "Escape") $("#suggestions").prop("hidden", true); });
  $(document).on("click", event => { if (!$(event.target).closest(".search-form").length) $("#suggestions").prop("hidden", true); });
  $(document).on("click", "[data-suggestion]", function () {
    const title = $(this).attr("data-title"); $("#search-input").val(title); $("#suggestions").prop("hidden", true); searchMovies(title, 1);
  });
  $("#genre-select").on("change", function () {
    currentGenre = $(this).val(); $("#search-input").val("");
    if (currentGenre || currentSort !== "popularity.desc") loadDiscover(1); else loadPopular(1);
  });
  $("#sort-select").on("change", function () {
    currentSort = $(this).val();
    if (currentMode === "search" && currentQuery) searchMovies(currentQuery, 1);
    else if (currentMode !== "favorites") loadDiscover(1);
  });
  $(document).on("click", ".movie-open", function () { openDetails($(this).data("id")); });
  $(document).on("click", "[data-favorite]", function (event) { event.stopPropagation(); toggleFavorite($(this).data("favorite")); });
  $(document).on("click", "#details-close,#details-done", () => $details[0].close());
  $("#details-dialog").on("click", function (event) { if (event.target === this) this.close(); });
  $("#settings-dialog").on("click", function (event) { if (event.target === this) this.close(); });
  $("#prev-page").on("click", () => { if (currentPage > 1) { const p = currentPage - 1; currentMode === "search" ? searchMovies(currentQuery,p) : currentMode === "discover" ? loadDiscover(p) : loadPopular(p); } });
  $("#next-page").on("click", () => { if (currentPage < totalPages) { const p = currentPage + 1; currentMode === "search" ? searchMovies(currentQuery,p) : currentMode === "discover" ? loadDiscover(p) : loadPopular(p); } });
  $("[data-view]").on("click", function () {
    $("[data-view]").removeClass("active"); $(this).addClass("active");
    if ($(this).data("view") === "favorites") renderFavorites(); else loadPopular(1);
    $("#movie-section").attr("tabindex","-1").trigger("focus");
  });
  $("#brand-home").on("click", event => { event.preventDefault(); $("[data-view]").removeClass("active"); $('[data-view="discover"]').addClass("active"); loadPopular(1); });
  $(document).on("click", "#browse-movies", () => { $('[data-view="discover"]').trigger("click"); });
  $(document).on("click", "#connect-now", () => $("#settings-open").trigger("click"));

  updateWatchlistCount();
  connect();
})(jQuery);
