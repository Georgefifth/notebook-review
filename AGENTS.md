# Notebook Review MVP

## Goal
Help an analyst and a non-Git collaborator review a notebook together without moving analysis into a new execution platform. Optimize feedback-location time and review quality, not feature count.

## Authorization and boundaries
- User selected this product and online collaboration, requested the new project under `~/Hack/UnivaBio`, then explicitly authorized competitive improvements, GitHub repository creation/publication after sensitive-content checks, and GitHub Pages deployment.
- Do not inspect, import, scan or reuse any pre-existing local project. Only read files created for this project in this session. Public web sources only for research.
- Work in the new isolated `notebook-review-mvp-20261009` directory. Never overwrite neighboring existing projects.
- Do not create paid resources, email collaborators or upload real research data as part of implementation. Adding an invitation records an allowed email; the user sends the link.

## Architecture
- `public/core.mjs`: normalized notebook SHA-256 snapshots and conservative cell correspondence.
- `public/app.mjs`: DOM UI, uploads, comments, revision acknowledgement, navigation and exported feedback.
- `public/render.mjs`: safe DOM Markdown subset and bounded line diffs.
- `public/service.mjs`: Supabase Auth/REST requests, per-tab sessions, refresh and errors.
- `database/schema.sql`: PostgreSQL RLS plus guards for immutable snapshots and verified comment anchors.
- `config.mjs` and generated `dist/config.json`: expose only public Supabase URL and publishable/anon key; `api/config.js` remains a Vercel option. Never expose service-role/secret credentials.
- `dev-server.mjs`: local preview; `build.mjs`: static deployment at root or repository subpath; `.github/workflows/pages.yml`: tested Pages release; `vercel.json`: optional Vercel deployment.
- Use the official @supabase/realtime-js client, bundled locally with esbuild. No AI service, notebook kernel or Git integration. Realtime invalidates comments/revisions; REST/RLS reads remain authoritative, with 30-second backup reconciliation.
- The user authorized cloud collaboration on kdgigrfuksaedyureaxe and migration execution through a connected Supabase management tool. Do not execute against another project or assume an unconnected integration is available. Publishable configuration comes from environment/repository variables only.
- Supabase Auth stores user identities in auth.users. Projects/comments reference those IDs; invited emails are the collaboration allowlist.
- Versioned migrations are in supabase/migrations. Apply baseline only to a new database; upgrade existing data with the additive Realtime migration. Never reset a live database.

## Integrity and security
- Do not execute notebook code or render notebook HTML/SVG as active markup; no remote media.
- Never alter the original notebook. Baseline and ownership are immutable in the database.
- Cell IDs are the primary correspondence mechanism. Without IDs, match only unique, identical source and type. Ambiguous cells stay unlinked.
- Changed source/output requires rechecking even for previously closed feedback. Resolution is a human action, not proof of scientific correctness. Explicit acknowledgement is bound to the current revision, and later changed revisions require another check.
- Enforce invitations and authorship in the database, not only by hiding buttons. Keep security-definer functions narrowly scoped with an empty search path and explicit privileges.
- Updates use a version predicate; stale writes return an explicit conflict. Do not automatically overwrite.
- Do not silently discard a comment draft or attribute local demo feedback to a logged-in reviewer.

## Quality and testing
- `npm test`: domain/configuration and actual PostgreSQL RLS tests using PGlite.
- `npm run test:live`: explicit live two-user test, requires configured services and dedicated test accounts or a locally supplied admin key. Never expose admin credentials in browser configuration or CI logs. It uses synthetic data and cleans up only its own records. It validates password-grant authentication; real email OTP delivery needs separate verification.
- `npm run test:browser`: Playwright tasks, injection checks, desktop/mobile layout. Auth/REST browser fixtures are mocked; clearly distinguish these from live Supabase tests.
- Check owner/reviewer/stranger/anonymous permissions, invitation revocation, spoofed authors, changed anchors, immutable baseline, duplicate legacy cells, output changes and stale versions.
- Keep errors visible and preserve active data on malformed imports. Support keyboard and narrow layouts. Keep invitation URLs and assets relative to the application base path. Token refresh must be deduplicated; logout must invalidate late project loads.
- Do not claim live email delivery, deployed backend, clinical benefit, authenticated online testing or measured UX gains without evidence.

## Product validation
Five teams with an actual non-Git reviewer. Compare against HTML/PDF plus shared comments and Deepnote. Continue only if feedback-location time falls at least 30% and at least three teams voluntarily use it for their next review. These are proposed targets, not achieved findings.
