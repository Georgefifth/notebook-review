# Verification record

Date: 2026-10-09. Local Node 26.7.0; the GitHub workflow targets Node 22.

## Automated coverage

- 10 core/configuration cases: snapshot normalization, stable IDs, conservative legacy matching, invalid formats, multiline output and public-key restrictions.
- 2 diff cases: repeated/empty/replaced lines reconstruct the original texts; large diffs use bounded work.
- 16 PostgreSQL scenarios using PGlite with actual RLS and triggers: owner/reviewer/stranger/anonymous permissions, revocation, author identity, immutable baseline and anchors, optimistic updates, revision acknowledgement and additive migrations retaining data and unrelated publication tables.
- 10 Chromium workflows: local feedback/export/drafts, hostile markup, mocked two-user handoff and acknowledgement, mobile layout, invalid imports, safe Markdown/URLs/images, search and mobile return, example differences, concurrent token refresh and sign-out races, plus actual bundled-client WebSocket handling in two isolated mocked browser contexts, automatic revisions and retained drafts.
- Auth/REST/WebSocket browser tests use mocks. No real email is sent. Neither database tests nor mocked API tests establish live Supabase functionality.

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

- Supabase is configured and live two-user collaboration/revocation passed. Actual email OTP delivery still needs inbox acceptance in DEPLOYMENT.md.
- No real-user completion-time, task-success, retention, payment or competitive-advantage evidence.
- Markdown is a safe subset. Full Notebook fidelity and end-to-end rendering of 10,000 cells are not established.
- Competitor public-browser attempts were limited by network conditions. Their authenticated workflows and performance were not measured.

## Cloud implementation verification

The official Realtime client is bundled with the static frontend. Lifecycle tests cover project-scoped subscriptions, excluding DELETE events, reconnect reconciliation and stopping during token refresh. PostgreSQL tests apply the additive migration twice, retain existing feedback/publications, deny nonmembers and verify revoked reads/writes.

The live script passed against the public GitHub Pages URL and real Supabase project on 2026-10-09 with two distinct Auth user IDs and isolated browser contexts. Passed: owner shares a Notebook; reviewer has no access before invitation; anonymous access denied; invited comments synchronize without refresh; revisions synchronize without refresh; both drafts survive; acknowledgements synchronize; reviewer cannot edit the Notebook; revoked reads/writes denied. The script recorded no page errors.

Real password grants established the sessions; this is not evidence of email OTP delivery. The synthetic accounts were seeded through authorized database administration rather than through inbox confirmation. Production email confirmation was not disabled. The synthetic-address OTP request returned email_address_invalid; no inbox delivery result is claimed.

A real INSERT RETURNING failure was fixed: a STABLE helper cannot identify the newly inserted row within the same statement. The SELECT policy now directly admits the current owner before the collaborator lookup. The PostgreSQL regression checks successful owner RETURNING and stranger denial. A second regression models Supabase default function grants and checks that anonymous helper execution and authenticated trigger-function execution are revoked.

The test project, comments and invitations were removed. Account/session cleanup was cancelled at the platform SQL confirmation; two synthetic test users remain. Do not claim full cleanup. All three public business tables have RLS, and the Realtime publication contains only projects/comments. The applied migration history matches the source filenames.
