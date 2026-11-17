import { createEl } from '../helpers';
import { createCountrySearch, type SearchState } from '../createCountrySearch';
import { mapCountryResponse } from '../countries/mapCountryResponse';
import { createCountryCard } from './CountryCard';
import { createSearchHistory } from '../searchHistory';
import { createSearchHistoryView } from './SearchHistory';

const DEBOUNCE_DELAY_MS = 300;
const REQUEST_TIMEOUT_MS = 5000;

const App = () => {
    const main = createEl('main', {
        className: 'container country-search',
    });

    const eyebrow = createEl('span', {
        className: 'eyebrow',
        textContent: 'A little curiosity goes a long way',
    });

    const h1 = createEl('h1', {
        textContent: 'A world to discover.',
    });

    const descr = createEl('p', {
        className: 'search-description',
        textContent: 'Every country has a story. Search for a place and get to know it a little better.',
    });

    const label = createEl('label', {
        className: 'search-label',
        htmlFor: 'country-search',
        textContent: 'Where are we heading?',
    });

    const history = createSearchHistory(() => window.localStorage);
    const historyView = createSearchHistoryView((query) => {
        input.value = query;
        input.focus();
        countrySearch.search(query, { immediate: true });
    });
    historyView.render(history.getQueries());

    const searchHeader = createEl('div', { className: 'search-header' });
    searchHeader.append(label, historyView.element);

    const searchField = createEl('div', {
        className: 'search-field',
    });

    const icon = createEl('span', {
        className: 'search-icon',
        ariaHidden: 'true',
    });

    const feedback = createEl('div', {
        className: 'search-feedback',
    });
    feedback.dataset.state = 'idle';

    const spinner = createEl('span', {
        className: 'search-spinner',
        ariaHidden: 'true',
        hidden: true,
    });

    const feedbackText = createEl('div', {
        className: 'search-feedback-text',
    });
    feedbackText.setAttribute('role', 'status');
    feedbackText.setAttribute('aria-live', 'polite');
    feedbackText.setAttribute('aria-atomic', 'true');

    const status = createEl('p', {
        id: 'search-status',
        className: 'search-status',
    });

    const detail = createEl('p', {
        className: 'search-status-detail',
        hidden: true,
    });

    const retryButton = createEl('button', {
        type: 'button',
        className: 'search-retry',
        textContent: 'Try again',
        hidden: true,
        onclick: () => {
            input.focus();
            countrySearch.retry();
        },
    });

    const results = createEl('ul', {
        className: 'country-list',
        hidden: true,
    });

    results.setAttribute('aria-label', 'Country search results');

    const renderSearchState = (next: SearchState): void => {
        if (next.status === 'success' || next.status === 'empty') {
            historyView.render(history.add(next.query));
        }

        results.replaceChildren();
        results.hidden = true;
        feedback.dataset.state = next.status;
        spinner.hidden = next.status !== 'loading';
        retryButton.hidden = next.status !== 'error';

        searchField.setAttribute('aria-busy', String(next.status === 'loading'));

        status.textContent = '';
        detail.textContent = '';
        detail.hidden = true;

        switch (next.status) {
            case 'idle':
                return;

            case 'loading':
                status.textContent = 'Searching…';
                return;

            case 'success': {
                const count = next.countries.length;

                status.textContent = `${count} ${count === 1 ? 'country' : 'countries'} found`;

                const cards = next.countries.map((raw) => createCountryCard(mapCountryResponse(raw)));

                results.replaceChildren(...cards);
                results.hidden = false;

                return;
            }

            case 'empty':
                status.textContent = 'No countries found';
                detail.textContent = `No matches for “${next.query}”. ` + 'Try a different country name.';
                detail.hidden = false;
                return;

            case 'error':
                status.textContent = 'We couldn’t load countries';
                detail.textContent = next.message;
                detail.hidden = false;
        }
    };

    const countrySearch = createCountrySearch({
        onStateChange: renderSearchState,
        debounceMs: DEBOUNCE_DELAY_MS,
        timeoutMs: REQUEST_TIMEOUT_MS,
    });

    const input = createEl('input', {
        id: 'country-search',
        type: 'search',
        placeholder: 'Start typing a country…',
        className: 'search-input',
        autocomplete: 'off' as const,
        spellcheck: false,
        oninput: () => countrySearch.search(input.value),
    });

    input.setAttribute('aria-describedby', 'search-status');

    feedbackText.append(status, detail);
    feedback.append(spinner, feedbackText, retryButton);
    searchField.append(icon, input);

    main.append(eyebrow, h1, descr, searchHeader, searchField, feedback, results);

    // Будущие карточки тут

    return [main];
};

export default App;

/*
main.append(
    eyebrow,
    h1,
    descr,
    label,
    searchField,
    feedback,
    results,
);
*/
