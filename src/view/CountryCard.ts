import { createEl } from '../helpers';
import type { CountryApiResponse, CountryCard } from '../countries/country.types';

const numberFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
});

const detailsCache = new Map<string, CountryCard>();

export const toCountryCard = (input: CountryCard | CountryApiResponse): CountryCard => {
    if ('flagUrl' in input) return input;

    const currencies = input.currencies;
    const alpha3Code = input.alpha3Code || input.cca3 || input.cioc;
    const normalizedCurrencies =
        currencies === undefined
            ? undefined
            : Array.isArray(currencies)
              ? currencies
              : Object.entries(currencies).map(([code, currency]) => ({
                    ...currency,
                    code,
                }));

    return {
        name: typeof input.name === 'string' ? input.name : input.name.common,
        flagUrl: input.flags?.svg || input.flags?.png || '',
        flagEmoji: input.flag || '',
        capital: Array.isArray(input.capital) ? input.capital.join(', ') : input.capital || '',
        region: input.region || '',
        population: input.population ?? 0,
        languages: Array.isArray(input.languages)
            ? input.languages.map((language) => language.name)
            : Object.values(input.languages || {}),
        ...(input.subregion !== undefined && {
            subregion: input.subregion,
        }),
        ...(alpha3Code !== undefined && { alpha3Code }),
        ...(input.area !== undefined && { area: input.area }),
        ...(input.borders !== undefined && { borders: input.borders }),
        ...(normalizedCurrencies !== undefined && {
            currencies: normalizedCurrencies,
        }),
        ...(input.description !== undefined && {
            description: input.description,
        }),
    };
};

let activeDialog: HTMLDialogElement | undefined;
let dialogSequence = 0;

const icons = {
    capital: '<path d="m3 9 9-6 9 6M4 10h16M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18"/>',
    population:
        '<circle cx="9" cy="7" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m1-17a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2"/>',
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
};

const createIcon = (name: keyof typeof icons): SVGSVGElement => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');

    // Только статические SVG-пути из объекта icons.
    svg.innerHTML = icons[name];

    return svg;
};

const createFlag = (country: CountryCard): HTMLDivElement => {
    const flag = createEl('div', {
        className: 'country-card-flag',
    });

    const fallback = createEl('span', {
        className: 'country-card-flag-fallback',
        textContent: country.flagEmoji || '🌐',
        hidden: true,
    });

    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', country.flagEmoji ? `Flag of ${country.name}` : 'Flag unavailable');

    const image = createEl('img', {
        className: 'country-card-flag-image',
        src: country.flagUrl,
        alt: `Flag of ${country.name}`,
        loading: 'lazy' as const,
        decoding: 'async' as const,
        width: 174,
        height: 116,
    });

    image.addEventListener(
        'error',
        () => {
            image.hidden = true;
            fallback.hidden = false;
        },
        { once: true },
    );

    flag.append(image, fallback);
    return flag;
};

const formatPopulation = (population: number): string => {
    if (population >= 1_000_000_000) {
        return `${numberFormatter.format(population / 1_000_000_000)} billion`;
    }

    if (population >= 1_000_000) {
        return `${numberFormatter.format(population / 1_000_000)} million`;
    }

    return numberFormatter.format(population);
};

const formatCurrencies = (currencies: CountryCard['currencies']): string =>
    currencies
        ?.map((currency) => {
            const identifier = [currency.code, currency.symbol].filter(Boolean).join(', ');

            return `${currency.name}${identifier ? ` (${identifier})` : ''}`;
        })
        .join(', ') || 'Not available';

const hasDetails = (country: CountryCard): boolean =>
    typeof country.area === 'number' && Array.isArray(country.borders) && country.currencies !== undefined;

const fetchDetails = async (country: CountryCard, signal: AbortSignal): Promise<CountryCard> => {
    const normalizedQuery = country.name.trim().toLowerCase();

    const response = await fetch(`https://countries.dev/name/${encodeURIComponent(normalizedQuery)}`, { signal });

    if (!response.ok) {
        throw new Error('Country details request failed');
    }

    const payload = await response.json();

    const countries: CountryApiResponse[] = Array.isArray(payload) ? payload : [payload];

    const result = countries.find((item) => {
        const name = typeof item?.name === 'string' ? item.name : item?.name?.common;

        return typeof name === 'string' && name.trim().toLowerCase() === normalizedQuery;
    });

    if (!result) {
        throw new Error('Country not found');
    }

    const details = toCountryCard(result);
    const description = country.description ?? details.description;

    return {
        ...details,
        ...(description !== undefined && { description }),
    };
};

