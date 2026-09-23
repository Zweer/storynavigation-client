/**
 * End-to-end smoke test against the **live** StoryNavigation endpoints.
 *
 * Unlike the unit tests (which mock HTTP with MSW), this script exercises the
 * real API and CDN proxies. It is intentionally kept out of the default test
 * run — invoke it explicitly with `npm run test:e2e`.
 *
 * Configuration (all optional — no secrets required):
 *   STORYNAVIGATION_USERNAME  public IG username to probe (default: natgeo)
 *   STORYNAVIGATION_BASE_URL  base URL override (default: production)
 *
 * The script is resilient: ephemeral data (active stories, highlights) may be
 * empty for a given account, so those checks are reported as SKIP, not FAIL.
 * The process exits non-zero if any hard assertion fails.
 */

import { StoryNavigationClient } from '../lib/index.js';

const userName = process.env.STORYNAVIGATION_USERNAME ?? 'natgeo';
const baseUrl = process.env.STORYNAVIGATION_BASE_URL;

const client = new StoryNavigationClient(baseUrl ? { baseUrl } : {});

let failures = 0;

/** Log a PASS line. */
function pass(label: string, detail = ''): void {
  console.log(`  \u2705 ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Log a SKIP line (not a failure — e.g. no active stories at this time). */
function skip(label: string, reason: string): void {
  console.log(`  \u26A0\uFE0F  ${label} — SKIP: ${reason}`);
}

/** Log a FAIL line and mark the run as failed. */
function fail(label: string, error: unknown): void {
  failures += 1;
  const message = error instanceof Error ? error.message : String(error);
  console.log(`  \u274C ${label} — FAIL: ${message}`);
}

/** Assert a condition, throwing with a message on failure. */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  console.log(`\nE2E against ${baseUrl ?? 'https://storynavigation.com'} for @${userName}\n`);

  // 1. Profile — the primary landing call; also gives us the numeric IG id.
  let userId = 0;
  let isPrivate = false;
  try {
    const profile = await client.getProfile(userName);
    assert(profile.found, 'profile.found should be true');
    assert(typeof profile.accountInfo.id === 'number', 'accountInfo.id should be numeric');
    userId = profile.accountInfo.id;
    isPrivate = profile.isPrivate;
    pass(
      'getProfile',
      `id=${userId} posts=${profile.posts.length} mediaCount=${profile.accountInfo.mediaCount}`,
    );
  } catch (error) {
    fail('getProfile', error);
    // Without a profile we cannot run the id-dependent checks — bail early.
    console.log(`\n${failures} failure(s).\n`);
    process.exit(1);
  }

  // 2. Medias — the ~12 recent posts (bare array).
  let firstShortCode: string | undefined;
  let firstImageUrl: string | undefined;
  let firstVideoUrl: string | undefined;
  try {
    const posts = await client.getUserMedias(userName);
    assert(Array.isArray(posts), 'medias should be an array');
    firstShortCode = posts[0]?.id;
    firstImageUrl = posts.find((p) => p.type !== 'video')?.thumbnailUrl ?? posts[0]?.thumbnailUrl;
    firstVideoUrl = posts.find((p) => p.type === 'video')?.videoUrl;
    pass('getUserMedias', `count=${posts.length}`);
  } catch (error) {
    fail('getUserMedias', error);
  }

  // 3. Highlights (may be empty).
  let firstHighlightId: string | undefined;
  try {
    const highlights = await client.getUserHighlights(userName, userId);
    firstHighlightId = highlights[0]?.id;
    if (highlights.length === 0) {
      skip('getUserHighlights', 'account has no highlights');
    } else {
      pass('getUserHighlights', `count=${highlights.length}`);
    }
  } catch (error) {
    fail('getUserHighlights', error);
  }

  // 4. Highlight stories (only if there is a highlight).
  if (firstHighlightId) {
    try {
      const items = await client.getHighlightStories(firstHighlightId, userName);
      pass('getHighlightStories', `count=${items.length}`);
    } catch (error) {
      fail('getHighlightStories', error);
    }
  } else {
    skip('getHighlightStories', 'no highlight id available');
  }

  // 5. Active stories (ephemeral — often empty).
  try {
    const stories = await client.getUserLastStories(userName, userId, isPrivate);
    if (stories.length === 0) {
      skip('getUserLastStories', 'no active stories right now');
    } else {
      pass('getUserLastStories', `count=${stories.length}`);
    }
  } catch (error) {
    fail('getUserLastStories', error);
  }

  // 6. Comments on the first post.
  if (firstShortCode) {
    try {
      const comments = await client.getMediaComments(firstShortCode, userName);
      pass('getMediaComments', `count=${comments.length} (post ${firstShortCode})`);
    } catch (error) {
      fail('getMediaComments', error);
    }
  } else {
    skip('getMediaComments', 'no post short code available');
  }

  // 7. Image download (fetch-then-download-now — the URL is fresh here).
  if (firstImageUrl) {
    try {
      const bytes = await client.downloadImage(firstImageUrl);
      assert(bytes.byteLength > 0, 'image download should return bytes');
      pass('downloadImage', `${bytes.byteLength} bytes`);
    } catch (error) {
      fail('downloadImage', error);
    }
  } else {
    skip('downloadImage', 'no image url available');
  }

  // 8. Video download (only if a video post exists).
  if (firstVideoUrl) {
    try {
      const bytes = await client.downloadVideo(firstVideoUrl);
      assert(bytes.byteLength > 0, 'video download should return bytes');
      pass('downloadVideo', `${bytes.byteLength} bytes`);
    } catch (error) {
      fail('downloadVideo', error);
    }
  } else {
    skip('downloadVideo', 'no video post in the latest medias');
  }

  console.log(`\n${failures === 0 ? 'All hard assertions passed.' : `${failures} failure(s).`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('E2E run crashed:', error);
  process.exit(1);
});
