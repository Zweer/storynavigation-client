# Commit Conventions

**IMPORTANT**: The agent NEVER commits, pushes, or creates tags. The developer handles all git operations manually. At the end of each task, suggest a commit message.

## Format

Conventional commits with gitmoji as text codes (not emoji):

```
type(scope): :emoji_code: short description

Detailed explanation of what changed and why.
```

## Types

- `feat` — New feature (`:sparkles:`)
- `fix` — Bug fix (`:bug:`)
- `perf` — Performance improvement (`:zap:`)
- `docs` — Documentation (`:memo:`)
- `chore` — Maintenance tasks (`:wrench:`, `:arrow_up:`, `:bookmark:`)
- `refactor` — Code refactoring (`:recycle:`)
- `test` — Tests (`:white_check_mark:`)
- `style` — Code formatting (`:art:`)
- `ci` — CI/CD changes (`:construction_worker:`)
- `build` — Build system (`:hammer:`)

## Scope

Use the module or area affected:
- `client` — Main StoryNavigationClient class
- `http` — HTTP client internals (session bootstrap, CSRF, retry, error mapping)
- `profile` — get-user-profile
- `medias` — get-user-medias / pagination
- `media` — base64 decode + CDN proxy download (image/video)
- `stories` — highlights + last stories
- `errors` — typed error classes
- `types` — type definitions
- `api` — reverse-engineered API docs (rev-eng agent)

Scope is optional for cross-cutting changes.

## Gitmoji

**Always use text codes** (`:sparkles:`), **never actual emoji** (✨).

## Body

**Always include a detailed body** explaining:
1. What was changed
2. Why it was changed
3. Any important context or side effects

## Examples

```
feat(medias): :sparkles: implement get-user-medias with typed Post model

Fetch the latest ~12 posts via POST /get-user-medias (note the
snake_case user_name param). Maps image/video/sidecar types and
decodes the base64 CDN URLs. Documents the ~12-post cap.
```

```
docs(api): :memo: document media download via CDN proxy

Reverse-engineered from socialstory.js + live curl:
- images: GET cdn.storynavigation.com/?<base64> (+ Referer)
- videos: GET stories-cdn.fun/<raw base64> (+ Referer)
- signed URLs expire → download immediately; stale → 403 Bad URL hash.
```

```
fix(http): :bug: url-decode XSRF-TOKEN before setting header

The XSRF-TOKEN cookie arrives URL-encoded. Passing it verbatim into
X-XSRF-TOKEN caused 419 CSRF token mismatch; decode it first.
```
