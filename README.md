# Country Search

A live country search web application built with TypeScript and Vite using the [countries.dev](https://countries.dev) public API. Designed to prevent stale response race conditions through immediate request cancellation, custom debouncing, timeout handling, and request deduplication.

🔗 **Live Demo:** https://evoly.github.io/country-search/

## Features

- **Live Search with Debounce:** Custom `300 ms` debounce implementation that resets on rapid typing without external utility libraries.
- **Race-Condition Prevention:** Immediately cancels any active in-flight network request via `AbortController.abort()` on every input change—not just when the debounce timer fires.
- **Distinct Error & State Handling:**
    - **Empty Input:** Clears the results list without making network calls.
    - **Loading:** Displays a visual loading indicator while a request is in flight.
    - **No Matches (`404`):** Treats HTTP `404` as a friendly empty search state rather than an application error.
    - **User Cancellation (`AbortError`):** Silently ignored without triggering error messages.
    - **Timeouts (`TimeoutError`) & Server/Network Errors (`HttpError`):** Enforces a `5000 ms` request timeout and displays an error state with a **Retry** button that re-runs the exact last query.
- **Country Details Modal:** Clicking any country card opens a detailed dialog showing description, area, borders, languages, and currencies.
- **Query Caching & Request Deduplication:** Caches completed queries in memory and shares in-flight promises for identical concurrent queries while keeping each caller's `AbortSignal` independent.
- **Search History:** Persists the 5 most recent searches in `localStorage` for instant one-click re-searching.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Build Tool:** Vite
- **Testing:** Vitest (with fake timers and `AbortSignal`-aware `fetch` mocks)
- **Code Quality:** ESLint, Prettier, Husky (`pre-commit` with `lint-staged`, `pre-push` running `npm test`)
