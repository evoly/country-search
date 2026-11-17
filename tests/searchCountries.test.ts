import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCountries } from '../src/searchCountries';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
});

describe('searchCountries', () => {
    it('возвращает найденные страны', async () => {
        const countries = [{ name: { common: 'France' }, cca2: 'FR' }];

        fetchMock.mockResolvedValue(new Response(JSON.stringify(countries), { status: 200 }));

        await expect(searchCountries('France')).resolves.toEqual(countries);
    });

    it('кодирует query в URL и передаёт signal в fetch', async () => {
        const controller = new AbortController();

        fetchMock.mockResolvedValue(new Response('[]', { status: 200 }));

        await searchCountries('South Africa', controller.signal);

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledWith(
            'https://countries.dev/name/South%20Africa',
            expect.objectContaining({
                signal: controller.signal,
            }),
        );
    });

    it('не делает запрос для пустого query', async () => {
        await expect(searchCountries('   ')).resolves.toEqual([]);

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('возвращает пустой массив при HTTP 404', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

        await expect(searchCountries('unknown')).resolves.toEqual([]);
    });

    it('выбрасывает ошибку при HTTP 500', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

        await expect(searchCountries('France')).rejects.toThrow();
    });

    it('пробрасывает сетевую ошибку', async () => {
        const error = new TypeError('Failed to fetch');
        fetchMock.mockRejectedValue(error);

        await expect(searchCountries('France')).rejects.toBe(error);
    });

    it('пробрасывает ошибку отмены запроса', async () => {
        const controller = new AbortController();
        controller.abort();

        const error = new DOMException('Aborted', 'AbortError');
        fetchMock.mockRejectedValue(error);

        await expect(searchCountries('France', controller.signal)).rejects.toBe(error);
    });
});
