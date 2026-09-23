import { describe, expect, it } from 'vitest';

import {
  CsrfError,
  DEFAULT_BASE_URL,
  ExpiredUrlError,
  ServerError,
  StoryNavigationClient,
  StoryNavigationError,
} from '../lib/index.js';

describe('StoryNavigationClient', () => {
  it('defaults to the canonical base URL', () => {
    // Arrange & Act
    const client = new StoryNavigationClient();

    // Assert
    expect(client.baseUrl).toBe(DEFAULT_BASE_URL);
  });

  it('honors a base URL override', () => {
    // Arrange
    const baseUrl = 'https://storynavigation.com/mystorysaver-data';

    // Act
    const client = new StoryNavigationClient({ baseUrl });

    // Assert
    expect(client.baseUrl).toBe(baseUrl);
  });
});

describe('errors', () => {
  it('exposes a typed hierarchy rooted at StoryNavigationError', () => {
    // Arrange & Act
    const csrf = new CsrfError();
    const server = new ServerError('/paginate-medias');
    const expired = new ExpiredUrlError();

    // Assert
    expect(csrf).toBeInstanceOf(StoryNavigationError);
    expect(server).toBeInstanceOf(StoryNavigationError);
    expect(expired).toBeInstanceOf(StoryNavigationError);
    expect(server.endpoint).toBe('/paginate-medias');
  });
});
