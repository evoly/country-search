import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCountrySearchClient, type Country } from '../src/searchCountries';
import { createCountrySearch, type SearchState } from '../src/createCountrySearch';
import { HttpError } from '../src/HttpError';

interface Request {
    signal: AbortSignal;
    respond: (countries: Country[], status?: number) => void;
    fail: (error: Error) => void;
}

const setup = (ignoreAbort = false) => {
    const requests: Request[] = [];
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal;
        if (!signal) throw new Error('fetch must receive a transport signal');

        return new Promise<Response>((resolve, reject) => {
            const onAbort = () => reject(signal.reason);
            if (!ignoreAbort) signal.addEventListener('abort', onAbort, { once: true });

            requests.push({
                signal,
                respond: (countries, status = 200) => {
                    signal.removeEventListener('abort', onAbort);
                    resolve(Response.json(countries, { status }));
                },
                fail: (error) => {
                    signal.removeEventListener('abort', onAbort);
                    reject(error);
                },
            });
        });
    });

    vi.stubGlobal('fetch', fetchMock);

    return { requests, fetchMock, search: createCountrySearchClient() };
};

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('query cache and request deduplication', () => {
    it('caches successful results using a trimmed, case-insensitive query key', async () => {
        const { search, requests, fetchMock } = setup();
        const first = search(' Spain ');
        requests[0]!.respond([{ name: 'Spain' }]);
        const result = await first;

        await expect(search('sPaIn')).resolves.toBe(result);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls[0]?.[0]).toBe('https://countries.dev/name/Spain');
    });

    it('caches empty results returned by HTTP 404', async () => {
        const { search, requests, fetchMock } = setup();
        const first = search('unknown');
        requests[0]!.respond([], 404);

        await expect(first).resolves.toEqual([]);
        await expect(search('UNKNOWN')).resolves.toEqual([]);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('shares one fetch between concurrent identical queries', async () => {
        const { search, requests, fetchMock } = setup();
        const first = search('Spain', new AbortController().signal);
        const second = search(' spain ', new AbortController().signal);

        expect(fetchMock).toHaveBeenCalledOnce();
        requests[0]!.respond([{ name: 'Spain' }]);
        const [left, right] = await Promise.all([first, second]);
        expect(left).toBe(right);
    });

    it('does not deduplicate different queries', async () => {
        const { search, requests } = setup();
        const first = search('Spain');
        const second = search('France');

        expect(requests).toHaveLength(2);
        requests[0]!.respond([{ name: 'Spain' }]);
        requests[1]!.respond([{ name: 'France' }]);
        await expect(first).resolves.toEqual([{ name: 'Spain' }]);
        await expect(second).resolves.toEqual([{ name: 'France' }]);
    });

    it('cancels one caller without aborting the shared request or other callers', async () => {
        const { search, requests, fetchMock } = setup();
        const controller = new AbortController();
        const first = search('Spain', controller.signal);
        const second = search('spain', new AbortController().signal);
        const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });

        controller.abort();
        await cancelled;
        expect(requests[0]!.signal.aborted).toBe(false);
        const third = search('SPAIN');
        requests[0]!.respond([{ name: 'Spain' }]);

        await expect(second).resolves.toEqual([{ name: 'Spain' }]);
        await expect(third).resolves.toEqual([{ name: 'Spain' }]);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('preserves a caller timeout without cancelling another caller', async () => {
        const { search, requests } = setup();
        const controller = new AbortController();
        const first = search('Spain', controller.signal);
        const second = search('Spain');
        const reason = new DOMException('Timed out', 'TimeoutError');
        const timedOut = expect(first).rejects.toBe(reason);

        controller.abort(reason);
        await timedOut;
        expect(requests[0]!.signal.aborted).toBe(false);
        requests[0]!.respond([{ name: 'Spain' }]);
        await expect(second).resolves.toEqual([{ name: 'Spain' }]);
    });

    it('aborts the fetch when all callers cancel and safely starts a fresh request', async () => {
        const { search, requests, fetchMock } = setup();
        const left = new AbortController();
        const right = new AbortController();
        const first = search('Spain', left.signal);
        const second = search('Spain', right.signal);
        const cancelled = Promise.all([
            expect(first).rejects.toMatchObject({ name: 'AbortError' }),
            expect(second).rejects.toMatchObject({ name: 'AbortError' }),
        ]);

        left.abort();
        expect(requests[0]!.signal.aborted).toBe(false);
        right.abort();
        expect(requests[0]!.signal.aborted).toBe(true);

        const fresh = search('Spain');
        await cancelled;
        const shared = search('Spain');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        requests[1]!.respond([{ name: 'Spain' }]);
        await Promise.all([fresh, shared]);
    });

    it('does not let a late aborted response overwrite a newer cached result', async () => {
        const { search, requests, fetchMock } = setup(true);
        const controller = new AbortController();
        const first = search('Spain', controller.signal);
        const cancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
        controller.abort();
        await cancelled;

        const fresh = search('Spain');
        requests[1]!.respond([{ name: 'New result' }]);
        await fresh;
        requests[0]!.respond([{ name: 'Old result' }]);
        await vi.waitFor(() => expect(fetchMock).toHaveResolvedTimes(2));

        await expect(search('Spain')).resolves.toEqual([{ name: 'New result' }]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not cache HTTP errors and allows the query to be retried', async () => {
        const { search, requests, fetchMock } = setup();
        const first = search('Spain');
        const second = search('Spain');
        requests[0]!.respond([], 500);
        await expect(first).rejects.toBeInstanceOf(HttpError);
        await expect(second).rejects.toMatchObject({ status: 500 });

        const retry = search('Spain');
        requests[1]!.respond([{ name: 'Spain' }]);
        await expect(retry).resolves.toEqual([{ name: 'Spain' }]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not cache network errors', async () => {
        const { search, requests } = setup();
        const first = search('Spain');
        const error = new TypeError('Failed to fetch');
        requests[0]!.fail(error);
        await expect(first).rejects.toBe(error);

        const retry = search('Spain');
        expect(requests).toHaveLength(2);
        requests[1]!.respond([{ name: 'Spain' }]);
        await retry;
    });

    it('rejects an already-aborted caller even when a cached result exists', async () => {
        const { search, requests, fetchMock } = setup();
        const first = search('Spain');
        requests[0]!.respond([{ name: 'Spain' }]);
        await first;
        const controller = new AbortController();
        controller.abort();

        await expect(search('Spain', controller.signal)).rejects.toBe(controller.signal.reason);
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('removes caller abort listeners after successful or failed completion', async () => {
        const { search, requests } = setup();
        const success = new AbortController();
        const failure = new AbortController();
        const removeSuccess = vi.spyOn(success.signal, 'removeEventListener');
        const removeFailure = vi.spyOn(failure.signal, 'removeEventListener');
        const first = search('Spain', success.signal);
        const second = search('France', failure.signal);
        requests[0]!.respond([{ name: 'Spain' }]);
        requests[1]!.fail(new TypeError('Offline'));

        await first;
        await expect(second).rejects.toThrow('Offline');
        expect(removeSuccess).toHaveBeenCalledWith('abort', expect.any(Function));
        expect(removeFailure).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('keeps two search controllers independent while sharing their transport request', async () => {
        vi.useFakeTimers();
        const { requests, fetchMock } = setup();
        const leftStates: SearchState[] = [];
        const rightStates: SearchState[] = [];
        const left = createCountrySearch({
            onStateChange: (next) => leftStates.push(next),
            debounceMs: 300,
            timeoutMs: 5000,
        });
        const right = createCountrySearch({
            onStateChange: (next) => rightStates.push(next),
            debounceMs: 300,
            timeoutMs: 5000,
        });

        left.search('shared country', { immediate: true });
        right.search('SHARED COUNTRY', { immediate: true });
        expect(fetchMock).toHaveBeenCalledOnce();
        left.search('');
        expect(requests[0]!.signal.aborted).toBe(false);
        requests[0]!.respond([{ name: 'Shared country' }]);
        await vi.advanceTimersByTimeAsync(0);

        expect(leftStates.at(-1)).toEqual({ status: 'idle' });
        expect(rightStates.at(-1)).toMatchObject({ status: 'success', query: 'SHARED COUNTRY' });
    });
});
