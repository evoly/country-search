# Country Search Design

## 1. Cancelling outdated requests

Search coordination lives in [src/createCountrySearch.ts](src/createCountrySearch.ts), in the
`createCountrySearch` function. It stores the latest query (`lastQuery`) and the current request controller
(`activeController`), and reports state changes through `onStateChange`.

Each call to `search(value)`:

1. Trims the input and saves it for retries.
2. Calls `prepareRequest()`, which immediately aborts the previous controller, creates a new
   `AbortController`, and clears `state.countries`.
3. Emits the `idle` state to clear previous results from the interface.
4. Schedules the new search through debounce, passing the new controller.

Cancellation happens **on every input change, before waiting for debounce**. For example, if a request for
`sp` is running when the user enters `spain`, the `sp` request is aborted immediately. Waiting until the next
request starts would allow the outdated response to appear during the debounce interval.

Empty input follows the same path: it aborts the active request and resets the previous debounce timer.
When the delayed callback runs, `runSearch` exits without calling `fetch` because the query is empty.
`retry()` immediately repeats `lastQuery`, bypassing debounce and aborting any previous operation.
Selecting a recent query calls `search(query, { immediate: true })`, which also bypasses debounce and uses
the same cancellation and error-handling path. Any previously scheduled callback belongs to an aborted
controller and cannot start another request.

Inside `runSearch`, two cancellation sources are combined:

```ts
const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
```

The combined signal is passed to `searchCountries` for this caller. Each shared HTTP request has its own
transport controller, covering both the request and response-body reading. Cancelling a caller immediately
rejects its wrapper promise and removes its abort listener. The transport is aborted only when no callers
remain, so one caller cannot cancel work needed by another. With a single caller, new input still aborts
the actual fetch immediately, before debounce. A timeout rejects the affected caller with its original
`TimeoutError` reason. The timeout starts when `runSearch` runs, excluding the debounce interval.
It is configured as **5000 ms** through `REQUEST_TIMEOUT_MS` in [src/view/App.ts](src/view/App.ts).

Results and errors are handled separately:

- Manual cancellation and operations belonging to an outdated controller exit without displaying an error.
- `AbortError` also avoids the error state and instead emits `idle`.
- `TimeoutError` displays a timeout message with a retry option.
- `HttpError` displays the HTTP status; other errors receive a connection-related message.
- HTTP 404 becomes `[]` inside [searchCountries](src/searchCountries.ts), producing the `empty` state.
  Other unsuccessful HTTP responses are detected through `response.ok` and produce an
  [HttpError](src/HttpError.ts).

Checks of `signal.aborted` and `activeController !== controller` provide additional protection before publishing
results. In `finally`, an operation clears `activeController` only if it still owns that controller,
so an older operation cannot clear a newer request's controller.

An “is this response current?” flag alone could prevent outdated rendering, but would leave the unnecessary
request and response processing running. `AbortController` actually interrupts the client operation and reduces
wasted work. It cannot guarantee that server processing stops after the server has received the request.
The controller identity checks supplement cancellation rather than replace it.

In [tests/createCountrySearch.test.ts](tests/createCountrySearch.test.ts), the mocked `fetch` responds to the
abort signal. The test verifies that the first request rejects with `AbortError` immediately after new input,
and that attempting to deliver its response after the second response does not change the final state.

## 2. Choosing the debounce delay

The current `DEBOUNCE_DELAY_MS` value in [src/view/App.ts](src/view/App.ts) is **300 ms**.
The custom [debounce](src/debounce.ts) implementation resets the previous timer and invokes the function with
the latest arguments only after input has stopped for the configured interval.

The 300 ms delay groups keystrokes separated by short pauses while keeping the wait after typing brief.
It balances reducing intermediate API requests with responsiveness: the request starts 0.3 seconds after
the final input event, followed by the network response time. The loading indicator appears only when
the request actually starts. This is a practical starting point, not an optimum established through measurement.

