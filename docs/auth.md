# Auth / Session

## Overview

StoryNavigation is a Laravel + Vue app. It requires **no credentials or secrets** —
it hands out an anonymous session. Every data endpoint is a `POST` guarded by
Laravel's CSRF protection, so each call needs a valid `laravel_session` cookie plus
a URL-decoded `XSRF-TOKEN` sent in the `X-XSRF-TOKEN` header.

## Base URL

`https://storynavigation.com`

A white-labeled mirror deployment lives at `https://storynavigation.com/mystorysaver-data`
with identical request/response shapes (see below).

## Session bootstrap

**Endpoint:** `GET /user/<username>`

A plain GET of any public user page sets the two session cookies.

```bash
curl -sS -c cookies.txt "https://storynavigation.com/user/natgeo" -o /dev/null
```

**Response:** `200 OK`

**Set-Cookie (both `HttpOnly`, ~1 year expiry):**

| Cookie | Purpose |
|--------|---------|
| `laravel_session` | Server session identifier |
| `XSRF-TOKEN` | CSRF token (arrives **URL-encoded**) |

## Deriving the CSRF header

The `XSRF-TOKEN` cookie value is URL-encoded (it ends with `%3D` for the `=`
padding). It **must be URL-decoded** before being placed in the `X-XSRF-TOKEN`
header, otherwise the POST returns `419`.

```bash
RAW=$(awk '/XSRF-TOKEN/ {print $7}' cookies.txt)
TOKEN=$(printf '%s' "$RAW" | python3 -c 'import sys,urllib.parse; print(urllib.parse.unquote(sys.stdin.read()))')
```

## Required headers for every POST

```
Content-Type:     application/json
X-Requested-With: XMLHttpRequest
X-XSRF-TOKEN:     <url-decoded XSRF-TOKEN cookie>
Referer:          https://storynavigation.com/user/<username>
Origin:           https://storynavigation.com
Accept:           application/json, text/plain, */*
```

Send the `laravel_session` + `XSRF-TOKEN` cookies back with the request
(`-b cookies.txt`).

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| `419` | `{"message":"CSRF token mismatch."}` | Missing/invalid session or `X-XSRF-TOKEN` (e.g. a cold call with no session) — **verified** |
| `500` | `{"message":"Server Error"}` | Server-side broken endpoints (`paginate-medias`, `get-post-by-short-code`) — **verified** |

## Mirror namespace

Every endpoint below also exists under `/mystorysaver-data/<endpoint>` with the
same auth flow and identical response shapes.

**Verified:** `POST /mystorysaver-data/get-user-profile {"userName":"natgeo"}` → `200`,
same keys and 12 posts as the primary namespace.

## Verification

Checked against live endpoints on 2026-09-23:

- ✅ `GET /user/natgeo` → `200`, sets `laravel_session` + `XSRF-TOKEN`.
- ✅ URL-decoded token in `X-XSRF-TOKEN` → POST endpoints return `200`.
- ✅ Cold call (no session/CSRF) → `419 CSRF token mismatch`.
- ✅ Mirror `/mystorysaver-data/get-user-profile` → `200`, identical shape.
