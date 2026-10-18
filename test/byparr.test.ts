import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { ByparrSolver } from '../lib/byparr.js';
import { ChallengeError } from '../lib/errors.js';
import { server } from './setup.js';

const BYPARR_URL = 'http://localhost:8191';
const TARGET_URL = 'https://storynavigation.com/user/nasa';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0';

describe('ByparrSolver.solve', () => {
  it('maps cookies + userAgent and posts the FlareSolverr command', async () => {
    // Arrange
    let captured: Request | undefined;
    server.use(
      http.post(`${BYPARR_URL}/v1`, ({ request }) => {
        captured = request;
        return HttpResponse.json({
          status: 'ok',
          message: 'Success',
          solution: {
            url: TARGET_URL,
            status: 200,
            userAgent: USER_AGENT,
            cookies: [
              { name: 'cf_clearance', value: 'cf' },
              { name: 'laravel_session', value: 'sess' },
              { name: 'XSRF-TOKEN', value: 'tok%3D%3D' },
            ],
          },
        });
      }),
    );
    const solver = new ByparrSolver({ baseUrl: BYPARR_URL });

    // Act
    const solved = await solver.solve(TARGET_URL);

    // Assert
    expect(solved.userAgent).toBe(USER_AGENT);
    expect(solved.cookies).toEqual({
      cf_clearance: 'cf',
      laravel_session: 'sess',
      'XSRF-TOKEN': 'tok%3D%3D',
    });
    const body = (await captured?.json()) as Record<string, unknown>;
    expect(body).toEqual({ cmd: 'request.get', url: TARGET_URL, maxTimeout: 60_000 });
  });

  it('throws ChallengeError on a non-200 response', async () => {
    // Arrange
    server.use(http.post(`${BYPARR_URL}/v1`, () => new HttpResponse(null, { status: 500 })));
    const solver = new ByparrSolver({ baseUrl: BYPARR_URL });

    // Act & Assert
    await expect(solver.solve(TARGET_URL)).rejects.toBeInstanceOf(ChallengeError);
  });

  it('throws ChallengeError when status is "error"', async () => {
    // Arrange
    server.use(
      http.post(`${BYPARR_URL}/v1`, () =>
        HttpResponse.json({ status: 'error', message: 'Challenge not solved' }),
      ),
    );
    const solver = new ByparrSolver({ baseUrl: BYPARR_URL });

    // Act & Assert
    await expect(solver.solve(TARGET_URL)).rejects.toBeInstanceOf(ChallengeError);
  });

  it('throws ChallengeError on a malformed "ok" body (no solution)', async () => {
    // Arrange
    server.use(http.post(`${BYPARR_URL}/v1`, () => HttpResponse.json({ status: 'ok' })));
    const solver = new ByparrSolver({ baseUrl: BYPARR_URL });

    // Act & Assert
    await expect(solver.solve(TARGET_URL)).rejects.toBeInstanceOf(ChallengeError);
  });

  it('throws ChallengeError on a non-JSON body', async () => {
    // Arrange
    server.use(http.post(`${BYPARR_URL}/v1`, () => HttpResponse.html('nope')));
    const solver = new ByparrSolver({ baseUrl: BYPARR_URL });

    // Act & Assert
    await expect(solver.solve(TARGET_URL)).rejects.toBeInstanceOf(ChallengeError);
  });
});
