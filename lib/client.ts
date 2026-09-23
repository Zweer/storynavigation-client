import { getMediaComments } from './comments.js';
import { HttpClient } from './http.js';
import { type DownloadOptions, downloadImage, downloadVideo } from './media.js';
import { getUserMedias } from './medias.js';
import { getProfile } from './profile.js';
import { getHighlightStories, getUserHighlights, getUserLastStories } from './stories.js';
import type { Comment, Highlight, Post, Profile, Story, StoryItem } from './types.js';

/** Default base URL for the StoryNavigation deployment. */
export const DEFAULT_BASE_URL = 'https://storynavigation.com';

/** Options accepted by {@link StoryNavigationClient}. */
export interface StoryNavigationClientOptions {
  /**
   * Base URL override. Defaults to {@link DEFAULT_BASE_URL}.
   * The mirror deployment (`/mystorysaver-data`) also works.
   */
  baseUrl?: string;
  /** Number of retry attempts for transient failures. Defaults to 2. */
  maxRetries?: number;
  /** Injectable fetch, mainly for testing. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /**
   * Maximum bytes for a single media download before it is aborted with a
   * `MediaTooLargeError`. Defaults to 100 MiB.
   */
  maxDownloadBytes?: number;
}

/**
 * High-level facade for the StoryNavigation API.
 *
 * No credentials are required — the client bootstraps its own Laravel
 * session + CSRF token internally on the first call.
 *
 * @example
 * ```ts
 * const client = new StoryNavigationClient();
 * const profile = await client.getProfile('nasa');
 * const posts = await client.getUserMedias('nasa');
 * const bytes = await client.downloadImage(posts[0].thumbnailUrl);
 * ```
 */
export class StoryNavigationClient {
  readonly baseUrl: string;
  private readonly http: HttpClient;
  private readonly fetchImpl?: typeof fetch;
  private readonly maxDownloadBytes?: number;

  constructor(options: StoryNavigationClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetch;
    this.maxDownloadBytes = options.maxDownloadBytes;
    this.http = new HttpClient({
      baseUrl: this.baseUrl,
      maxRetries: options.maxRetries,
      fetch: options.fetch,
    });
  }

  /**
   * Fetch a public account's profile, statistics, and latest ~12 posts.
   *
   * @param userName - The public Instagram username.
   * @throws {NotFoundError} When the account cannot be resolved.
   */
  async getProfile(userName: string): Promise<Profile> {
    return getProfile(this.http, userName);
  }

  /**
   * Fetch the latest ~12 posts for a public account.
   *
   * @param userName - The public Instagram username.
   */
  async getUserMedias(userName: string): Promise<Post[]> {
    return getUserMedias(this.http, userName);
  }

  /**
   * Fetch the saved highlights for a public account.
   *
   * @param userName - The public Instagram username.
   * @param userId - The numeric IG user id (from `profile.accountInfo.id`).
   */
  async getUserHighlights(userName: string, userId: number): Promise<Highlight[]> {
    return getUserHighlights(this.http, userName, userId);
  }

  /**
   * Fetch the items inside a highlight.
   *
   * @param highlightId - The `Highlight.id`.
   * @param userName - Username used for the session/Referer.
   */
  async getHighlightStories(highlightId: string, userName: string): Promise<StoryItem[]> {
    return getHighlightStories(this.http, highlightId, userName);
  }

  /**
   * Fetch the currently-active stories for a public account.
   *
   * @param userName - The public Instagram username.
   * @param instagramUserId - The numeric IG user id (from `profile.accountInfo.id`).
   * @param isPrivate - Whether the account is private (from the profile).
   */
  async getUserLastStories(
    userName: string,
    instagramUserId: number,
    isPrivate: boolean,
  ): Promise<Story[]> {
    return getUserLastStories(this.http, userName, instagramUserId, isPrivate);
  }

  /**
   * Fetch the first page of comments on a post.
   *
   * @param shortCode - The post short code (`Post.id`).
   * @param userName - Username used for the session/Referer.
   */
  async getMediaComments(shortCode: string, userName: string): Promise<Comment[]> {
    return getMediaComments(this.http, shortCode, userName);
  }

  /**
   * Download the bytes of an image (or sidecar slide / profile pic / highlight
   * thumbnail) through the CDN proxy.
   *
   * ⚠️ Signed IG URLs expire — call this immediately after receiving the API
   * response.
   *
   * @param base64Url - The base64-encoded IG image URL from the API.
   * @throws {ExpiredUrlError} When the proxy answers `403`.
   */
  async downloadImage(base64Url: string): Promise<Uint8Array> {
    return downloadImage(base64Url, this.downloadOptions());
  }

  /**
   * Download the bytes of a video through the `stories-cdn.fun` host.
   *
   * ⚠️ Signed IG URLs expire — call this immediately after receiving the API
   * response.
   *
   * @param base64Url - The base64-encoded IG video URL from the API.
   * @throws {ExpiredUrlError} When the host answers `403`.
   */
  async downloadVideo(base64Url: string): Promise<Uint8Array> {
    return downloadVideo(base64Url, this.downloadOptions());
  }

  private downloadOptions(): DownloadOptions {
    const options: DownloadOptions = {};
    if (this.fetchImpl) {
      options.fetch = this.fetchImpl;
    }
    if (this.maxDownloadBytes !== undefined) {
      options.maxBytes = this.maxDownloadBytes;
    }
    return options;
  }
}