Without debounce, every non-empty input change would start a request. Even with immediate cancellation,
some work may already have started in the browser and on the server. This increases request volume and
loading-state transitions. Cancellation remains necessary to prevent outdated results.

A much longer delay would reduce requests during pauses in typing, but leave the interface without results
for longer and make it feel slow. Debounce controls request frequency; it does not replace cancellation
or a network timeout. Explicit retries through `retry()` bypass the debounce delay.

The debounce and search-controller tests also use **300 ms** in some scenarios. Tests configure this value
independently through the `debounceMs` option. History selections and explicit retries bypass the delay.

## 3. Computational complexity

### `mapCountryResponse(raw)`

The function in [src/countries/mapCountryResponse.ts](src/countries/mapCountryResponse.ts) processes
**one country**. Let `L` be the number of languages associated with that country.

Reading the name, flag, region, and population takes `O(1)` time. If capitals are supplied as an array,
only its first element is accessed. Languages are traversed using `map` for an array of objects or
`Object.values` for a dictionary, requiring `O(L)` time and a new array of `L` elements.

- Time: **`O(1 + L)`**, or `O(L)` as the number of languages grows.
- Additional result memory: **`O(1 + L)`**. Other fields are not recursively copied, and strings undergo
  no explicit character-by-character transformation.

For `N` countries, mapping alone takes `O(N + ΣLᵢ)` time and result memory.
Network requests, JSON parsing, and DOM construction are outside this estimate.

### Caching and request deduplication

[src/searchCountries.ts](src/searchCountries.ts) provides `createCountrySearchClient`, which creates two maps:

- `cache` stores completed country arrays by a trimmed, lowercase query key. Successful responses and empty
  HTTP 404 results are cached. HTTP failures, network errors, and cancelled requests are not cached.
- `pending` stores one transport promise and a private `AbortController` per query, together with a subscriber
  count. Concurrent identical searches reuse this transport promise, while each caller receives a separate
  wrapper promise governed by its own signal.

When one caller cancels or times out, only its wrapper rejects. Other subscribers keep waiting for the shared
response. When the last caller cancels, the pending entry is removed immediately and the transport is aborted.
An identical query can then start a fresh request without waiting for the old request to finish rejecting.
Cleanup checks entry identity so an older request cannot remove its replacement, and an aborted transport
cannot populate the cache even if a mock or transport delivers a late response.

The exported `searchCountries` function uses one shared client for ordinary searches, history selections,
and country-detail loading. Tests create fresh clients to keep caches independent between cases.
`createCountrySearch.runSearch` updates `state.countries` only after checking that its result is still current;
the shared transport itself does not update UI state. Cached arrays are reused by reference and treated as
read-only by consumers; mapping creates new card objects.

Let `Q` be the query length. Normalizing the query takes `O(Q)`. Map lookup, insertion, and deletion take
expected `O(1)` time under the usual hash-table model, with string hashing potentially adding `O(Q)`.
A cache hit therefore takes `O(Q)` time without copying or remapping the stored response. Joining an existing
request also takes `O(Q)` time and adds `O(1)` caller state. Settling a shared response takes `O(S)` to notify
its `S` attached caller promises, in addition to the cost of JSON parsing.

Let `C` be the number of cached queries and `P` the number of pending queries. Excluding response-body buffers,
memory is `O(C + P + S + ΣQᵢ + ΣDᵢ)`, where `S` counts caller wrappers attached to pending transport promises,
`Qᵢ` accounts for stored query keys, and `Dᵢ` accounts for cached response data. There is no TTL or size limit:
the cache is kept in memory for the page session and resets on reload. Query history persists separately.

### Country-detail cache

[src/view/CountryCard.ts](src/view/CountryCard.ts) contains a separate
`detailsCache: Map<string, CountryCard>`. It stores successfully loaded **country details by country name**,
allowing subsequent card openings to reuse those details. `hasDetails` determines whether another request is
needed, and `detailsCache.set` stores the result after a successful `fetchDetails` call.

