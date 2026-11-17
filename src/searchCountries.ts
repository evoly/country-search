import { HttpError } from './HttpError';
import type { CountryApiResponse } from './countries/country.types';

export type Country = CountryApiResponse;

export const state: { countries: Country[] } = {
    countries: [],
};

interface PendingRequest {
    controller: AbortController;
    promise: Promise<Country[]>;
    subscribers: number;
}

const fetchCountries = async (query: string, signal: AbortSignal): Promise<Country[]> => {
    const response = await fetch(`https://countries.dev/name/${encodeURIComponent(query)}`, { signal });

    if (response.status === 404) {
        return [];
    }

    if (!response.ok) {
        throw new HttpError(response.status);
    }

    return response.json();
};

export const createCountrySearchClient = () => {
    const cache = new Map<string, Country[]>();
    const pending = new Map<string, PendingRequest>();

    const startRequest = (query: string, key: string): PendingRequest => {
        const controller = new AbortController();
        const request: PendingRequest = {
            controller,
            subscribers: 0,
            promise: fetchCountries(query, controller.signal)
                .then((countries) => {
                    controller.signal.throwIfAborted();
                    cache.set(key, countries);
                    return countries;
                })
                .finally(() => {
                    // An older cancelled request must not remove its replacement.
                    if (pending.get(key) === request) pending.delete(key);
                }),
        };

        pending.set(key, request);
        return request;
    };

    const subscribe = (key: string, request: PendingRequest, signal?: AbortSignal): Promise<Country[]> =>
        new Promise((resolve, reject) => {
            request.subscribers += 1;
            let settled = false;

            const cleanup = (): boolean => {
                if (settled) return false;
                settled = true;
                signal?.removeEventListener('abort', onAbort);
                request.subscribers -= 1;
                return true;
            };

            const onAbort = (): void => {
                if (!cleanup()) return;

                const reason = signal?.reason ?? new DOMException('Aborted', 'AbortError');
                reject(reason);

                if (request.subscribers === 0 && pending.get(key) === request) {
                    pending.delete(key);
                    request.controller.abort(reason);
                }
            };

            signal?.addEventListener('abort', onAbort, { once: true });
            // Also handle a signal aborted while the request was being created.
            if (signal?.aborted) onAbort();

            request.promise.then(
                (countries) => {
                    if (cleanup()) resolve(countries);
                },
                (error: unknown) => {
                    if (cleanup()) reject(error);
                },
            );
        });

    return (query: string, signal?: AbortSignal): Promise<Country[]> => {
        if (signal?.aborted) return Promise.reject(signal.reason);

        const normalizedQuery = query.trim();
        if (!normalizedQuery) return Promise.resolve([]);

        const key = normalizedQuery.toLowerCase();
        const cached = cache.get(key);
        if (cached !== undefined) return Promise.resolve(cached);

        const request = pending.get(key) ?? startRequest(normalizedQuery, key);
        return subscribe(key, request, signal);
    };
};

// The app and history selections share one cache and pending-request registry.
export const searchCountries = createCountrySearchClient();
