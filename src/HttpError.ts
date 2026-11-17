export class HttpError extends Error {
    readonly status: number;

    constructor(_status: number, _message?: string) {
        super();
        throw new Error(`not implemented for ${_status} and ${_message}`);
    }
}
