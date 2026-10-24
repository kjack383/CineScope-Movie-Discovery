# CineScope — IT 4403 Movie Discovery SPA

CineScope is a responsive, single-page movie discovery application built with HTML, CSS, JavaScript, jQuery, AJAX, JSON, the TMDB API, and localStorage.

## Features
1. Movie title search.
2. Popular movies landing view.
3. Genre filtering and sort options.
4. Movie details (overview, release date, rating, genres, cast when provided by TMDB).
5. Persistent favorites/watchlist using localStorage.
6. Search suggestions while typing.
7. Pagination for API result pages.
8. Loading states, error messages, responsive design, and accessibility features.

## Run locally
1. Download or clone this repository.
2. Open `index.html` using a local web server (for example, VS Code Live Server). A local server is recommended over opening the file directly.
3. Choose **API settings** and enter a TMDB API Read Access Token or v3 API key.
4. Save and connect, then test search, genre filters, details, and watchlist.

## TMDB credentials
Create a TMDB account and request API credentials from the account API settings. The application stores credentials in `sessionStorage` for the current browser session and does not hard-code them into the source files. This is a client-side learning project, not a secure production architecture: credentials used by a browser can be inspected by the browser user. Follow the course instructor's rules for credential handling and TMDB's current terms. Never commit a personal token to a public repository.

This product uses the TMDB API but is not endorsed or certified by TMDB.

## Deploy
Push the project files to a GitHub repository, then enable GitHub Pages under repository Settings → Pages. Set the source to the main branch and root folder. Once deployment completes, test the published URL and enter credentials there. Do not include credentials in the repository.

## Accessibility test checklist
- Run the WAVE browser extension on the deployed page.
- Test keyboard navigation with Tab, Shift+Tab, Enter, Space, and Escape.
- Check visible focus indicators, heading hierarchy, form labels, alt text, color contrast, and dynamic status messages.
- Save screenshots of WAVE results and document each issue and fix in the report.
- Do not claim that an issue is fixed until you retest the page.

## Files
- `index.html` — semantic layout and dialogs
- `style.css` — responsive visual styling and focus/reduced-motion support
- `script.js` — API requests, dynamic rendering, search, filtering, details, pagination, and favorites
- `PROJECT_REPORT_DRAFT.pdf` — editable-in-practice report content draft; replace placeholders with actual details and evidence before submission
