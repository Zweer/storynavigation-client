# Stories & Highlights

## Overview

Three endpoints expose an account's active stories and its saved highlights (and
the items inside each highlight). All three are **now verified** (previously
untested) against `nasa` on 2026-09-23. They require the same session + CSRF flow
as every other POST (see `auth.md`), and the numeric `accountInfo.id` from
`get-user-profile` (see `profile.md`).

All media URLs returned here are **base64-encoded IG CDN URLs** — decode + proxy to
download (see `media.md`).

## Base URL

`https://storynavigation.com`

## Endpoints

### Get user highlights

**Endpoint:** `POST /get-user-highlights`
**Auth:** session cookie + `X-XSRF-TOKEN` header (see `auth.md`)

**Request Body:** (camelCase `userName`, numeric `userId`)
```json
{ "userName": "nasa", "userId": 528817151 }
```

**Response:** `200 OK` — a bare JSON array (`Highlight[]`).

```typescript
interface Highlight {
  id: string;              // highlight id, e.g. "18195781759377100"
  title: string;           // e.g. "Roman", "Wallpapers"
  imageThumbnail: string;  // base64-encoded IG cover image URL
}
```

- Accounts with no highlights return an **empty array** `[]` (verified on `natgeo`).
- `nasa` returned **5** highlights.
- Use `Highlight.id` as `highlightId` for `get-highlight-stories` below.

### Get highlight stories

**Endpoint:** `POST /get-highlight-stories`
**Auth:** session cookie + `X-XSRF-TOKEN` header (see `auth.md`)

**Request Body:**
```json
{ "highlightId": "18195781759377100" }
```

**Response:** `200 OK` — a bare JSON array (`StoryItem[]`).

```typescript
interface StoryItem {
  type: 'image' | 'video';
  createdTime: string;     // e.g. "2026-08-30 11:00:53" (space-separated, NOT ISO-T)
  thumbnailUrl: string;    // base64-encoded IG image URL (poster / still)
  videoUrl?: string;       // base64-encoded IG video URL — only when type === 'video'
}
```

- `type: 'image'` → download `thumbnailUrl`.
- `type: 'video'` → download `videoUrl` (via `stories-cdn.fun`); `thumbnailUrl` is
  the poster. Verified: the `nasa` "Roman" highlight returned **9** items, all
  `video`.

> Note the shape mirrors `Post` but is **leaner**: no `id`, `caption`, `likesCount`,
> etc. Only `type`, `createdTime`, `thumbnailUrl`, and (for videos) `videoUrl`.

### Get user last stories (active stories)

**Endpoint:** `POST /get-user-last-stories`
**Auth:** session cookie + `X-XSRF-TOKEN` header (see `auth.md`)

**Request Body:** (note **`instagramUserId`**, not `userId`; plus `isPrivate`)
```json
{ "userName": "nasa", "isPrivate": false, "instagramUserId": 528817151 }
```

**Response:** `200 OK` — an **object** wrapping the array: `{ "lastStories": Story[] }`.

```typescript
interface LastStoriesResponse {
  lastStories: Story[];
}

interface Story {
  id: string;              // e.g. "3991908919060144294_528817151" (mediaId_ownerId)
  type: 'image' | 'video';
  thumbnailUrl: string;    // base64-encoded IG image URL (poster)
  url: string;             // base64-encoded IG media URL (image or video)
  createdTime: string;     // time-of-day string, e.g. "15:57:27"
  taken_at: number;        // unix timestamp (seconds)
  expiring_at: number;     // unix timestamp (seconds) — story expiry
  owner_id: string;        // numeric IG user id as string
}
```

- Accounts with no active stories return `{ "lastStories": [] }` (verified on `natgeo`).
- `nasa` returned **1** active story (`type: image`) at the time of testing.
- Active stories are ephemeral (24h) — `expiring_at` is the hard deadline; the
  signed media URLs expire even sooner, so download immediately (see `media.md`).

## Verification

Checked against live endpoints on 2026-09-23:

- ✅ `POST /get-user-highlights {"userName":"nasa","userId":528817151}` → `200`,
  array of 5 `{id, title, imageThumbnail}`.
- ✅ `POST /get-user-highlights {"userName":"natgeo","userId":787132}` → `200`, `[]`.
- ✅ `POST /get-highlight-stories {"highlightId":"18195781759377100"}` → `200`,
  array of 9 `{type, createdTime, thumbnailUrl, videoUrl}` (all video).
- ✅ `POST /get-user-last-stories {"userName":"nasa","isPrivate":false,"instagramUserId":528817151}`
  → `200`, `{"lastStories":[{id, thumbnailUrl, type, url, createdTime, taken_at,
  expiring_at, owner_id}]}` (1 image story).
- ✅ `POST /get-user-last-stories` for `natgeo` → `200`, `{"lastStories":[]}`.
