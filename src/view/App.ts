import { createEl } from '../helpers';

const App = () => {
    const main = createEl('main', { className: 'container country-search' });

    const eyebrow = createEl('span', {
        className: 'eyebrow',
        textContent: 'A little curiosity goes a long way',
    });

    const h1 = createEl('h1', { textContent: 'A world to discover.' });

    const descr = createEl('p', {
        className: 'search-description',
        textContent: 'Every country has a story. Search for a place and get to know it a little better.',
    });

    const label = createEl('label', {
        className: 'search-label',
        htmlFor: 'country-search',
        textContent: 'Where are we heading?',
    });

    const searchField = createEl('div', { className: 'search-field' });

    const icon = createEl('span', {
        className: 'search-icon',
        ariaHidden: 'true',
    });

    const input = createEl('input', {
        id: 'country-search',
        type: 'search',
        placeholder: 'Start typing a country…',
        className: 'search-input',
        autocomplete: 'off',
        spellcheck: false,

        // oninput: () => onSearch(input.value),

        onkeydown: (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // onSearch(input.value);
            }
        },
    });

    searchField.append(icon, input);
    main.append(eyebrow, h1, descr, label, searchField);

    return [main];
};

export default App;
