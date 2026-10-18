# @zweer/storynavigation-client

TypeScript client for [StoryNavigation](https://storynavigation.com)'s internal API — an Instagram mirror. Fetch public profile info, recent posts (images, videos, carousels), and download the underlying media.

> ⚠️ **Unofficial** — This library reverse-engineers StoryNavigation's private, undocumented endpoints. It may break at any time if the site changes its API, encoding, or anti-bot protections. StoryNavigation itself mirrors Instagram content; all media belongs to the original authors. Use for personal/informational purposes only.

## Status

Reverse engineering complete and library implemented. The API shapes below were verified against live endpoints (2026-09-23) and re-confirmed on 2026-10-18.

> ⚠️ **Cloudflare update (2026-10):** StoryNavigation moved **behind a Cloudflare "managed challenge"**. Every request (including the `GET /user/<username>` session bootstrap) now returns `403` with `cf-mitigated: challenge` and a "Just a moment..." page, and sets **no** session cookies. The raw HTTP-only flow this project was originally built on **no longer works on its own.**
>
> The library now supports an **optional, injectable challenge solver** that clears the challenge and hands back replayable cookies + User-Agent. A ready-to-use [Byparr](https://github.com/ThePhaseless/Byparr) implementation is included. With a solver configured, the full flow (profile, medias, media download) was re-verified end-to-end on 2026-10-18 (`heyjoanar`): challenge cleared, `POST /get-user-profile` → `200` with the documented shape. See [Bypassing Cloudflare](#bypassing-cloudflare-challenge-solver).
>
> Without a solver the client still works unchanged against any deployment **not** behind a challenge, and fails fast with a typed `ChallengeError` telling you to configure one when it hits a challenge.

## Table of contents

- [How the site works](#how-the-site-works)
- [Session & auth flow (Laravel CSRF)](#session--auth-flow-laravel-csrf)
- [Bypassing Cloudflare (challenge solver)](#bypassing-cloudflare-challenge-solver)
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

> **As of 2026-10 this flow is gated by Cloudflare.** Step 1 (`GET /user/<username>`) now returns `403 cf-mitigated: challenge` and sets no cookies, so steps 2–3 never happen. A [challenge solver](#bypassing-cloudflare-challenge-solver) is required to obtain the `laravel_session` / `XSRF-TOKEN` cookies (plus a `cf_clearance` cookie and a matching User-Agent) before any POST can succeed.

## Bypassing Cloudflare (challenge solver)

Since the site sits behind a Cloudflare managed challenge, the client can delegate the challenge to a **solver**: a service that runs a real stealth browser, clears the challenge, and returns the resulting cookies (`cf_clearance`, `laravel_session`, `XSRF-TOKEN`, …) plus the browser's User-Agent. The client then replays those on the normal HTTP endpoints.

### Design

The solver is an injectable abstraction — Byparr is just one implementation:

```typescript
interface SolvedSession {
  cookies: Record<string, string>; // cf_clearance, laravel_session, XSRF-TOKEN, ...
  userAgent: string;               // MUST be reused on every request (see below)
}
interface ChallengeSolver {
  solve(url: string): Promise<SolvedSession>;
}
```

> **Critical:** the `cf_clearance` cookie is bound to the **User-Agent** of the browser that generated it. The client sends the solver's returned User-Agent on every subsequent request; changing it invalidates the clearance.

### Running Byparr

[FlareSolverr](https://github.com/FlareSolverr/FlareSolverr) was evaluated first but is **archived (Dec 2025)** and fails against current managed challenges. [Byparr](https://github.com/ThePhaseless/Byparr) is its maintained, FlareSolverr-compatible successor and is what this project uses. A ready-to-use Compose file lives at [`docker-compose.byparr.yml`](docker-compose.byparr.yml):

```bash
# start the solver (exposes a FlareSolverr-compatible API on :8191)
docker compose -f docker-compose.byparr.yml up -d

# optional: fire-test it against the live site before wiring it into the client
./scripts/byparr-probe.sh heyjoanar
```

> The Compose file pins `/cache` and `/tmp` to larger RAM-backed `tmpfs` mounts **with the `exec` flag** — Byparr downloads and launches a browser there, so the stock 512 MB non-exec mount fails with `No space left on device` / `firefox EACCES`.

### Using it

```typescript
import { StoryNavigationClient, ByparrSolver } from '@zweer/storynavigation-client';

// Convenience: just point the client at a running Byparr instance.
const client = new StoryNavigationClient({ byparrUrl: 'http://localhost:8191' });

// Or inject any ChallengeSolver implementation explicitly.
const client2 = new StoryNavigationClient({
  solver: new ByparrSolver({ baseUrl: 'http://localhost:8191' }),
});

const profile = await client.getProfile('heyjoanar'); // bootstraps via the solver
```

With a solver configured the client bootstraps the session through it, injects the returned cookies, sends the matching User-Agent on every call, and — if a later request hits a fresh challenge — re-solves **once** before retrying (mirroring the existing CSRF re-bootstrap). Any solver failure (service unreachable, non-200, malformed body) surfaces as a typed `ChallengeError`.

> ⚠️ A solver greatly increases the odds of clearing the challenge but does **not** guarantee it. Cloudflare may also require traffic from a residential/"legitimate"-looking IP, so a datacenter or VPN egress can still fail. This is a brittle arms race: it works today and may break on a future Cloudflare update.

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

**Conclusion (2026-09-23):** for a headless addon on a Raspberry Pi, StoryNavigation was the best target despite the ~12-post cap. The alternatives that expose full history all require a real browser to clear Cloudflare/Turnstile and defeat request signing — heavy on an RPi and brittle (breaks on every one of their deploys). Full-history backfill would realistically need a paid cloud scraper (e.g. Apify) or the official Instagram data export (own accounts only).

> **Update (2026-10):** StoryNavigation has since **also moved behind Cloudflare** (managed challenge), erasing the "scriptable without a browser" advantage that made it the pick here. It is no longer meaningfully lighter than the alternatives on that axis: clearing the challenge now requires a stealth-browser solver (see [Bypassing Cloudflare](#bypassing-cloudflare-challenge-solver)), the same class of tool the other mirrors needed. It remains the chosen target because the API behind the challenge is unchanged and well-understood, but the original rationale no longer holds.

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

## Architecture

```
lib/
├── client.ts     # StoryNavigationClient facade (recommended entry point)
├── http.ts       # Session bootstrap + CSRF + solver wiring + retry + error mapping
├── solver.ts     # ChallengeSolver / SolvedSession abstraction (Cloudflare bypass)
├── byparr.ts     # ByparrSolver — ChallengeSolver backed by a local Byparr instance
├── profile.ts    # get-user-profile
├── medias.ts     # get-user-medias (+ pagination if ever fixed)
├── media.ts      # base64 decode + CDN proxy download (image/video)
├── stories.ts    # highlights + last stories (untested endpoints)
├── errors.ts     # typed error classes (CsrfError, ServerError, ExpiredUrlError, ChallengeError, ...)
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

Re-confirmed on 2026-10-18 (`heyjoanar`), with the site now behind Cloudflare:

- ✅ Cold `GET /user/<username>` and `POST /get-user-profile` → `403 cf-mitigated: challenge` (the plain flow is dead).
- ✅ Byparr clears the challenge and returns `cf_clearance` + `laravel_session` + `XSRF-TOKEN` + the browser User-Agent.
- ✅ Replaying those cookies + User-Agent + url-decoded `X-XSRF-TOKEN` → `POST /get-user-profile` returns `200` with the exact documented shape (12 posts, full `accountInfo` / `postsStatistics`).

## Development

```bash
npm install          # Install dependencies
npm run build        # Build with tsdown
npm run lint         # Run all linters
npm test             # Run unit tests
npm run test:e2e     # Run e2e tests (live endpoints — needs a running solver, see below)

# Cloudflare challenge solver (required for anything hitting the live site)
docker compose -f docker-compose.byparr.yml up -d   # start Byparr on :8191
./scripts/byparr-probe.sh heyjoanar                 # fire-test the solver
docker compose -f docker-compose.byparr.yml down    # stop it
```

## License

MIT
