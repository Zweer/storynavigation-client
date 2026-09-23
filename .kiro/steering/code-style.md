# Code Style

## TypeScript

- Strict mode, no `any`, explicit return types on exports
- ES modules with `.js` extensions in imports
- `async/await` everywhere, native `fetch` (no axios)
- `interface` for objects, `type` for unions/intersections
- JSDoc on all public API methods
- No default exports (only named exports)
- camelCase for variables/functions, PascalCase for types/classes

## Formatting

- Biome for lint + format (NOT ESLint/Prettier)
- Single quotes
- 100 char line width
- 2 space indent

## Testing

- Vitest for tests
- MSW (Mock Service Worker) for HTTP mocking
- AAA pattern (Arrange, Act, Assert)
- Test files: `test/{module}.test.ts`
