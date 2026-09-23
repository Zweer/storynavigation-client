import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { NotFoundError, ServerError } from '../lib/errors.js';
import { HttpClient } from '../lib/http.js';
import { StoryNavigationClient } from '../lib/index.js';
import { paginateMedias } from '../lib/medias.js';
import { BASE_URL, mockSession, server } from './setup.js';

function makeClient(): StoryNavigationClient {
  mockSession();
  return new StoryNavigationClient();
}

describe('StoryNavigationClient.getProfile', () => {
  it('returns the profile on success', async () => {
    // Arrange
    const client = makeClient();
    server.use(
      http.post(`${BASE_URL}/get-user-profile`, () =>
        HttpResponse.json({
          found: true,
          isPrivate: false,
          needToLoadPosts: false,
          accountInfo: { id: 528817151, username: 'nasa' },
          posts: [],
          postsStatistics: {},
        }),
      ),
    );

    // Act
    const profile = await client.getProfile('nasa');

    // Assert
    expect(profile.accountInfo.id).toBe(528817151);
  });

  it('throws NotFoundError when the account is not found', async () => {
    // Arrange
    const client = makeClient();
    server.use(
      http.post(`${BASE_URL}/get-user-profile`, () => HttpResponse.json({ found: false })),
    );

    // Act & Assert
    await expect(client.getProfile('ghost')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('StoryNavigationClient.getUserMedias', () => {
  it('sends snake_case user_name and returns the bare array', async () => {
    // Arrange
    const client = makeClient();
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/get-user-medias`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json([{ id: 'DdG4RIxIPyf', type: 'image' }]);
      }),
    );

    // Act
    const posts = await client.getUserMedias('nasa');

    // Assert
    expect(body).toEqual({ user_name: 'nasa' });
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('DdG4RIxIPyf');
  });
});

describe('StoryNavigationClient stories & highlights', () => {
  it('getUserHighlights returns the array', async () => {
    // Arrange
    const client = makeClient();
    server.use(
      http.post(`${BASE_URL}/get-user-highlights`, () =>
        HttpResponse.json([{ id: '18195781759377100', title: 'Roman', imageThumbnail: 'YWJj' }]),
      ),
    );

    // Act
    const highlights = await client.getUserHighlights('nasa', 528817151);

    // Assert
    expect(highlights[0].title).toBe('Roman');
  });

  it('getUserLastStories unwraps the lastStories array', async () => {
    // Arrange
    const client = makeClient();
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/get-user-last-stories`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          lastStories: [{ id: '1_2', type: 'image', url: 'YWJj', thumbnailUrl: 'YWJj' }],
        });
      }),
    );

    // Act
    const stories = await client.getUserLastStories('nasa', 528817151, false);

    // Assert — note instagramUserId, not userId
    expect(body).toEqual({ userName: 'nasa', isPrivate: false, instagramUserId: 528817151 });
    expect(stories).toHaveLength(1);
    expect(stories[0].id).toBe('1_2');
  });
});

describe('StoryNavigationClient.getMediaComments', () => {
  it('sends snake_case media_id (short code) and returns comments', async () => {
    // Arrange
    const client = makeClient();
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/get-media-comments`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json([
          {
            created_at: 'x',
            text: 'hi',
            user_name: 'u',
            profile_pic_url: 'YWJj',
            child_comments: [],
          },
        ]);
      }),
    );

    // Act
    const comments = await client.getMediaComments('DdG4RIxIPyf', 'nasa');

    // Assert
    expect(body).toEqual({ media_id: 'DdG4RIxIPyf' });
    expect(comments[0].child_comments).toEqual([]);
  });
});

describe('broken endpoints', () => {
  it('paginateMedias rejects with ServerError (500)', async () => {
    // Arrange
    mockSession();
    server.use(
      http.post(`${BASE_URL}/paginate-medias`, () =>
        HttpResponse.json({ message: 'Server Error' }, { status: 500 }),
      ),
    );
    const httpClient = new HttpClient({ baseUrl: BASE_URL });

    // Act & Assert
    await expect(paginateMedias(httpClient, 'nasa', 2)).rejects.toBeInstanceOf(ServerError);
  });
});
