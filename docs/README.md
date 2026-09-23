# API Documentation

Reverse-engineered reference for StoryNavigation's internal API, produced by the
`rev-eng` agent and consumed by the `dev` agent. See the root `README.md` for the
high-level spec and verification notes.

| File | Area |
|------|------|
| `auth.md` | Session bootstrap + Laravel CSRF |
| `profile.md` | `get-user-profile` |
| `medias.md` | `get-user-medias` (+ broken `paginate-medias` / `get-post-by-short-code`) |
| `media.md` | Base64 decode + CDN proxy download (image/video) |
| `stories.md` | Highlights + last stories (untested) |
| `comments.md` | `get-media-comments` (untested) |

> These files are written by the `rev-eng` agent. Everything must be verified
> against live endpoints with exact URLs, headers, payloads, and status codes.
