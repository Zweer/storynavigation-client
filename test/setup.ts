import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

/** Shared MSW server. Handlers are registered per-test via `server.use(...)`. */
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

export const BASE_URL = 'https://storynavigation.com';

/**
 * A `Set-Cookie` pair mirroring the real bootstrap response. The `XSRF-TOKEN`
 * value is URL-encoded (trailing `%3D`) so tests exercise the URL-decode path.
 */
export const SESSION_SET_COOKIES = [
  'laravel_session=session-abc; path=/; httponly',
  'XSRF-TOKEN=token-xyz%3D%3D; path=/',
];

/** Register a handler that answers the session bootstrap GET with cookies. */
export function mockSession(): void {
  server.use(
    http.get(`${BASE_URL}/user/:username`, () => {
      const headers = new Headers();
      for (const cookie of SESSION_SET_COOKIES) {
        headers.append('Set-Cookie', cookie);
      }
      return new HttpResponse('<html></html>', { headers });
    }),
  );
}
