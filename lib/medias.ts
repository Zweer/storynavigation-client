import { ServerError } from './errors.js';
import type { HttpClient } from './http.js';
import type { Post } from './types.js';

/**
 * Fetch the latest ~12 posts for a public account via
 * `POST /get-user-medias`.
 *
 * ⚠️ This endpoint uses the **snake_case** `user_name` parameter, unlike
 * `get-user-profile` which uses camelCase `userName`. This is intentional
 * and must not be "normalized".
 *
 * @param http - The low-level HTTP client.
 * @param userName - The public Instagram username.
 */
export async function getUserMedias(http: HttpClient, userName: string): Promise<Post[]> {
  return http.post<Post[]>('get-user-medias', { user_name: userName }, userName);
}

/**
 * `POST /paginate-medias` — **broken server-side** (always returns `500`).
 * Kept for completeness; always throws {@link ServerError}. There is no
 * working way to fetch full post history through StoryNavigation.
 *
 * @throws {ServerError} Always — the endpoint is disabled server-side.
 */
export async function paginateMedias(
  http: HttpClient,
  userName: string,
  page: number,
): Promise<never> {
  await http.post<never>('paginate-medias', { userName, page }, userName);
  // Defensive: the endpoint returns 500 (mapped to ServerError) before this.
  throw new ServerError('/paginate-medias');
}

/**
 * `POST /get-post-by-short-code` — **broken server-side** (always returns `500`).
 * Kept for completeness; always throws {@link ServerError}.
 *
 * @throws {ServerError} Always — the endpoint is disabled server-side.
 */
export async function getPostByShortCode(
  http: HttpClient,
  shortCode: string,
  userName: string,
): Promise<never> {
  await http.post<never>('get-post-by-short-code', { short_code: shortCode }, userName);
  throw new ServerError('/get-post-by-short-code');
}
