import { CountryApiResponse, CountryCard } from './country.types';

export const mapCountryResponse = (raw: CountryApiResponse): CountryCard => {
    return {
        name: raw.name,
        flagUrl: raw.flags.svg,
        flagEmoji: raw.flag,
        capital: raw.capital ?? 'Нет данных',
        region: raw.region,
        population: raw.population,
        languages: raw.languages.map((language) => language.name),
    };
};
