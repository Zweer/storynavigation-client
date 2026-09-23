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
 * Thrown when the CDN proxy returns `403 Bad URL hash`, meaning the
 * signed Instagram URL has expired. Media URLs must be downloaded
 * immediately after they are received (fetch-then-download-now).
 */
export class ExpiredUrlError extends StoryNavigationError {
  constructor(message = 'Bad URL hash — the media URL has expired') {
    super(message);
    this.name = 'ExpiredUrlError';
  }
}
