# AGENTS.md — storynavigation-client

Universal steering file for AI agents working on this project.

## Project Identity

**storynavigation-client** is a TypeScript library that wraps StoryNavigation's internal API — an Instagram mirror. It fetches public profile info, recent posts (images, videos, carousels), and downloads the underlying media. No official API exists — this library reverse-engineers the internal endpoints.

> ⚠️ **Unofficial.** StoryNavigation itself mirrors Instagram content; all media belongs to the original authors. Endpoints are private/undocumented and may break at any time. Use for personal/informational purposes only.

The library covers: profile + statistics, the latest ~12 posts per profile, base64 CDN URL decoding, media download (images + videos via the proxy), and the untested stories/highlights/comments endpoints. See `README.md` for the full verified spec.

## Stack

- **Language:** TypeScript (strict mode, ES modules)
- **Runtime:** Node.js 22+
- **HTTP:** Native fetch (async/await), no axios
- **Testing:** Vitest + MSW
- **Build:** tsdown
- **Lint/Format:** Biome
- **Package:** `@zweer/storynavigation-client` (npm)
- **Auth:** none — the client bootstraps its own Laravel session + CSRF token

## Agent Architecture

This project uses two specialized Kiro agents:

### `rev-eng` — Reverse Engineering Agent
- **Purpose:** Discover StoryNavigation's internal API over plain HTTP
- **Method:** `curl` (session bootstrap + Laravel CSRF) — **no browser, no Playwright** (the site is fully scriptable without one; that's why it was chosen over 8 Cloudflare-gated alternatives)
- **Input:** an optional public username in `.env` (no secrets)
- **Output:** API documentation in `docs/*.md`
- **Tools:** `shell` (curl), `web_fetch`, `web_search`

### `dev` — Development Agent
- **Purpose:** Implement the TypeScript library from the API docs
- **Input:** `docs/*.md` (produced by rev-eng) + `README.md`
- **Output:** `lib/`, `test/`, types, client code

### Workflow

```
rev-eng (curl) → docs/*.md → dev (implementation) → lib/ + test/
```

1. `rev-eng` bootstraps a session, calls each endpoint, documents shapes/status/quirks
2. `dev` reads the docs and implements type-safe wrappers

## Documentation Structure

```
docs/                  # Reverse-engineered API reference (rev-eng output)
├── auth.md            # Session bootstrap + Laravel CSRF
├── profile.md         # get-user-profile
├── medias.md          # get-user-medias (+ broken pagination)
├── media.md           # base64 decode + CDN proxy download
├── stories.md         # highlights + last stories (untested)
└── comments.md        # get-media-comments (untested)
```

## Library Structure

```
lib/
├── index.ts      # Public barrel (re-exports)
├── client.ts     # StoryNavigationClient facade
├── http.ts       # Session bootstrap + CSRF + retry + error mapping
├── profile.ts    # get-user-profile
├── medias.ts     # get-user-medias
├── media.ts      # base64 decode + CDN proxy download (image/video)
├── stories.ts    # highlights + last stories
├── errors.ts     # typed error classes
└── types.ts      # Post, SidecarItem, Profile, AccountInfo, PostsStatistics
```

## Kiro Configuration

```
.kiro/
├── agents/
│   ├── rev-eng.json   # Agent definition (curl/web_fetch, write to docs/)
│   └── dev.json       # Agent definition (full dev tools, write to lib/test/)
├── prompts/
│   ├── rev-eng.md     # Detailed instructions for API discovery
│   └── dev.md         # Detailed instructions for implementation
└── steering/
    ├── interaction.md
    ├── code-style.md
    ├── build-tooling.md
    ├── commit-conventions.md
    ├── code-review.md
    ├── plan-product.md
    ├── plan-eng.md
    └── ship-prep.md
```

## Domain Quirks (must-know)

Full details in `README.md`. The fragile parts the client owns:

- **Session + CSRF:** GET `/user/<username>` sets `laravel_session` + `XSRF-TOKEN`; URL-decode the token into the `X-XSRF-TOKEN` header. Cold calls return `419 CSRF token mismatch`
- **Mixed casing (by design):** `/get-user-medias` uses `user_name`; `/get-user-profile` + `/paginate-medias` use `userName`. Don't "fix" it
- **Base64 media URLs:** `thumbnailUrl` / `videoUrl` / `display_url` are base64-encoded Instagram CDN URLs (pad to a multiple of 4)
- **Two CDN hosts:** images → `cdn.storynavigation.com/?<base64>`; videos → `stories-cdn.fun/<raw base64>`; both need `Referer: https://storynavigation.com/`
- **URLs expire:** signed + short-lived → download immediately (fetch-then-download-now); stale → `403 Bad URL hash`; direct IG URL → `403`
- **Known limitations:** only ~12 recent posts per profile; `paginate-medias` and `get-post-by-short-code` return `500` (broken server-side)

## Conventions (Summary)

Full details in `.kiro/steering/`. Key rules:

- TypeScript strict, no `any`, explicit return types on exports
- ES modules with `.js` extensions in imports
- `async/await` everywhere, native `fetch`
- Biome for lint + format (not ESLint/Prettier)
- Vitest for tests (AAA pattern)
- Conventional commits + gitmoji (text codes, not emoji)

## Interaction Rules

### Language
- **Conversation:** Italian
- **Code, comments, commits, docs:** English

### Git
- **NEVER commit, push, or create tags** — the developer handles all git operations
- Prepare changes and suggest a commit message
- The developer reviews and commits manually

### Interview Before Implementing
For ambiguous or complex requests, ask clarifying questions BEFORE writing code. Skip for clear, well-defined tasks.

### Plan Before Implementing
For multi-step tasks (new features, refactors, architecture changes):
1. Write a short numbered plan first
2. Wait for approval before implementing
3. Adapt the plan if requirements change mid-execution

Skip planning for single-file fixes, small bug fixes, or simple questions.

### Workflow Triggers

| Trigger | Mode | When |
|---|---|---|
| `plan product` | Product Owner | Starting a feature, vague requirements |
| `plan eng` | Tech Lead | After product direction is set, before implementing |
| `code review` | Paranoid Reviewer | After implementation, before committing |
| `ship prep` | Release Engineer | Final checklist before commit |

Details for each mode in `.kiro/steering/`.
