import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CsrfError, HttpError, ServerError } from '../lib/errors.js';
import { HttpClient } from '../lib/http.js';
import { BASE_URL, mockSession, SESSION_SET_COOKIES, server } from './setup.js';

describe('HttpClient session + CSRF', () => {
  it('bootstraps the session and sends decoded CSRF token + cookies on POST', async () => {
    // Arrange
    mockSession();
    let captured: Request | undefined;
    server.use(
      http.post(`${BASE_URL}/get-user-profile`, ({ request }) => {
        captured = request;
        return HttpResponse.json({ ok: true });
      }),
    );
    const client = new HttpClient({ baseUrl: BASE_URL });

    // Act
    await client.post('get-user-profile', { userName: 'nasa' }, 'nasa');

    // Assert — token URL-decoded (token-xyz== not token-xyz%3D%3D)
    expect(captured?.headers.get('x-xsrf-token')).toBe('token-xyz==');
    expect(captured?.headers.get('x-requested-with')).toBe('XMLHttpRequest');
    expect(captured?.headers.get('referer')).toBe(`${BASE_URL}/user/nasa`);
    expect(captured?.headers.get('cookie')).toContain('laravel_session=session-abc');
    expect(captured?.headers.get('cookie')).toContain('XSRF-TOKEN=token-xyz%3D%3D');
  });

  it('bootstraps the session only once per username', async () => {
    // Arrange
    const bootstrap = vi.fn(() => {
      const headers = new Headers();
      for (const cookie of SESSION_SET_COOKIES) {
        headers.append('Set-Cookie', cookie);
      }
      return new HttpResponse('<html></html>', { headers });
    });
    server.use(
      http.get(`${BASE_URL}/user/:username`, bootstrap),
      http.post(`${BASE_URL}/get-user-medias`, () => HttpResponse.json([])),
    );
    const client = new HttpClient({ baseUrl: BASE_URL });

    // Act
    await client.post('get-user-medias', {}, 'nasa');
    await client.post('get-user-medias', {}, 'nasa');

    // Assert
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });
});

describe('HttpClient error mapping', () => {
  it('maps 419 to CsrfError without retrying', async () => {
    // Arrange
    mockSession();
    const handler = vi.fn(() =>
      HttpResponse.json({ message: 'CSRF token mismatch.' }, { status: 419 }),
    );
    server.use(http.post(`${BASE_URL}/get-user-profile`, handler));
    const client = new HttpClient({ baseUrl: BASE_URL, maxRetries: 2 });

    // Act & Assert
    await expect(client.post('get-user-profile', {}, 'nasa')).rejects.toBeInstanceOf(CsrfError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('maps 500 to ServerError without retrying', async () => {
    // Arrange
    mockSession();
    const handler = vi.fn(() => HttpResponse.json({ message: 'Server Error' }, { status: 500 }));
    server.use(http.post(`${BASE_URL}/paginate-medias`, handler));
    const client = new HttpClient({ baseUrl: BASE_URL, maxRetries: 2 });

    // Act & Assert
    await expect(client.post('paginate-medias', {}, 'nasa')).rejects.toBeInstanceOf(ServerError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('retries transient errors then surfaces HttpError', async () => {
    // Arrange
    mockSession();
    const handler = vi.fn(() => new HttpResponse(null, { status: 503 }));
    server.use(http.post(`${BASE_URL}/get-user-profile`, handler));
    const client = new HttpClient({ baseUrl: BASE_URL, maxRetries: 2, retryBackoffMs: 1 });

    // Act & Assert
    await expect(client.post('get-user-profile', {}, 'nasa')).rejects.toBeInstanceOf(HttpError);
    expect(handler).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('recovers when a transient error is followed by success', async () => {
    // Arrange
    mockSession();
    let calls = 0;
    server.use(
      http.post(`${BASE_URL}/get-user-profile`, () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ found: true });
      }),
    );
    const client = new HttpClient({ baseUrl: BASE_URL, maxRetries: 2, retryBackoffMs: 1 });

    // Act
    const result = await client.post<{ found: boolean }>('get-user-profile', {}, 'nasa');

    // Assert
    expect(result.found).toBe(true);
    expect(calls).toBe(2);
  });
});
