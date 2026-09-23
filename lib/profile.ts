import { NotFoundError } from './errors.js';
import type { HttpClient } from './http.js';
import type { Profile } from './types.js';

/**
 * Fetch a public account's profile info, aggregate statistics, and the
 * latest ~12 posts via `POST /get-user-profile` (camelCase `userName`).
 *
 * @param http - The low-level HTTP client.
 * @param userName - The public Instagram username.
 * @throws {NotFoundError} When the account cannot be resolved (`found: false`).
 */
export async function getProfile(http: HttpClient, userName: string): Promise<Profile> {
  const profile = await http.post<Profile>('get-user-profile', { userName }, userName);
  if (!profile.found) {
    throw new NotFoundError(userName);
  }
  return profile;
}
