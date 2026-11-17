import { describe, expect, it } from 'vitest';
import { mapCountryResponse } from './../src/countries/mapCountryResponse';
import { CountryApiResponse } from './../src/countries/country.types';

const spainFixture = {
    flag: '🇪🇸',
    name: 'Spain',
    flags: {
        png: 'https://flagcdn.com/w320/es.png',
        svg: 'https://flagcdn.com/es.svg',
    },
    region: 'Europe',
    capital: 'Madrid',
    languages: [
        {
            name: 'Spanish',
            iso639_1: 'es',
            iso639_2: 'spa',
            nativeName: 'Español',
        },
    ],
    population: 47351567,
} satisfies CountryApiResponse;

describe('mapCountryResponse', () => {
    it('возвращает только поля карточки, используя SVG для флага', () => {
        expect(mapCountryResponse(spainFixture)).toEqual({
            name: 'Spain',
            flagUrl: 'https://flagcdn.com/es.svg',
            flagEmoji: '🇪🇸',
            capital: 'Madrid',
            region: 'Europe',
            population: 47351567,
            languages: ['Spanish'],
        });
    });

    it('извлекает названия всех языков', () => {
        const raw = {
            ...spainFixture,
            languages: [{ name: 'Spanish' }, { name: 'Catalan' }],
        };

        expect(mapCountryResponse(raw).languages).toEqual(['Spanish', 'Catalan']);
    });

    it('возвращает заглушку, если поле capital отсутствует', () => {
        const raw = { ...spainFixture, capital: null };

        expect(mapCountryResponse(raw).capital).toBe('No official capital');
    });

    it('не изменяет исходные данные', () => {
        const raw = structuredClone(spainFixture);
        const original = structuredClone(raw);

        mapCountryResponse(raw);

        expect(raw).toEqual(original);
    });
});
