# Profile

## Overview

Fetches a public account's profile info, aggregate post statistics, and the latest
~12 posts in a single call. This is the primary "landing" call the Vue frontend
makes when a user page loads.

## Base URL

`https://storynavigation.com`

## Endpoints

### Get user profile

**Endpoint:** `POST /get-user-profile`
**Auth:** session cookie + `X-XSRF-TOKEN` header (see `auth.md`)

**Request Headers:**
```
Content-Type: application/json
X-Requested-With: XMLHttpRequest
X-XSRF-TOKEN: <url-decoded XSRF-TOKEN>
Referer: https://storynavigation.com/user/<username>
Origin: https://storynavigation.com
Accept: application/json, text/plain, */*
```

**Request Body:** (note **camelCase** `userName`)
```json
{ "userName": "natgeo" }
```

**Response:** `200 OK`
```jsonc
{
  "found": true,
  "isPrivate": false,
  "accountInfo": {
    "id": 787132,                 // Instagram numeric user id (needed by stories/highlights)
    "username": "natgeo",
    "fullName": "",
    "profilePicUrl": "<base64-encoded IG url>",
    "biography": "…",
    "followsCount": 152,
    "followedByCount": 279000000,
    "mediaCount": 32007,          // total posts on Instagram (NOT how many are returned)
    "isPrivate": false
  },
  "posts": [ /* Post[] — only ~12, see medias.md */ ],
  "postsStatistics": {
    "averageCountOfLikes": 33778,
    "averageCountOfComments": 608,
    "averageTimeBetweenPosts": "7 day(s) 09 hour(s)",
    "commentsCount": 7301,
    "likesCount": 405339,
    "percentOfFollowersWhoComments": 1.24,
    "percentOfFollowersWhoLikes": 0.05
  },
  "needToLoadPosts": false
}
```

**Notes:**
- Parameter casing: **`userName` (camelCase)**. Contrast with `get-user-medias`,
  which uses `user_name` (snake_case) — see `medias.md`.
- `accountInfo.id` is the Instagram numeric user id. It is the `userId` /
  `instagramUserId` required by the stories/highlights endpoints (see `stories.md`).
- `accountInfo.profilePicUrl` is a **base64-encoded** IG URL (decode + proxy to
  download — see `media.md`).
- `postsStatistics` includes **both** `percentOfFollowersWhoComments` and
  `percentOfFollowersWhoLikes` (the latter was previously undocumented).
- `posts` is the same `Post[]` returned by `get-user-medias`. The full model is
  documented in `medias.md`.
- `mediaCount` is the account's total IG post count; only ~12 are ever returned
  and `needToLoadPosts` is `false` (see the ~12-post cap in `medias.md`).

## Verification

Checked against live endpoints on 2026-09-23 (`natgeo`, `nasa`):

- ✅ `POST /get-user-profile {"userName":"natgeo"}` → `200`.
- ✅ Keys: `found`, `isPrivate`, `accountInfo`, `posts`, `postsStatistics`, `needToLoadPosts`.
- ✅ `accountInfo` keys: `id`, `username`, `fullName`, `profilePicUrl`, `biography`,
  `followsCount`, `followedByCount`, `mediaCount`, `isPrivate`.
- ✅ 12 posts returned; `mediaCount` = 32007 (natgeo) / 4927 (nasa); `needToLoadPosts` = false.
- ✅ `postsStatistics` includes `percentOfFollowersWhoLikes`.
