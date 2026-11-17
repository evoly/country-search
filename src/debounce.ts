export function debounce<This, Args extends unknown[]>(
    fn: (this: This, ...args: Args) => unknown,
    delay: number,
): (this: This, ...args: Args) => void {
    throw new Error(`not implemented for ${fn} and ${delay}`);
}
