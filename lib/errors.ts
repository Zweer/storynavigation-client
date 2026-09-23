/** Base class for all errors thrown by the StoryNavigation client. */
export class StoryNavigationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryNavigationError';
  }
}

/**
 * Thrown when a request is rejected with `419 CSRF token mismatch`,
 * i.e. the session/CSRF token is missing, invalid, or was not bootstrapped.
 */
export class CsrfError extends StoryNavigationError {
  constructor(message = 'CSRF token mismatch') {
    super(message);
    this.name = 'CsrfError';
  }
}

/**
 * Thrown when an endpoint returns `500 Server Error`.
 * Known to happen for the broken endpoints `paginate-medias`
 * and `get-post-by-short-code`.
 */
export class ServerError extends StoryNavigationError {
  constructor(
    public readonly endpoint: string,
    message = 'Server Error',
  ) {
    super(`${message} (${endpoint})`);
    this.name = 'ServerError';
  }
}

/**
 * Thrown when the requested account does not exist or is not resolvable
 * (`get-user-profile` returns `{ found: false }`).
 */
export class NotFoundError extends StoryNavigationError {
  constructor(public readonly userName: string) {
    super(`Account not found: ${userName}`);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when the CDN proxy refuses a media URL with `403`, meaning the
 * signed Instagram URL has expired or its signature no longer matches
 * (`URL signature mismatch` / `Bad URL hash`). Media URLs must be
 * downloaded immediately after they are received (fetch-then-download-now).
 */
export class ExpiredUrlError extends StoryNavigationError {
  constructor(message = 'URL signature mismatch — the media URL has expired') {
    super(message);
    this.name = 'ExpiredUrlError';
  }
}

/**
 * Thrown for unexpected, non-mapped HTTP failures (any status that is not
 * specifically handled as {@link CsrfError} / {@link ServerError}).
 */
export class HttpError extends StoryNavigationError {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message?: string,
  ) {
    super(message ?? `Unexpected HTTP ${status} (${endpoint})`);
    this.name = 'HttpError';
  }
}
