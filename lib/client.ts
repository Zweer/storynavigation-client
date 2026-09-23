/** Default base URL for the StoryNavigation deployment. */
export const DEFAULT_BASE_URL = 'https://storynavigation.com';

/** Options accepted by {@link StoryNavigationClient}. */
export interface StoryNavigationClientOptions {
  /**
   * Base URL override. Defaults to {@link DEFAULT_BASE_URL}.
   * The mirror deployment (`/mystorysaver-data`) also works.
   */
  baseUrl?: string;
}

/**
 * High-level facade for the StoryNavigation API.
 *
 * No credentials are required — the client bootstraps its own Laravel
 * session + CSRF token internally. Domain methods (profile, medias, media,
 * stories) are implemented incrementally by the `dev` agent from the docs.
 */
export class StoryNavigationClient {
  readonly baseUrl: string;

  constructor(options: StoryNavigationClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }
}
