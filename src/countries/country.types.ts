export interface CountryCurrency {
    code?: string;
    name: string;
    symbol?: string;
}

export interface CountryApiResponse {
    name: string | { common: string; official?: string };
    flag?: string;
    flags?: {
        png?: string;
        svg?: string;
        alt?: string;
    };
    capital?: string | string[] | null;
    region?: string;
    subregion?: string;
    population?: number;
    area?: number;
    borders?: string[];
    description?: string;
    languages?:
        | Array<{
              name: string;
              iso639_1?: string;
              iso639_2?: string;
              nativeName?: string;
          }>
        | Record<string, string>;
    currencies?: CountryCurrency[] | Record<string, { name: string; symbol?: string }>;
    alpha2Code?: string;
    alpha3Code?: string;
    cioc?: string;
    cca2?: string;
    cca3?: string;
}

export interface CountryCard {
    name: string;
    flagUrl: string;
    flagEmoji: string;
    capital: string;
    region: string;
    population: number;
    languages: string[];
    subregion?: string;
    alpha3Code?: string;
    area?: number;
    borders?: string[];
    currencies?: CountryCurrency[];
    description?: string;
}
