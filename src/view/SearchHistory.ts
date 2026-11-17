import { createEl } from '../helpers';

export const createSearchHistoryView = (onSelect: (query: string) => void) => {
    const element = createEl('nav', {
        className: 'search-history',
        hidden: true,
    });
    element.setAttribute('aria-label', 'Recent searches');

    const label = createEl('span', {
        className: 'search-history-label',
        textContent: 'Recent:',
    });
    const list = createEl('ul', { className: 'search-history-list' });

    element.append(label, list);

    return {
        element,

        render(queries: readonly string[]): void {
            const items = queries.map((query) => {
                const item = createEl('li');
                const button = createEl('button', {
                    className: 'search-history-button',
                    type: 'button',
                    textContent: query,
                    title: query,
                    onclick: () => onSelect(query),
                });
                button.setAttribute('aria-label', `Search again for ${query}`);
                item.append(button);

                return item;
            });

            list.replaceChildren(...items);
            element.hidden = queries.length === 0;
        },
    };
};
