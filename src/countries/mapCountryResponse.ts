import { CountryApiResponse, CountryCard } from './country.types';

export const mapCountryResponse = (raw: CountryApiResponse): CountryCard => {
    throw new Error(`Function not implemented for ${raw.name}`);
};
