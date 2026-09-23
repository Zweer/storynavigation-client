import type { HttpClient } from './http.js';
import type { Highlight, LastStoriesResponse, Story, StoryItem } from './types.js';

/**
 * Fetch the saved highlights for a public account via
 * `POST /get-user-highlights` (camelCase `userName` + numeric `userId`).
 *
 * @param http - The low-level HTTP client.
 * @param userName - The public Instagram username.
 * @param userId - The numeric IG user id (from `profile.accountInfo.id`).
 * @returns The highlights, or `[]` when the account has none.
 */
export async function getUserHighlights(
  http: HttpClient,
  userName: string,
  userId: number,
): Promise<Highlight[]> {
  return http.post<Highlight[]>('get-user-highlights', { userName, userId }, userName);
}

/**
 * Fetch the items inside a highlight via `POST /get-highlight-stories`.
 *
 * @param http - The low-level HTTP client.
 * @param highlightId - The `Highlight.id` from {@link getUserHighlights}.
 * @param userName - Username used for the session/Referer.
 */
export async function getHighlightStories(
  http: HttpClient,
  highlightId: string,
  userName: string,
): Promise<StoryItem[]> {
  return http.post<StoryItem[]>('get-highlight-stories', { highlightId }, userName);
}

/**
 * Fetch the currently-active stories for an account via
 * `POST /get-user-last-stories`.
 *
 * ⚠️ Note the parameter is **`instagramUserId`** (not `userId`), plus
 * `isPrivate`. The response wraps the array in `{ lastStories: [...] }`;
 * this helper unwraps it.
 *
 * @param http - The low-level HTTP client.
 * @param userName - The public Instagram username.
 * @param instagramUserId - The numeric IG user id (from `profile.accountInfo.id`).
 * @param isPrivate - Whether the account is private (from the profile).
 * @returns The active stories, or `[]` when there are none.
 */
export async function getUserLastStories(
  http: HttpClient,
  userName: string,
  instagramUserId: number,
  isPrivate: boolean,
): Promise<Story[]> {
  const response = await http.post<LastStoriesResponse>(
    'get-user-last-stories',
    { userName, isPrivate, instagramUserId },
    userName,
  );
  return response.lastStories;
}
