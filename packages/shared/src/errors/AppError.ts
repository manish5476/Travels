export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, code: string, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const Errors = {
    badRequest: (msg: string) => new AppError(msg, 400, 'BAD_REQUEST'),
    notFound: (msg: string) => new AppError(msg, 404, 'NOT_FOUND'),
    unauthorized: (msg: string) => new AppError(msg, 401, 'UNAUTHORIZED'),
    forbidden: (msg: string) => new AppError(msg, 403, 'FORBIDDEN'),
    internal: (msg: string) => new AppError(msg, 500, 'INTERNAL_ERROR'),
};
