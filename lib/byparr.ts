import { ChallengeError } from './errors.js';
import type { ChallengeSolver, SolvedSession } from './solver.js';

/** Options for the {@link ByparrSolver}. */
export interface ByparrSolverOptions {
  /** Byparr/FlareSolverr base URL. Defaults to `http://localhost:8191`. */
  baseUrl?: string;
  /** Max time Byparr may spend solving, sent as `maxTimeout` (ms). Defaults to 60000. */
  maxTimeoutMs?: number;
  /** Injectable fetch, mainly for testing. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /**
   * Client-side request timeout (ms). Defaults to `maxTimeoutMs + 5000` so the
   * client never aborts before Byparr's own timeout fires.
   */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = 'http://localhost:8191';
const DEFAULT_MAX_TIMEOUT_MS = 60_000;
const CLIENT_TIMEOUT_MARGIN_MS = 5_000;

/** Shape of the FlareSolverr-compatible response Byparr returns from `/v1`. */
type ByparrResponse = {
  status?: string;
  message?: string;
  solution?: {
    url?: string;
    status?: number;
    userAgent?: string;
    cookies?: Array<{ name: string; value: string }>;
  };
};

/**
 * A {@link ChallengeSolver} backed by a local Byparr (FlareSolverr-compatible)
 * instance. Delegates the Cloudflare challenge to the service via
 * `POST /v1 { cmd: 'request.get', url, maxTimeout }` and maps the returned
 * cookies + User-Agent into a {@link SolvedSession}. Any failure (unreachable
 * service, non-200, `status !== 'ok'`, or malformed body) throws a typed
 * {@link ChallengeError}.
 */
export class ByparrSolver implements ChallengeSolver {
  private readonly baseUrl: string;
  private readonly maxTimeoutMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ByparrSolverOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.maxTimeoutMs = options.maxTimeoutMs ?? DEFAULT_MAX_TIMEOUT_MS;
    this.timeoutMs = options.timeoutMs ?? this.maxTimeoutMs + CLIENT_TIMEOUT_MARGIN_MS;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  /**
   * Solve the Cloudflare challenge guarding `url` through Byparr.
   *
   * @param url - The URL to request through the solver.
   * @throws {ChallengeError} When Byparr is unreachable, returns a non-200,
   *   reports `status !== 'ok'`, or sends a malformed body.
   */
  async solve(url: string): Promise<SolvedSession> {
    let response: Response;
    try {
      response = await this.withTimeout((signal) =>
        this.fetchImpl(`${this.baseUrl}/v1`, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cmd: 'request.get', url, maxTimeout: this.maxTimeoutMs }),
        }),
      );
    } catch {
      throw new ChallengeError('Byparr solver is unreachable', url);
    }

    if (!response.ok) {
      throw new ChallengeError(`Byparr solver returned HTTP ${response.status}`, url);
    }

    let parsed: ByparrResponse;
    try {
      parsed = (await response.json()) as ByparrResponse;
    } catch {
      throw new ChallengeError('Byparr solver returned a non-JSON body', url);
    }

    const solution = parsed.solution;
    if (
      parsed.status !== 'ok' ||
      typeof solution !== 'object' ||
      solution === null ||
      typeof solution.userAgent !== 'string' ||
      !Array.isArray(solution.cookies)
    ) {
      const detail = parsed.message ? `: ${parsed.message}` : '';
      throw new ChallengeError(`Byparr solver failed to solve the challenge${detail}`, url);
    }

    const cookies: Record<string, string> = {};
    for (const cookie of solution.cookies) {
      cookies[cookie.name] = cookie.value;
    }

    return { cookies, userAgent: solution.userAgent };
  }

  private async withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }
}
