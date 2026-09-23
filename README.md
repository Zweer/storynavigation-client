# @zweer/storynavigation-client

TypeScript client for [StoryNavigation](https://storynavigation.com)'s internal API — an Instagram mirror. Fetch public profile info, recent posts (images, videos, carousels), and download the underlying media.

> ⚠️ **Unofficial** — This library reverse-engineers StoryNavigation's private, undocumented endpoints. It may break at any time if the site changes its API, encoding, or anti-bot protections. StoryNavigation itself mirrors Instagram content; all media belongs to the original authors. Use for personal/informational purposes only.

## Status

Reverse engineering complete and verified against live endpoints (2026-09-23). Library implementation not yet started — this README is the spec to build from.

## Table of contents

- [How the site works](#how-the-site-works)
- [Session & auth flow (Laravel CSRF)](#session--auth-flow-laravel-csrf)
- [Endpoints](#endpoints)
- [Media model](#media-model)
- [Media URLs & the CDN proxy](#media-urls--the-cdn-proxy)
- [Known limitations](#known-limitations-important)
- [Planned API surface](#planned-api-surface)
- [Planned architecture](#planned-architecture)
- [Development](#development)

## How the site works

StoryNavigation is a **Laravel + Vue** app. When you load `https://storynavigation.com/user/<username>`:

1. The server sets two cookies: `laravel_session` and `XSRF-TOKEN`.
2. It embeds the initial media list directly in the HTML as HTML-escaped (`&quot;`) Vue props.
3. The Vue frontend (`/js/app.js`) then talks to a set of **POST** endpoints (via `axios`) to load the profile, more media, stories, highlights, etc.
4. Media (images/videos) are served through a **CDN proxy** at `cdn.storynavigation.com` that unwraps a base64-encoded Instagram URL, working around Instagram's hotlink/CORS protection.

The visual player (`/js/socialstory.js`) is just a slideshow UI — it receives a `playlist` array and renders it. All the real data comes from the POST endpoints below.

## Session & auth flow (Laravel CSRF)

Every POST endpoint requires a valid session + CSRF token. Calling them cold returns:

- `419 {"message":"CSRF token mismatch."}` — missing/invalid CSRF token
- `500 {"message":"Server Error"}` — for the broken endpoints (see limitations)

**Working flow (verified):**

```
1. GET https://storynavigation.com/user/<username>
   → capture cookies: laravel_session, XSRF-TOKEN

2. URL-decode the XSRF-TOKEN cookie value → use as the X-XSRF-TOKEN header

3. POST the endpoint with these headers:
     Content-Type:     application/json
     X-Requested-With: XMLHttpRequest
     X-XSRF-TOKEN:     <url-decoded XSRF-TOKEN cookie>
     Referer:          https://storynavigation.com/user/<username>
     Origin:           https://storynavigation.com
     Accept:           application/json, text/plain, */*
   ...and send the laravel_session + XSRF-TOKEN cookies back.
```

The token is a standard Laravel `XSRF-TOKEN` cookie: it arrives URL-encoded and must be URL-decoded before being placed in the `X-XSRF-TOKEN` header.

## Endpoints

All are **POST**, JSON body, on `https://storynavigation.com`.

| Endpoint | Body | Status | Returns |
|----------|------|--------|---------|
| `/get-user-profile` | `{"userName": "<u>"}` | ✅ 200 | `{ found, isPrivate, needToLoadPosts, accountInfo, posts[], postsStatistics }` |
| `/get-user-medias` | `{"user_name": "<u>"}` | ✅ 200 | `Post[]` (same posts as in profile) |
| `/paginate-medias` | `{"userName": "<u>", "page": <n>}` | ❌ 500 | **broken server-side** (see limitations) |
| `/get-post-by-short-code` | `{"short_code": "<id>"}` | ❌ 500 | **broken server-side** (see limitations) |
| `/get-user-highlights` | `{"userName": "<u>", "userId": <id>}` | untested | highlights list |
| `/get-user-last-stories` | `{"userName": "<u>", "isPrivate": <bool>, "instagramUserId": <id>}` | untested | active stories |
| `/get-highlight-stories` | `{"highlightId": "<id>"}` | untested | highlight items |
| `/get-media-comments` | `{"media_id": "<id>"}` | untested | comments |

> Note the inconsistent parameter casing between endpoints: `/get-user-medias` uses `user_name` (snake_case) while `/get-user-profile` and `/paginate-medias` use `userName` (camelCase). This is confirmed correct from `app.js`, not a typo.

There is also a mirror namespace `/mystorysaver-data/<endpoint>` with identical shapes (a white-labeled deployment of the same backend).

### `get-user-profile` response

```jsonc
{
  "found": true,
  "isPrivate": false,
  "needToLoadPosts": false,
  "accountInfo": {
    "id": 49002316803,
    "username": "heyjoanar",
    "fullName": "",
    "biography": "21y 🇵🇹",
    "followsCount": 6552,
    "followedByCount": 588702,
    "mediaCount": 493,          // total posts on Instagram
    "isPrivate": false,
    "profilePicUrl": "<base64-encoded IG url>"
  },
  "posts": [ /* Post[] — but only ~12, see limitations */ ],
  "postsStatistics": {
    "averageCountOfLikes": 33778,
    "averageCountOfComments": 608,
    "averageTimeBetweenPosts": "7 day(s) 09 hour(s)",
    "commentsCount": 7301,
    "likesCount": 405339,
    "percentOfFollowersWhoComments": 1.24
  }
}
```

## Media model

Every post shares the same shape; `type` drives which fields matter.

```typescript
interface Post {
  id: string;              // Instagram short code, e.g. "DaD1mynjH8E"
  type: 'image' | 'video' | 'sidecar';
  isVideo: boolean;
  caption: string;         // may contain unicode/emoji; can be empty
  likesCount: number;
  commentsCount: number;
  createdTime: string;     // e.g. "26 June 2026 18:57:05" (human string, not ISO)
  thumbnailUrl: string;    // base64-encoded IG image URL (cover for videos)
  sidecarItems: SidecarItem[];  // [] unless type === 'sidecar'
  videoUrl?: string;       // base64-encoded IG video URL — only when type === 'video'
}

interface SidecarItem {
  display_url: string;     // base64-encoded IG image URL for that slide
}
```

**Verified per type (across heyjoanar, natgeo, nasa, instagram):**

- `type: 'image'` → single image. Download `thumbnailUrl`.
- `type: 'video'` → has extra `videoUrl` (the actual video). `thumbnailUrl` is the poster frame. `sidecarItems` is `[]`.
- `type: 'sidecar'` → carousel. `sidecarItems[]` holds one `display_url` per slide (8 slides seen on the sample post). Slides observed so far are images.

## Media URLs & the CDN proxy

`thumbnailUrl`, `videoUrl`, and `display_url` are all **base64-encoded Instagram CDN URLs**. Decode with standard base64 (pad to a multiple of 4). Example decoded value:

```
https://scontent-lax3-1.cdninstagram.com/v/t51.71878-15/818685629_..._n.jpg?stp=...&ig_cache_key=...&oe=6AB9B489
```

### Downloading the actual bytes

Two things to know, both **verified**:

1. **The direct Instagram URL returns `403`** when requested from a server (it's IP/referer/signature-bound). You must go through the proxy.
2. **The proxy works — but only with a fresh URL:**

   ```
   GET https://cdn.storynavigation.com/?<base64_url>
   Header: Referer: https://storynavigation.com/
   ```

   - ✅ Fresh base64 URL (straight from an API response) → `200 image/jpeg`, full resolution (a sample returned 1.27 MB, 3075×4096).
   - ❌ Stale/expired base64 URL (e.g. scraped from cached HTML) → `403 "Bad URL hash"`.

**Critical implementation rule:** Instagram URLs are **signed and expire**. Always download media **immediately** after receiving the API response. Never persist the base64 URLs to fetch later — they will have expired.

The download logic mirrors the site's own `socialstory.js`:

```js
// image / sidecar slide (base64 url as query string, via the proxy):
'https://cdn.storynavigation.com/?' + thumbnailUrl        // (or display_url)
// video (base64 url appended to path, different host):
'https://stories-cdn.fun/' + videoUrl                     // NOT the cdn proxy
```

**Video download is verified** ✅ — against a fresh `type: video` post from natgeo:

```
GET https://stories-cdn.fun/<videoUrl_base64>
Header: Referer: https://storynavigation.com/
→ 200 video/mp4, 17.2 MB, valid ISO MP4 (ftyp + moov + mdat all present)
```

Note the two hosts use **different URL shapes**: images pass the base64 as a `?query` to `cdn.storynavigation.com`; videos append the **raw base64** to the `stories-cdn.fun` path (not decoded, not a query param). The same "URLs expire, download immediately" rule applies to videos.

## Known limitations (important)

These were discovered during reverse engineering and directly affect what's buildable:

1. **Only ~12 recent posts are exposed per profile.** Verified across four accounts:

   | Account | `mediaCount` (total on IG) | Posts returned |
   |---------|---------------------------|----------------|
   | heyjoanar | 493 | 12 |
   | natgeo | 31,998 | 12 |
   | nasa | 4,927 | 12 |
   | instagram | 8,590 | 12 |

   In every case `needToLoadPosts` is `false`. **There is currently no working way to fetch the full history** through this site.

2. **`paginate-medias` returns `500`** for all tested inputs (`page` 1/2, int/string), with a valid session (control endpoint returns 200 in the same session). It appears broken/disabled server-side.

3. **`get-post-by-short-code` returns `500`** likewise. In `app.js` it's meant to return `video_url` for videos or expanded `sidecarItems` — but it currently errors.

4. **Consequence for the "download ALL posts" goal:** not achievable via StoryNavigation as-is. The realistic scope is **"the latest ~12 posts per profile, polled over time"** — which, run daily, still accumulates history going forward (you capture new posts as they appear). Backfilling old posts would require a different data source.

## Why StoryNavigation (alternatives evaluated)

Before committing, 8 alternative free Instagram mirrors were probed (2026-09-23) to see if any could backfill full history via a plain HTTP client (no headless browser). Result: **almost all are behind Cloudflare**, and StoryNavigation was the only one scriptable without a browser.

| Site | Result | Scriptable via HTTP? |
|------|--------|----------------------|
| imginn | 403 `cf-mitigated: challenge` | ❌ Cloudflare |
| storiesdown | Cloudflare challenge | ❌ Cloudflare |
| dumpor | Cloudflare challenge | ❌ Cloudflare |
| greatfon | Cloudflare JS challenge | ❌ Cloudflare |
| picnob / pixwox | 403 `cf-mitigated: challenge` | ❌ Cloudflare |
| iganony | Cloudflare challenge | ❌ Cloudflare |
| inflact | reachable, but download gated behind login + paid subscription | ❌ Paid |
| anonyig | reachable, but `/api/v1/instagram/*` requires Cloudflare Turnstile (`/api/cf` → `wh-cf-token`) + client-side request signing (`subscribeSignedRequestBody`) + captcha (`/api/captcha`) + `Bearer` token | ❌ Needs headless browser |
| **storynavigation** | **session cookie + Laravel CSRF only — no captcha, no Turnstile** | ✅ **the only one** |

**Conclusion:** for a headless addon on a Raspberry Pi, StoryNavigation is the best target despite the ~12-post cap. The alternatives that expose full history all require a real browser to clear Cloudflare/Turnstile and defeat request signing — heavy on an RPi and brittle (breaks on every one of their deploys). Full-history backfill would realistically need a paid cloud scraper (e.g. Apify) or the official Instagram data export (own accounts only).

## Planned API surface

Following the style of `@zweer/ream-client` / `@zweer/substack-client`:

```typescript
import { StoryNavigationClient } from '@zweer/storynavigation-client';

const client = new StoryNavigationClient(); // no auth; manages session/CSRF internally

// Profile info + statistics
const profile = await client.getProfile('heyjoanar');

// The latest ~12 posts (decoded, ready to download)
const posts = await client.getUserMedias('heyjoanar');

// Download media bytes (must happen promptly — URLs expire)
const bytes = await client.downloadImage(post.thumbnailUrl);      // Buffer/Uint8Array
const slide = await client.downloadImage(sidecarItem.display_url);
const video = await client.downloadVideo(post.videoUrl);          // via stories-cdn.fun (unverified)
```

The client owns the fragile parts: session bootstrap, CSRF handling, base64 decode, "fetch-then-download-now" ordering, retries, and typed errors. Downstream consumers (e.g. a Home Assistant archiver addon) only see clean types.

## Planned architecture

```
lib/
├── client.ts     # StoryNavigationClient facade (recommended entry point)
├── http.ts       # Session bootstrap + CSRF + retry + error mapping
├── profile.ts    # get-user-profile
├── medias.ts     # get-user-medias (+ pagination if ever fixed)
├── media.ts      # base64 decode + CDN proxy download (image/video)
├── stories.ts    # highlights + last stories (untested endpoints)
├── errors.ts     # typed error classes (CsrfError, ServerError, ExpiredUrlError, ...)
└── types.ts      # Post, SidecarItem, Profile, AccountInfo, PostsStatistics
```

## Verification notes

Everything above was checked against live endpoints with `curl` on 2026-09-23:

- ✅ Session + CSRF flow → `get-user-profile` / `get-user-medias` return 200 with full JSON.
- ✅ CDN proxy returns real full-resolution JPEG bytes for a fresh URL; `403 "Bad URL hash"` for stale ones.
- ✅ ~12-post cap confirmed on 4 accounts; `paginate-medias` and `get-post-by-short-code` confirmed `500`.
- ✅ `image` / `video` / `sidecar` shapes captured (video adds `videoUrl`; sidecar uses `sidecarItems[].display_url`).
- ✅ Video download via `stories-cdn.fun` — 200, valid 17.2 MB MP4 (natgeo post `DdG4RIxIPyf`).
- ⚠️ Not yet verified: highlights/stories/comments endpoints.

## Development

```bash
npm install          # Install dependencies
npm run build        # Build with tsdown
npm run lint         # Run all linters
npm test             # Run unit tests
npm run test:e2e     # Run e2e tests
```

## License

MIT
