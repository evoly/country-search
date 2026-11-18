import { afterEach, expect, it, vi } from 'vitest';
import { createCountrySearch, type SearchState } from '../src/createCountrySearch';
import type { CountryApiResponse } from '../src/countries/country.types';

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

it('отменяет старый запрос и сохраняет результат последнего', async () => {
    vi.useFakeTimers();

    const requests: Array<{
        signal: AbortSignal;
        promise: Promise<Response>;
        respond: (body: unknown) => void;
    }> = [];

    vi.stubGlobal(
        'fetch',
        vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
            const signal = init?.signal;

            if (!signal) {
                throw new Error('fetch должен получить signal');
            }

            let respond!: (body: unknown) => void;

            const promise = new Promise<Response>((resolve, reject) => {
                const onAbort = () => {
                    reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
                };

                respond = (body) => {
                    signal.removeEventListener('abort', onAbort);
                    resolve(Response.json(body));
                };

                if (signal.aborted) {
                    onAbort();
                } else {
                    signal.addEventListener('abort', onAbort, {
                        once: true,
                    });
                }
            });

            requests.push({ signal, promise, respond });
            return promise;
        }),
    );

    const country = (name: string): CountryApiResponse => ({
        name,
        capital: name === 'Spain' ? 'Madrid' : 'Paris',
        region: 'Europe',
        population: 1,
        languages: [],
        flag: '🌐',
        flags: { png: 'https://example.test/flag.png' },
    });

    const states: SearchState[] = [];

    const search = createCountrySearch({
        onStateChange: (next) => states.push(next),
        debounceMs: 300,
        timeoutMs: 10_000,
    });

    // Первый запрос действительно начинает выполняться.
    search.search('Spain');
    await vi.advanceTimersByTimeAsync(300);

    expect(requests).toHaveLength(1);

    const first = requests[0];

    // Наблюдаем именно исход промиса fetch.
    const firstOutcome = first.promise.then(
        () => 'fulfilled',
        (error: unknown) => (error instanceof Error ? error.name : 'unknown'),
    );

    // Новый ввод должен отменить уже выполняющийся запрос.
    search.search('France');

    expect(first.signal.aborted).toBe(true);
    await expect(firstOutcome).resolves.toBe('AbortError');

    await vi.advanceTimersByTimeAsync(300);
    expect(requests).toHaveLength(2);

    // Ответ второго запроса доставляется раньше первого.
    requests[1].respond([country('France')]);
    await vi.advanceTimersByTimeAsync(0);

    expect(states.at(-1)).toMatchObject({
        status: 'success',
        query: 'France',
        countries: [{ name: 'France' }],
    });

    const statesBeforeLateResponse = [...states];

    // Поздний ответ первого запроса:
    // resolve ничего не изменит — промис уже отклонён.
    first.respond([country('Spain')]);
    await vi.advanceTimersByTimeAsync(0);

    expect(states).toEqual(statesBeforeLateResponse);
    expect(states.filter((state) => state.status === 'success')).toHaveLength(1);
});
