/**
 * Detect a Cloudflare anti-bot challenge from a `403` response.
 *
 * A `403` is a challenge when the `cf-mitigated` header is present, or when the
 * `server` is Cloudflare and the (HTML/non-JSON) body contains a "Just a
 * moment" interstitial. A genuine signature expiry (`text/plain` `Bad URL
 * timestamp` / `Bad URL hash`) is NOT a challenge.
 *
 * Shared by {@link HttpClient} (main host) and the media CDN download path so
 * the predicate lives in exactly one place.
 *
 * @param response - The `fetch` response to inspect.
 * @param bodyText - The already-read response body, if available.
 * @returns `true` when the response is a Cloudflare challenge.
 */
export function isCloudflareChallenge(response: Response, bodyText?: string): boolean {
  if (response.status !== 403) {
    return false;
  }
  if (response.headers.has('cf-mitigated')) {
    return true;
  }
  const server = response.headers.get('server') ?? '';
  if (server.toLowerCase().includes('cloudflare') && bodyText?.includes('Just a moment')) {
    return true;
  }
  return false;
}
