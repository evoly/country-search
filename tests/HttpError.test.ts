import { describe, expect, it } from 'vitest';
import { HttpError } from './../src/HttpError';

describe('HttpError', () => {
    it('наследуется от Error', () => {
        const error = new HttpError(500);

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(HttpError);
    });

    it.each([403, 500])('сохраняет HTTP-статус %i', (status) => {
        expect(new HttpError(status).status).toBe(status);
    });

    it('имеет имя HttpError', () => {
        expect(new HttpError(500).name).toBe('HttpError');
    });

    it('создаёт сообщение по умолчанию', () => {
        expect(new HttpError(500).message).toBe('HTTP error: 500');
    });

    it('сохраняет переданное сообщение', () => {
        const error = new HttpError(503, 'Service unavailable');

        expect(error.message).toBe('Service unavailable');
    });
});
