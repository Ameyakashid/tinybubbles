export type TinyBubblesToolErrorCode = 'read_only' | 'not_found' | 'validation_error' | 'internal_error';

export class TinyBubblesToolError extends Error {
  readonly code: TinyBubblesToolErrorCode;

  constructor(message: string, code: TinyBubblesToolErrorCode) {
    super(message);
    this.name = 'TinyBubblesToolError';
    this.code = code;
  }
}

export class ReadOnlyError extends TinyBubblesToolError {
  constructor(message = 'Database opened read-only. Start the server with --write to enable edits.') {
    super(message, 'read_only');
    this.name = 'ReadOnlyError';
  }
}

export class NotFoundError extends TinyBubblesToolError {
  constructor(message: string) {
    super(message, 'not_found');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends TinyBubblesToolError {
  constructor(message: string) {
    super(message, 'validation_error');
    this.name = 'ValidationError';
  }
}

export const getTinyBubblesToolErrorCode = (error: unknown): TinyBubblesToolErrorCode =>
  error instanceof TinyBubblesToolError ? error.code : 'internal_error';
