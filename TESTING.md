# Verification record

Date: 2026-10-09. Local Node 26.7.0; the GitHub workflow targets Node 22.

## Automated coverage

- 10 core/configuration cases: snapshot normalization, stable IDs, conservative legacy matching, invalid formats, multiline output and public-key restrictions.
- 2 diff cases: repeated/empty/replaced lines reconstruct the original texts; large diffs use bounded work.
- 15 PostgreSQL scenarios using PGlite with actual RLS and triggers: owner/reviewer/stranger/anonymous permissions, revocation, author identity, immutable baseline and anchors, optimistic updates, revision acknowledgement and additive migration.
- 9 Chromium workflows: local feedback/export/drafts, hostile markup, mocked two-user handoff and acknowledgement, mobile layout, invalid imports, safe Markdown/URLs/images, search and mobile return, example differences, concurrent token refresh and sign-out races.
- Auth/REST browser tests use mocks. No real email is sent. Neither database tests nor mocked API tests establish live Supabase functionality.

## Previously recorded measurements

- Built output was tested under the `/notebook-review/` subpath through open → comment → resolve → revise → confirm → diff → mobile return, with no page or HTTP errors. The automated task took approximately 1,264 ms locally; this is not human task time.
- Desktop and 390px screenshots were inspected. Mobile discussion follows the selected cell without horizontal overflow. Screenshots are excluded from Git.
- Nine alternating benchmark runs measured median cell matching: 3,000 cells 40.83 → 8.70 ms; 10,000 cells 138.27 → 28.46 ms. Raw data: `evidence/benchmark.json`; reproduce with `node scripts/benchmark.mjs` and full Git history. These exclude DOM rendering, network and human interaction.
- The actual public Pages URL passed Chromium checks for example feedback, resolution, revision acknowledgement, diff and mobile return with zero page/site HTTP errors. Approximately 3,436 ms was automated task duration, not a user-time or competitor comparison.
- The first workflow including deployment and public browser verification passed: [run 37900279912](https://github.com/Georgefifth/notebook-review/actions/runs/37900279912). It tested local-demo mode, not backend login.

## Publication controls

Before publishing, the product directory was checked for secret patterns. Examples contain synthetic data and tests use example.org identities. This standalone Git repository contains product source, public research and synthetic fixtures. Environment files, dependencies, build artifacts and screenshots are excluded.

## English release acceptance

Interface labels, accessibility text, validation/service errors, example narratives and saved output are English. Browser selectors and the public smoke flow use English labels. The smoke check verifies `html[lang=en]` and a 390px viewport without overflow. Imported user Notebook content and user-authored comments are never translated.

The English demo has a new snapshot fingerprint because bundled example text changed. Existing feedback remains under its original snapshot key; imported user snapshots are unchanged. The historical benchmark reflects the earlier implementation, not a new localization measurement.

## Unverified and remaining limits

- Supabase/SMTP are not configured. Real email delivery, cross-device invited reviews and live revocation require the checks in DEPLOYMENT.md.
- No real-user completion-time, task-success, retention, payment or competitive-advantage evidence.
- Markdown is a safe subset. Full Notebook fidelity and end-to-end rendering of 10,000 cells are not established.
- Competitor public-browser attempts were limited by network conditions. Their authenticated workflows and performance were not measured.