const openCountryDetails = (
    country: CountryCard,
    trigger: HTMLButtonElement,
    onDetailsLoaded: (details: CountryCard) => void,
): void => {
    activeDialog?.close();

    const dialog = createEl('dialog', {
        className: 'country-modal',
    });

    const id = `country-details-${++dialogSequence}`;

    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute('aria-describedby', `${id}-description`);

    const content = createEl('div', {
        className: 'country-modal-content',
    });

    const close = createEl('button', {
        className: 'country-modal-close',
        type: 'button' as const,
    });

    close.setAttribute('aria-label', 'Close country details');
    close.autofocus = true;
    close.append(createIcon('close'));
    close.addEventListener('click', () => dialog.close());

    const header = createEl('div', {
        className: 'country-modal-header',
    });

    const headingGroup = createEl('div', {
        className: 'country-card-heading',
    });

    const heading = createEl('h2', {
        className: 'country-card-name',
        textContent: country.name,
    });

    heading.id = `${id}-title`;

    const region = createEl('p', {
        className: 'country-card-region',
    });

    headingGroup.append(heading, region);
    header.append(createFlag(country), headingGroup);

    const description = createEl('p', {
        className: 'country-modal-description',
    });

    description.id = `${id}-description`;

    const facts = createEl('dl', {
        className: 'country-modal-facts',
    });

    const values = new Map<string, HTMLElement>();

    for (const label of ['Capital', 'Population', 'Area', 'Borders', 'Languages', 'Currency']) {
        const row = createEl('div', {
            className: 'country-modal-fact',
        });

        const value = createEl('dd', {});
        values.set(label, value);

        row.append(createEl('dt', { textContent: label }), value);

        facts.append(row);
    }

    const status = createEl('p', {
        className: 'country-modal-status',
    });

    status.setAttribute('role', 'status');

    const retry = createEl('button', {
        className: 'country-modal-retry',
        type: 'button' as const,
        textContent: 'Try again',
        hidden: true,
    });

    content.append(close, header, description, facts, status, retry);

    dialog.append(content);

    const render = (details: CountryCard): void => {
        region.textContent = [details.region, details.subregion].filter(Boolean).join(' · ');

        description.textContent =
            details.description ||
            `${details.name} is a country${
                details.subregion || details.region ? ` in ${details.subregion || details.region}` : ''
            }.${details.capital ? ` Its capital is ${details.capital}.` : ''}`;

        const fields: Record<string, string> = {
            Capital: details.capital || 'Not available',
            Population: numberFormatter.format(details.population),
            Area: typeof details.area === 'number' ? `${numberFormatter.format(details.area)} km²` : 'Not available',
            Borders: details.borders ? details.borders.join(', ') || 'No land borders' : 'Not available',
            Languages: details.languages.join(', ') || 'Not available',
            Currency: formatCurrencies(details.currencies),
        };

        for (const [label, value] of Object.entries(fields)) {
            values.get(label)!.textContent = value;
        }
    };

    let request: AbortController | undefined;

    const load = async (): Promise<void> => {
        request?.abort();

        const controller = new AbortController();
        request = controller;

        const timeout = window.setTimeout(() => controller.abort(), 15_000);

        retry.hidden = true;
        status.textContent = 'Loading country details…';
        facts.setAttribute('aria-busy', 'true');

        try {
            const fetched = await fetchDetails(country, controller.signal);

            if (!dialog.open || controller.signal.aborted) return;

            detailsCache.set(country.name, fetched);
            render(fetched);
            onDetailsLoaded(fetched);
            status.textContent = '';
        } catch {
            if (!dialog.open) return;

            status.textContent = 'Additional details could not be loaded. Please try again.';

            retry.hidden = false;
        } finally {
            window.clearTimeout(timeout);
            facts.removeAttribute('aria-busy');
        }
    };

    retry.addEventListener('click', () => void load());

    dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;

        const bounds = dialog.getBoundingClientRect();

        const outside =
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom;

        if (outside) dialog.close();
    });

    dialog.addEventListener(
        'close',
        () => {
            request?.abort();
            dialog.remove();

            if (activeDialog === dialog) {
                activeDialog = undefined;

                if (trigger.isConnected) {
                    trigger.focus({ preventScroll: true });
                }
            }
        },
        { once: true },
    );

    const initial = hasDetails(country) ? country : detailsCache.get(country.name) || country;

    render(initial);

    document.body.append(dialog);
    activeDialog = dialog;
    dialog.showModal();

    if (!hasDetails(initial)) void load();
};

export const createCountryCard = (input: CountryCard | CountryApiResponse): HTMLLIElement => {
    const country = toCountryCard(input);

    const details = hasDetails(country) ? country : detailsCache.get(country.name) || country;

    const card = createEl('li', {
        className: 'country-card',
    });

    const header = createEl('div', {
        className: 'country-card-header',
    });

    const headingGroup = createEl('div', {
        className: 'country-card-heading',
    });

    const heading = createEl('h2', {
        className: 'country-card-name',
        textContent: country.name,
    });

    const region = createEl('p', {
        className: 'country-card-region',
        textContent: [details.region, details.subregion].filter(Boolean).join(' · '),
    });

    const code = createEl('span', {
        className: 'country-card-code',
        textContent: details.alpha3Code || '',
    });

    headingGroup.append(heading, region);
    header.append(createFlag(country), headingGroup, code);

    const facts = createEl('dl', {
        className: 'country-card-details',
    });

    for (const fact of [
        {
            label: 'Capital',
            value: country.capital || 'Not available',
            icon: 'capital' as const,
        },
        {
            label: 'Population',
            value: formatPopulation(country.population),
            icon: 'population' as const,
        },
    ]) {
        const row = createEl('div', {
            className: 'country-card-fact',
        });

        const label = createEl('dt', {});

        label.append(createIcon(fact.icon), document.createTextNode(fact.label));

        row.append(label, createEl('dd', { textContent: fact.value }));

        facts.append(row);
    }

    const open = createEl('button', {
        className: 'country-card-open',
        type: 'button' as const,
    });

    open.setAttribute('aria-haspopup', 'dialog');
    open.setAttribute('aria-label', `View country details for ${country.name}`);

    open.append(document.createTextNode('View country details'), createIcon('arrow'));

    open.addEventListener('click', () =>
        openCountryDetails(country, open, (loaded) => {
            code.textContent = loaded.alpha3Code || '';

            region.textContent = [loaded.region, loaded.subregion].filter(Boolean).join(' · ');
        }),
    );

    card.append(header, facts, open);
    return card;
};
