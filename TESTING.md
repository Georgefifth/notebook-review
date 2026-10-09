# Verification record — 2026-10-09

## Completed

- 10 domain/config tests passed: source/output normalization, execution-count exclusion, stable-ID moves, deleted/new IDs, ambiguous legacy cells, reserved-ID safety and public-key filtering.
- 12 PostgreSQL permission/integrity scenarios passed (13 Node test entries including their parent suite). The actual migration executes in an isolated PGlite PostgreSQL instance, with Supabase-like auth.uid()/auth.jwt() helpers and authenticated/anon roles.
- 5 Chromium browser tests passed: local comment/export/revision round trip; draft preservation; hostile markup and unsupported HTML output; independent owner/reviewer browser sessions with mocked Auth/REST; 390px layout without horizontal overflow; invalid import preserving the active review.
- Static Vercel frontend build passed.
- Desktop/mobile screenshots visually inspected.

Test environment: Node 26.7.0, Playwright Chromium. Deployment targets Node 22 (the application uses supported Node 22 APIs); a cloud build and live smoke test remain required.

## Not established

- A live Supabase project has not been created/configured. Actual email delivery, SMTP, Supabase Auth behavior and live database API integration have not been tested.
- No production deployment or real user research has been performed.
- Browser tests use explicit Auth/REST fixtures, not a fake claim of live collaboration.
- PostgreSQL RLS tests verify DB policy logic, not full hosted Supabase configuration.
- User-facing latency, usability improvements, willingness to pay and next-task reuse are unvalidated.

## Reproduce

```
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

See DEPLOYMENT.md for the live smoke test required after configuring Supabase.
