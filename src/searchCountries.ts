export type Country = {
    name: {
        common: string;
    };
    cca2: string;
};

export const state: { countries: Country[] } = {
    countries: [],
};

export async function searchCountries(query: string, signal?: AbortSignal): Promise<Country[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        state.countries = [];
        return [];
    }

    const response = await fetch(`https://countries.dev/name/${encodeURIComponent(normalizedQuery)}`, {
        signal: signal ?? null,
    });

    if (response.status === 404) {
        state.countries = [];
        return [];
    }

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const countries: Country[] = await response.json();

    state.countries = countries;
    console.log('Fetched countries:', countries);

    return countries;
}
