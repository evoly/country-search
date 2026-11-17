import { CountryApiResponse, CountryCard } from './country.types';

export const mapCountryResponse = (raw: CountryApiResponse): CountryCard => {
    const countryName = typeof raw.name === 'string' ? raw.name : raw.name.common;
    const capital = Array.isArray(raw.capital)
        ? (raw.capital[0] ?? 'No official capital')
        : (raw.capital ?? 'No official capital');
    const languages = Array.isArray(raw.languages)
        ? raw.languages.map((language) => language.name)
        : raw.languages
          ? Object.values(raw.languages)
          : [];

    return {
        name: countryName,
        flagUrl: raw.flags?.svg ?? '',
        flagEmoji: raw.flag ?? '',
        capital,
        region: raw.region ?? 'Unknown',
        population: raw.population ?? 0,
        languages,
    };
};
