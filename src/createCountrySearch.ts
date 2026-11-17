import { debounce } from './debounce';
import { HttpError } from './HttpError';
import { searchCountries, state } from './searchCountries';
import type { CountryApiResponse } from './countries/country.types';

export type Country = CountryApiResponse;

export type SearchState =
    | { status: 'idle' }
    | { status: 'loading'; query: string }
    | { status: 'success'; query: string; countries: Country[] }
    | { status: 'empty'; query: string }
    | { status: 'error'; query: string; message: string };

interface SearchOptions {
    onStateChange: (next: SearchState) => void;
    debounceMs: number;
    timeoutMs: number;
}

export const createCountrySearch = ({ onStateChange, debounceMs, timeoutMs }: SearchOptions) => {
    let lastQuery = '';
    let activeController: AbortController | undefined;

    const prepareRequest = (): AbortController => {
        activeController?.abort();
        activeController = new AbortController();
        state.countries = [];

        return activeController;
    };

    const runSearch = async (query: string, controller: AbortController): Promise<void> => {
        if (!query || controller.signal.aborted || activeController !== controller) {
            return;
        }

        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);

        onStateChange({ status: 'loading', query });

        try {
            const countries = await searchCountries(query, signal);

            if (signal.aborted || activeController !== controller) return;

            state.countries = countries;
            onStateChange(countries.length ? { status: 'success', query, countries } : { status: 'empty', query });
        } catch (error: unknown) {
            // Проверяем ручную отмену отдельно от таймаута.
            if (controller.signal.aborted || activeController !== controller) {
                return;
            }

            if (error instanceof Error && error.name === 'AbortError') {
                onStateChange({ status: 'idle' });
                return;
            }

            let message = 'Check your connection and try again.';

            if (error instanceof HttpError) {
                message = `The server returned an error (HTTP ${error.status}). ` + 'Please try again.';
            } else if (error instanceof Error && error.name === 'TimeoutError') {
                message = 'The search took too long. Please try again.';
            }

            onStateChange({ status: 'error', query, message });
        } finally {
            if (activeController === controller) {
                activeController = undefined;
            }
        }
    };

    const debouncedSearch = debounce((query: string, controller: AbortController) => {
        void runSearch(query, controller);
    }, debounceMs);

    return {
        search(value: string, { immediate = false }: { immediate?: boolean } = {}): void {
            lastQuery = value.trim();
            const controller = prepareRequest();

            onStateChange({ status: 'idle' });

            if (immediate) {
                void runSearch(lastQuery, controller);
            } else {
                // Пустой запрос тоже сбрасывает предыдущий debounce.
                debouncedSearch(lastQuery, controller);
            }
        },

        retry(): void {
            if (!lastQuery) return;

            const controller = prepareRequest();

            // Повтор по кнопке запускается без debounce.
            void runSearch(lastQuery, controller);
        },
    };
};
