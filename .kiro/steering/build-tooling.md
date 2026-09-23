# Build & Tooling

## Stack

| Tool | Purpose |
|------|---------|
| TypeScript 6+ | Language (strict, ESM) |
| Node.js 22+ | Runtime |
| tsdown | Build (ESM + CJS, DTS) |
| Vitest | Testing |
| Biome | Lint + Format |
| msw | HTTP mocking in tests |
| lefthook | Git hooks |
| commitlint | Conventional commits |

## Commands

```bash
npm run build          # Build with tsdown
npm run lint           # All linters (parallel)
npm run lint:typecheck # TypeScript type check
npm run lint:format    # Biome check + fix
npm test               # Run tests
npm run test:coverage  # Tests with coverage
npm run test:e2e       # Run e2e against live endpoints (scripts/e2e.ts)
```

## Package

- Name: `@zweer/storynavigation-client`
- ESM + CJS dual output
- Single entry point: `"."` → main client
- No auth/secrets required — the client bootstraps its own session + CSRF
