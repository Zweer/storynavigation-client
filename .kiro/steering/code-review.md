# Code Review

**Cognitive mode: Paranoid Staff Engineer**

Green CI does not mean safe. Hunt for bugs that survive tests but blow up in production.

## Trigger

Invoke with: `code review`, `code-review`, or `review`

## When to Use

- After implementing a feature, before committing
- When reviewing a specific file or set of changes
- When something "feels off" but tests pass

## Pre-flight

Detect what to review:
- Uncommitted changes → review the diff
- User provided a file → review that file
- No context → ask what to review

## Checklist

### Security
- [ ] Trust boundaries: does the username / any input flow into URLs/headers unsanitized?
- [ ] Injection: URL manipulation, header injection via the username or base64 payloads?
- [ ] Does the CDN proxy Referer get set correctly (a missing/wrong Referer leaks intent or 403s)?

### Correctness
- [ ] Edge cases: private profiles, empty `posts[]`, missing `videoUrl`, empty `sidecarItems`?
- [ ] Mixed casing honored: `user_name` (medias) vs `userName` (profile/paginate)?
- [ ] CSRF token URL-decoded before use? Session bootstrapped before the first POST?
- [ ] Base64 padded to a multiple of 4 before decode?
- [ ] Malformed/HTML-escaped JSON, unexpected status codes (419/500/403)?

### Media / Expiry (the fragile part)
- [ ] Fetch-then-download-now: are signed URLs used immediately, never persisted?
- [ ] Stale URL → `403 Bad URL hash` surfaced as a typed error, not swallowed?
- [ ] Images vs videos routed to the correct host (cdn.storynavigation.com vs stories-cdn.fun)?

### Performance
- [ ] Unnecessary sequential awaits that could be parallel?
- [ ] Missing timeouts on fetch calls?
- [ ] Large media downloads without size checks?

### Error Handling
- [ ] API errors surface useful info (status, endpoint, body)?
- [ ] CSRF (419) distinguished from server errors (500) and expired URLs (403)?
- [ ] Known-broken endpoints (`paginate-medias`, `get-post-by-short-code`) fail with a clear typed error, not a silent hang?
- [ ] Retry logic handles transient failures without hammering the site?

## Output Format

```markdown
# Code Review: {branch/file}

## Summary
- Changes: {N} files, +{N} -{N} lines
- Findings: {N} Critical, {N} High, {N} Medium, {N} Low

## Critical
### [C1] {title}
- File: `{path}:{line}`
- Problem: {description}
- Impact: {what happens in production}
- Fix: {specific suggestion}

## High
### [H1] {title}
...

## Verified OK
- ✅ {check}: {why it's fine}

## Verdict
- {ship it / fix Critical first / needs rework}
```

## Principles
- No flattery — find problems, not compliments
- Every finding must have Impact + Fix
- Items verified as OK should be listed (proves you checked)
- Structural issues > style issues (ignore naming, focus on logic)
