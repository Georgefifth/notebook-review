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
- No runtime dependencies, AI service, notebook kernel, Git integration or realtime infrastructure. Comments poll every 8 seconds; users explicitly refresh project revisions.

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
- `npm run test:browser`: Playwright tasks, injection checks, desktop/mobile layout. Auth/REST browser fixtures are mocked; clearly distinguish these from live Supabase tests.
- Check owner/reviewer/stranger/anonymous permissions, invitation revocation, spoofed authors, changed anchors, immutable baseline, duplicate legacy cells, output changes and stale versions.
- Keep errors visible and preserve active data on malformed imports. Support keyboard and narrow layouts. Keep invitation URLs and assets relative to the application base path. Token refresh must be deduplicated; logout must invalidate late project loads.
- Do not claim live email delivery, deployed backend, clinical benefit, authenticated online testing or measured UX gains without evidence.

## Product validation
Five teams with an actual non-Git reviewer. Compare against HTML/PDF plus shared comments and Deepnote. Continue only if feedback-location time falls at least 30% and at least three teams voluntarily use it for their next review. These are proposed targets, not achieved findings.
