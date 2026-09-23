import { CsrfError, HttpError, ServerError } from './errors.js';

/** Options for the low-level {@link HttpClient}. */
export interface HttpClientOptions {
  /** Base URL for the deployment (primary or `/mystorysaver-data` mirror). */
  baseUrl: string;
  /** Number of retry attempts for transient failures. Defaults to 2. */
  maxRetries?: number;
  /** Base backoff delay in ms (exponential). Defaults to 300. */
  retryBackoffMs?: number;
  /** Per-request timeout in ms. Defaults to 30000. */
  timeoutMs?: number;
  /** Injectable fetch, mainly for testing. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 300;
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Low-level HTTP client that owns the fragile Laravel session + CSRF flow.
 *
 * Responsibilities:
 * - Bootstrap an anonymous session via `GET /user/<username>` and capture the
 *   `laravel_session` + `XSRF-TOKEN` cookies.
 * - URL-decode the `XSRF-TOKEN` into the `X-XSRF-TOKEN` header.
 * - Send the required headers/cookies on every POST.
 * - Retry transient failures with exponential backoff.
 * - Map known statuses to typed errors (419 → CsrfError, 500 → ServerError).
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  /** Cookie jar: name → value (raw, as received). */
  private readonly cookies = new Map<string, string>();
  /** The username whose page was used to bootstrap the session. */
  private bootstrappedFor: string | null = null;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBackoffMs = options.retryBackoffMs ?? DEFAULT_BACKOFF_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  /**
   * Bootstrap a session for the given username if not already done.
   * Safe to call repeatedly — it only performs the GET once per username.
   *
   * @param userName - The public username whose page seeds the session.
   */
  async ensureSession(userName: string): Promise<void> {
    if (this.bootstrappedFor === userName && this.cookies.has('laravel_session')) {
      return;
    }

    const url = `${this.baseUrl}/user/${encodeURIComponent(userName)}`;
    const response = await this.withTimeout((signal) =>
      this.fetchImpl(url, { method: 'GET', signal }),
    );

    if (!response.ok) {
      throw new HttpError(response.status, `/user/${userName}`, 'Failed to bootstrap session');
    }

    this.captureCookies(response);
    this.bootstrappedFor = userName;
  }

  /**
   * Perform an authenticated POST against an endpoint, returning parsed JSON.
   *
   * @param endpoint - Path without leading slash, e.g. `get-user-profile`.
   * @param body - JSON-serializable request body.
   * @param userName - Username used for the `Referer` header and session bootstrap.
   */
  async post<T>(endpoint: string, body: unknown, userName: string): Promise<T> {
    await this.ensureSession(userName);

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.postOnce<T>(endpoint, body, userName);
      } catch (error) {
        lastError = error;
        // Do not retry deterministic client errors — only transient ones.
        if (!this.isRetryable(error) || attempt === this.maxRetries) {
          throw error;
        }
        await this.delay(this.retryBackoffMs * 2 ** attempt);
      }
    }

    // Unreachable, but satisfies the type checker.
    throw lastError instanceof Error ? lastError : new Error('Request failed');
  }

  private async postOnce<T>(endpoint: string, body: unknown, userName: string): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    const response = await this.withTimeout((signal) =>
      this.fetchImpl(url, {
        method: 'POST',
        signal,
        headers: this.buildHeaders(userName),
        body: JSON.stringify(body),
      }),
    );

    this.captureCookies(response);

    if (response.status === 419) {
      throw new CsrfError();
    }
    if (response.status === 500) {
      throw new ServerError(`/${endpoint}`);
    }
    if (!response.ok) {
      throw new HttpError(response.status, `/${endpoint}`);
    }

    return (await response.json()) as T;
  }

  private buildHeaders(userName: string): Record<string, string> {
    const token = this.getDecodedXsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `${this.baseUrl}/user/${encodeURIComponent(userName)}`,
      Origin: this.baseUrl,
      Accept: 'application/json, text/plain, */*',
    };
    if (token) {
      headers['X-XSRF-TOKEN'] = token;
    }
    const cookieHeader = this.serializeCookies();
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }
    return headers;
  }

  /**
   * The `XSRF-TOKEN` cookie arrives URL-encoded (its `=` padding as `%3D`).
   * It must be URL-decoded before being placed in the `X-XSRF-TOKEN` header,
   * otherwise the server answers `419 CSRF token mismatch`.
   */
  private getDecodedXsrfToken(): string | undefined {
    const raw = this.cookies.get('XSRF-TOKEN');
    return raw ? decodeURIComponent(raw) : undefined;
  }

  private serializeCookies(): string {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  private captureCookies(response: Response): void {
    // Node's fetch exposes multiple Set-Cookie headers via getSetCookie().
    const setCookies =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : response.headers.get('set-cookie')
          ? [response.headers.get('set-cookie') as string]
          : [];

    for (const cookie of setCookies) {
      const [pair] = cookie.split(';');
      const eq = pair.indexOf('=');
      if (eq === -1) {
        continue;
      }
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (name) {
        this.cookies.set(name, value);
      }
    }
  }

  private isRetryable(error: unknown): boolean {
    // 500 (broken endpoints) and 419 (CSRF) are deterministic — never retry.
    if (error instanceof ServerError || error instanceof CsrfError) {
      return false;
    }
    // Timeouts, network errors, and unexpected HTTP statuses are transient.
    return true;
  }

  private async withTimeout(fn: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
