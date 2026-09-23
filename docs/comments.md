# Comments

## Overview

Fetches the comments on a single post. Previously untested — **now verified** and
**working** (200) against a live `natgeo` post on 2026-09-23. Requires the same
session + CSRF flow as every other POST (see `auth.md`).

Unlike the two broken post endpoints (`paginate-medias`, `get-post-by-short-code`,
both `500` — see `medias.md`), `get-media-comments` responds normally.

## Base URL

`https://storynavigation.com`

## Endpoints

### Get media comments

**Endpoint:** `POST /get-media-comments`
**Auth:** session cookie + `X-XSRF-TOKEN` header (see `auth.md`)

**Request Body:** (note **snake_case** `media_id`; value is the post **short code**)
```json
{ "media_id": "DdG4RIxIPyf" }
```

> The `media_id` field takes the post **short code** (the `Post.id` from
> `get-user-medias`, e.g. `"DdG4RIxIPyf"`), not the numeric IG media id. Casing is
> **snake_case** here — like `get-user-medias` (`user_name`), unlike the camelCase
> profile/stories endpoints.

**Response:** `200 OK` — a bare JSON array (`Comment[]`).

```typescript
interface Comment {
  created_at: string;         // human string, e.g. "21 September 2026 09:48:23" (NOT ISO)
  text: string;               // comment body; may contain @mentions / unicode / emoji
  user_name: string;          // commenter's IG handle
  profile_pic_url: string;    // base64-encoded IG avatar URL (decode + proxy — see media.md)
  child_comments: Comment[];  // nested replies; [] when there are none
}
```

**Notes:**
- Field names are **snake_case** (`created_at`, `user_name`, `profile_pic_url`,
  `child_comments`) — different from the camelCase `Post` / stories models.
- `child_comments` is a recursive `Comment[]` (replies). Verified empty (`[]`) on
  the sampled top-level comments; the shape supports nesting.
- `profile_pic_url` is a **base64-encoded** IG URL — download via the CDN proxy
  like any other image (see `media.md`).
- Only a page of comments is returned (natgeo post returned 11). No pagination
  parameter was discovered for this endpoint. `TODO:` confirm whether a
  cursor/offset exists for fetching more than the first batch.

## Verification

Checked against live endpoints on 2026-09-23 (`natgeo` post `DdG4RIxIPyf`):

- ✅ `POST /get-media-comments {"media_id":"DdG4RIxIPyf"}` → `200`, bare array of
  11 comments.
- ✅ Comment keys: `created_at`, `text`, `user_name`, `profile_pic_url`,
  `child_comments`.
- ✅ `profile_pic_url` is a base64-encoded IG CDN URL.
- ⚠️ Pagination mechanism (if any) not yet discovered — see `TODO` above.
