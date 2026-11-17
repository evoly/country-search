import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './../src/debounce';

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('не вызывает функцию сразу, а ждет истечения delay', () => {
        const mockFn = vi.fn();
        const debounced = debounce(mockFn, 300);

        debounced('Sweden');
        expect(mockFn).not.toHaveBeenCalled(); // Сразу после вызова — тишина

        vi.advanceTimersByTime(299);
        expect(mockFn).not.toHaveBeenCalled(); // За 1 мс до конца — всё еще тишина

        vi.advanceTimersByTime(1);
        expect(mockFn).toHaveBeenCalledTimes(1); // Ровно через 300 мс — сработала
        expect(mockFn).toHaveBeenCalledWith('Sweden');
    });

    it('сбрасывает таймер при повторных вызовах и передает только последние аргументы', () => {
        const mockFn = vi.fn();
        const debounced = debounce(mockFn, 300);

        debounced('S');
        vi.advanceTimersByTime(100);

        debounced('Sw');
        vi.advanceTimersByTime(100);

        debounced('Swe');
        vi.advanceTimersByTime(299);
        expect(mockFn).not.toHaveBeenCalled(); // Прошло 499 мс с начала, но всего 299 мс с последнего ввода

        vi.advanceTimersByTime(1);
        expect(mockFn).toHaveBeenCalledTimes(1); // Вызвалась ровно 1 раз вместо 3
        expect(mockFn).toHaveBeenCalledWith('Swe'); // С самым свежим значением
    });

    it('позволяет вызывать функцию снова после завершения предыдущего цикла', () => {
        const mockFn = vi.fn();
        const debounced = debounce(mockFn, 200);

        debounced('first');
        vi.advanceTimersByTime(200);
        expect(mockFn).toHaveBeenCalledTimes(1);

        debounced('second');
        vi.advanceTimersByTime(200);
        expect(mockFn).toHaveBeenCalledTimes(2);
        expect(mockFn).toHaveBeenLastCalledWith('second');
    });
});