Under the usual hash-table model, `Map.get` takes expected `O(1)` time and `Map.set` takes amortized expected
`O(1)` time, treating key handling as constant. This is a practical complexity model, not a worst-case guarantee
for every JavaScript implementation. Including the cost of hashing a string key of length `Q` can add `O(Q)`.

For `K` cached countries, memory usage is `O(K + ΣQᵢ + ΣDᵢ)`, where `Qᵢ` is the key length and `Dᵢ` is the size
of the stored country data. With bounded key and entry sizes, this simplifies to `O(K)`.

The cache has no TTL or size limit; entries remain until the page reloads. It stores completed objects,
not pending promises, so it does not itself deduplicate requests in flight.

### Recent search history

[src/searchHistory.ts](src/searchHistory.ts) stores the five latest unique completed queries in localStorage
under `country-search:history`, newest first. Queries are trimmed and deduplicated without regard to case.
Only `success` and `empty` results are recorded, so intermediate keystrokes, cancelled searches, and failures
do not fill the history. Repeating a query moves it to the front.

The storage provider is injected so the history model can be tested without a browser. Malformed stored data
is ignored. If storage access or writing fails, search continues and new history remains available in memory
for the current session.

Let `H` be the history limit and `Q` the maximum query length. Adding a query and serializing the updated list
take `O(H × Q)` time and memory. With `H = 5`, this is `O(Q)`. Restoring history takes `O(B)` time and memory
for a stored JSON payload of `B` characters, including parsing and validation.

[src/view/SearchHistory.ts](src/view/SearchHistory.ts) renders accessible buttons next to the search label.
On narrow screens, they wrap below it. Selecting a query fills and focuses the input and starts an immediate
search. History stores query strings rather than API responses. Selecting an item reuses the in-memory query
cache when available; after a page reload, the first search for that query needs a network request.

## 4. Clean code principles

| Principle                                       | Concrete application                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Separation of concerns                          | `debounce` in `src/debounce.ts` manages timing; `searchCountries` in `src/searchCountries.ts` handles HTTP requests and response statuses; `createCountrySearch` in `src/createCountrySearch.ts` coordinates cancellation and state; `App` in `src/view/App.ts` builds the interface and renders states. |
| Pure transformation                             | `mapCountryResponse` in `src/countries/mapCountryResponse.ts` does not mutate its input or access the network or DOM. It returns a new card object and can be tested using JSON fixtures without a browser.                                                                                              |
| Explicit contracts                              | `CountryApiResponse` and `CountryCard` in `src/countries/country.types.ts` separate external data from the card model. The `SearchState` union in `src/createCountrySearch.ts` describes valid states and their associated data.                                                                         |
| Configuration and callbacks supplied externally | `createCountrySearch` accepts `debounceMs`, `timeoutMs`, and `onStateChange`. Search coordination does not depend on the DOM, and tests can configure delays and collect emitted states.                                                                                                                 |
| Early returns                                   | `runSearch` exits early for empty or cancelled searches; `retry` exits when there is no previous query; `searchCountries` returns early for empty input and HTTP 404. This reduces nesting in the main execution path.                                                                                   |
| Explicit error handling                         | `HttpError` in `src/HttpError.ts` stores the HTTP status. `runSearch` distinguishes cancellation, timeouts, and actual failures, so expected cancellation is not presented as an error.                                                                                                                  |
| Named configuration values                      | `DEBOUNCE_DELAY_MS` and `REQUEST_TIMEOUT_MS` in `src/view/App.ts` communicate both the purpose and units of the timing settings.                                                                                                                                                                         |
| Reusable focused functions                      | `prepareRequest` in `src/createCountrySearch.ts` shares request preparation between search and retry. `createEl` in `src/helpers.ts` reduces repeated DOM creation code. `createFlag` and formatting functions in `src/view/CountryCard.ts` support both cards and details.                              |

The purity claim applies specifically to `mapCountryResponse`. The search client performs network requests
and maintains its cache; `createCountrySearch` updates search state, while view functions interact with the DOM.
