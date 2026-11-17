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
    throw new Error(`not implemented for ${query} and ${signal}`);
}
