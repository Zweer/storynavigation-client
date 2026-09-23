# Medias

## Overview

Fetches the latest ~12 posts for a public account. Same `Post[]` array embedded in
`get-user-profile`, but available standalone. Also documents the two **broken**
server-side endpoints (`paginate-medias`, `get-post-by-short-code`) that block
full-history retrieval.

## Base URL

`https://storynavigation.com`

## Endpoints

### Get user medias

**Endpoint:** `POST /get-user-medias`
**Auth:** session cookie + `X-XSRF-TOKEN` header (see `auth.md`)

**Request Headers:** (same as every POST — see `auth.md`)
```
Content-Type: application/json
X-Requested-With: XMLHttpRequest
X-XSRF-TOKEN: <url-decoded XSRF-TOKEN>
Referer: https://storynavigation.com/user/<username>
Origin: https://storynavigation.com
Accept: application/json, text/plain, */*
```

**Request Body:** (note **snake_case** `user_name`)
```json
{ "user_name": "natgeo" }
```

> ⚠️ **Mixed casing is intentional.** This endpoint uses `user_name`
> (snake_case) while `get-user-profile` / `paginate-medias` use `userName`
> (camelCase). Do not "normalize" it — the wrong casing returns an error/empty.

**Response:** `200 OK` — a bare JSON array (`Post[]`), **not** wrapped in an object.

## Media model

Every post shares the same shape; `type` drives which fields matter.

```typescript
interface Post {
  id: string;              // Instagram short code, e.g. "DdG4RIxIPyf"
  type: 'image' | 'video' | 'sidecar';
  isVideo: boolean;
  caption: string;         // may contain unicode/emoji; can be empty
  likesCount: number;
  commentsCount: number;
  createdTime: string;     // human string, e.g. "26 June 2026 18:57:05" (NOT ISO)
  thumbnailUrl: string;    // base64-encoded IG image URL (cover for videos)
  sidecarItems: SidecarItem[];  // [] unless type === 'sidecar'
  videoUrl?: string;       // base64-encoded IG video URL — only when type === 'video'
}

interface SidecarItem {
  display_url: string;     // base64-encoded IG image URL for that slide
}
```

**Per type (verified):**

- `type: 'image'` → single image. Download `thumbnailUrl`.
- `type: 'video'` → has extra `videoUrl` (the actual video). `thumbnailUrl` is the
  poster frame. `sidecarItems` is `[]`.
- `type: 'sidecar'` → carousel. `sidecarItems[]` holds one `display_url` per slide.

All media URLs are base64-encoded IG CDN URLs — see `media.md` for decode + download.

### The ~12-post cap (important limitation)

Only ~12 recent posts are ever exposed per profile, regardless of the account's
total post count. `needToLoadPosts` is always `false`.

| Account | `mediaCount` (total on IG) | Posts returned |
|---------|---------------------------|----------------|
| natgeo | 32007 | 12 |
| nasa | 4927 | 12 |

There is currently **no working way** to fetch the full history through this site
(see the broken pagination endpoints below).

### Paginate medias — BROKEN (500)

**Endpoint:** `POST /paginate-medias`
**Request Body:** `{ "userName": "natgeo", "page": 2 }`  (camelCase `userName`)

**Response:** `500`
```json
{ "message": "Server Error" }
```

Returns `500` for all tested inputs (page 1/2, int/string), with a valid session
(control endpoint returns `200` in the same session). Broken/disabled server-side.

### Get post by short code — BROKEN (500)

**Endpoint:** `POST /get-post-by-short-code`
**Request Body:** `{ "short_code": "DdG4RIxIPyf" }`

**Response:** `500`
```json
{ "message": "Server Error" }
```

In `app.js` this is meant to return `video_url` for videos or expanded
`sidecarItems` — but it currently errors.

## Consequence

Full backfill is not achievable via StoryNavigation as-is. Realistic scope:
**"the latest ~12 posts per profile, polled over time"** — which, run regularly,
accumulates history going forward.

## Verification

Checked against live endpoints on 2026-09-23 (`natgeo`):

- ✅ `POST /get-user-medias {"user_name":"natgeo"}` → `200`, bare array of 12 posts.
- ✅ Post keys: `id`, `type`, `isVideo`, `caption`, `likesCount`, `commentsCount`,
  `createdTime`, `thumbnailUrl`, `sidecarItems`, `videoUrl`.
- ✅ Types mix observed on natgeo: 6 video / 5 image / 1 sidecar.
- ✅ `POST /paginate-medias {"userName":"natgeo","page":2}` → `500 Server Error`.
- ✅ `POST /get-post-by-short-code {"short_code":"DdG4RIxIPyf"}` → `500 Server Error`.
