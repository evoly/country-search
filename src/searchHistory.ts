export const SEARCH_HISTORY_KEY = 'country-search:history';
const HISTORY_LIMIT = 5;

type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;

const normalizeQueries = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];

    const queries: string[] = [];
    const seen = new Set<string>();

    for (const item of value) {
        if (typeof item !== 'string') continue;

        const query = item.trim();
        const key = query.toLowerCase();

        if (!query || seen.has(key)) continue;

        queries.push(query);
        seen.add(key);

        if (queries.length === HISTORY_LIMIT) break;
    }

    return queries;
};

export const createSearchHistory = (getStorage: () => HistoryStorage) => {
    let queries: string[] = [];

    try {
        const stored = getStorage().getItem(SEARCH_HISTORY_KEY);
        queries = normalizeQueries(stored === null ? [] : JSON.parse(stored));
    } catch {
        // Invalid or unavailable storage must not prevent searching.
    }

    return {
        getQueries: (): string[] => [...queries],

        add(query: string): string[] {
            if (!query.trim()) return [...queries];

            queries = normalizeQueries([query, ...queries]);

            try {
                getStorage().setItem(SEARCH_HISTORY_KEY, JSON.stringify(queries));
            } catch {
                // Keep this session's history usable if persistence fails.
            }

            return [...queries];
        },
    };
};
