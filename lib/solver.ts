/**
 * A resolved session produced by a {@link ChallengeSolver} after passing a
 * Cloudflare challenge: the cookies to replay (including `cf_clearance`) and
 * the User-Agent that must accompany them.
 */
export interface SolvedSession {
  /** Cookie name → value map to inject into the client's cookie jar. */
  cookies: Record<string, string>;
  /** User-Agent string paired with the solved cookies. */
  userAgent: string;
}

/**
 * Abstraction for an external service that solves a Cloudflare challenge for a
 * given URL and returns a replayable {@link SolvedSession}. Implementations
 * must throw a `ChallengeError` on failure rather than raw errors.
 */
export interface ChallengeSolver {
  /**
   * Solve the challenge guarding `url` and return the resulting session.
   *
   * @param url - The URL to request through the solver.
   */
  solve(url: string): Promise<SolvedSession>;
}
