import type { HttpClient } from './http.js';
import type { Comment } from './types.js';

/**
 * Fetch the first page of comments on a post via `POST /get-media-comments`.
 *
 * ⚠️ The `media_id` field takes the post **short code** (`Post.id`, e.g.
 * "DdG4RIxIPyf"), not the numeric IG media id, and is **snake_case**.
 *
 * @param http - The low-level HTTP client.
 * @param shortCode - The post short code (`Post.id`).
 * @param userName - Username used for the session/Referer.
 * @returns The comments (with recursive `child_comments`).
 */
export async function getMediaComments(
  http: HttpClient,
  shortCode: string,
  userName: string,
): Promise<Comment[]> {
  return http.post<Comment[]>('get-media-comments', { media_id: shortCode }, userName);
}
