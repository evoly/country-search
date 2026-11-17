export const SEARCH_HISTORY_KEY = 'country-search:history';
// const HISTORY_LIMIT = 5;

type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const createSearchHistory = (getStorage: () => HistoryStorage) => {
    throw new Error(`Function not implemented for ${getStorage}`);
};
