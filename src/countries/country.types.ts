export interface CountryApiResponse {
    name: string;
    flag: string;
    flags: {
        png: string;
        svg: string;
    };
    capital: string | null;
    region: string;
    population: number;
    languages: {
        name: string;
        iso639_1?: string;
        iso639_2?: string;
        nativeName?: string;
    }[];
}

export interface CountryCard {
    name: string;
    flagUrl: string;
    flagEmoji: string;
    capital: string;
    region: string;
    population: number;
    languages: string[];
}
