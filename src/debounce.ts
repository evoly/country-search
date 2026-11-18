export function debounce<This, Args extends unknown[]>(
    fn: (this: This, ...args: Args) => unknown,
    delay: number,
): (this: This, ...args: Args) => void {
    let timer: ReturnType<typeof setTimeout> | undefined;

    return function (this: This, ...args: Args): void {
        if (timer !== undefined) {
            clearTimeout(timer);
        }

        timer = setTimeout(() => {
            timer = undefined;
            fn.apply(this, args);
        }, delay);
    };
}
