# Media download

## Overview

`thumbnailUrl`, `videoUrl`, `display_url`, `profilePicUrl`, `imageThumbnail`, and
the stories `url`/`thumbnailUrl` fields are all **base64-encoded Instagram CDN
URLs**. Instagram blocks hotlinking with signed, short-lived URLs, so the site
routes downloads through its own proxies. Two hosts are involved, with **different
URL shapes** for images vs videos.

## Base64 decode rules

Decode with standard base64. StoryNavigation sometimes strips the `=` padding, so
**pad the string to a multiple of 4** before decoding.

```typescript
function decodeMediaUrl(b64: string): string {
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}
```

A decoded value looks like:

```
https://scontent-ams2-1.cdninstagram.com/v/t51.82787-15/8025..._n.jpg?stp=...&ig_cache_key=...&oe=6AB9...
```

## Downloading the bytes

### Images (and sidecar slides, profile pics, highlight thumbnails)

Pass the **base64** string (not decoded) as a query string to the CDN proxy:

```
GET https://cdn.storynavigation.com/?<base64_url>
Header (recommended): Referer: https://storynavigation.com/
```

- ✅ Fresh base64 URL → `200 image/jpeg`, full resolution (a sample returned
  358 KB, 1080×1920).
- ❌ Tampered / invalid-signature base64 URL → `403 "URL signature mismatch"`.

> **Referer note (verified 2026-09-23):** with a *fresh* URL the proxy returned
> `200` **even without** the `Referer` header. Still send
> `Referer: https://storynavigation.com/` — it mirrors the site's own behavior and
> is the safe default; do not rely on it being optional.

### Videos (posts and highlight/story videos)

Append the **raw base64** (not decoded, not a query param) to the path of a
**different host**:

```
GET https://stories-cdn.fun/<raw_base64>
Header (recommended): Referer: https://storynavigation.com/
```

- ✅ Fresh base64 URL → `200 video/mp4`, valid MP4 (a sample returned 17.2 MB,
  `ISO Media / MP4 Base Media v1`).

The download logic mirrors the site's own `socialstory.js`:

```js
// image / sidecar slide (base64 url as query string, via the proxy):
'https://cdn.storynavigation.com/?' + thumbnailUrl        // (or display_url)
// video (base64 url appended to path, different host):
'https://stories-cdn.fun/' + videoUrl
```

## The direct Instagram URL

Fetching the **decoded** Instagram CDN URL directly is unreliable and must not be
the primary path:

- ⚠️ With a *fresh, unexpired* signature the direct URL may return `200`
  (observed 2026-09-23 — contradicts the earlier "always 403" claim).
- Once the signature expires — or from a different IP — the direct URL returns
  `403`. It is IP/referer/signature-bound.

**Always go through the proxy hosts above.** They are the stable, intended path.

## URLs expire — download immediately

**Critical rule:** Instagram URLs are **signed and short-lived**. Always download
media **immediately** after receiving the API response. Never persist the base64
URLs to fetch later — they will expire and the proxy will answer
`403 "URL signature mismatch"` (or `403 "Bad URL hash"`, depending on the failure
mode). This "fetch-then-download-now" ordering is the client's responsibility.

## Verification

Checked against live endpoints on 2026-09-23 (fresh URLs from `natgeo`):

- ✅ Image via `cdn.storynavigation.com/?<b64>` → `200 image/jpeg`, 358 KB, 1080×1920.
- ✅ Video via `stories-cdn.fun/<raw b64>` → `200 video/mp4`, 17.2 MB, valid MP4.
- ✅ Tampered base64 (invalid signature) via proxy → `403 "URL signature mismatch"`.
- ⚠️ Proxy without `Referer` (fresh URL) → still `200` (send it anyway).
- ⚠️ Direct decoded IG URL (fresh signature) → `200` this time; expect `403` once
  expired or from another IP.
