import { describe, expect, it, vi } from 'vitest';
import { createSearchHistory, SEARCH_HISTORY_KEY } from '../src/searchHistory';

const createStorage = (initial: string | null = null) => {
    let value = initial;

    return {
        getItem: vi.fn(() => value),
        setItem: vi.fn((_key: string, next: string) => {
            value = next;
        }),
    };
};

describe('search history', () => {
    it('starts empty when no history is stored', () => {
        const storage = createStorage();
        const history = createSearchHistory(() => storage);

        expect(history.getQueries()).toEqual([]);
        expect(storage.getItem).toHaveBeenCalledWith(SEARCH_HISTORY_KEY);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('restores valid unique queries, trims whitespace and keeps the five most recent', () => {
        const storage = createStorage(
            JSON.stringify([' Spain ', 42, '', 'spain', 'France', 'Japan', 'Italy', 'Canada', 'Brazil']),
        );
        const history = createSearchHistory(() => storage);

        expect(history.getQueries()).toEqual(['Spain', 'France', 'Japan', 'Italy', 'Canada']);
    });

    it.each(['invalid json', 'null', '{}', '42', '"Spain"'])('ignores malformed storage: %s', (value) => {
        const history = createSearchHistory(() => createStorage(value));

        expect(history.getQueries()).toEqual([]);
    });

    it('stores the latest five searches, moving repeated queries to the front regardless of case', () => {
        const storage = createStorage();
        const history = createSearchHistory(() => storage);

        for (const query of ['Spain', 'France', 'Japan', 'Italy', 'Canada', 'Brazil', ' france ']) {
            history.add(query);
        }

        expect(history.getQueries()).toEqual(['france', 'Brazil', 'Canada', 'Italy', 'Japan']);
        expect(storage.setItem).toHaveBeenLastCalledWith(
            SEARCH_HISTORY_KEY,
            JSON.stringify(['france', 'Brazil', 'Canada', 'Italy', 'Japan']),
        );
        expect(createSearchHistory(() => storage).getQueries()).toEqual(history.getQueries());
    });

    it('does not add or persist empty searches', () => {
        const storage = createStorage(JSON.stringify(['Spain']));
        const history = createSearchHistory(() => storage);

        expect(history.add('   ')).toEqual(['Spain']);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('keeps history in memory when access to localStorage is blocked', () => {
        const history = createSearchHistory(() => {
            throw new DOMException('Storage unavailable', 'SecurityError');
        });

        expect(history.getQueries()).toEqual([]);
        expect(history.add('Spain')).toEqual(['Spain']);
        expect(history.add('France')).toEqual(['France', 'Spain']);
    });

    it('keeps history usable when a storage write fails', () => {
        const storage = createStorage(JSON.stringify(['Spain']));
        storage.setItem.mockImplementation(() => {
            throw new DOMException('Storage full', 'QuotaExceededError');
        });
        const history = createSearchHistory(() => storage);

        expect(history.add('France')).toEqual(['France', 'Spain']);
        expect(history.getQueries()).toEqual(['France', 'Spain']);
    });
});
