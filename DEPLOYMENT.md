# GitHub Pages frontend with optional Supabase backend

[Repository](https://github.com/Georgefifth/notebook-review) · [Public demo](https://georgefifth.github.io/notebook-review/)

GitHub Pages hosts static HTML/CSS/JavaScript. It cannot run `api/config.js`, Notebook kernels or a database. [Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). Without Supabase, import, comments, comparisons and exports stay in this browser; the interface labels this local-demo mode. A configured frontend calls external Supabase Auth and REST services directly.

## Default Pages deployment

Select GitHub Actions in the repository Pages settings. `.github/workflows/pages.yml` runs core, database and browser tests with Node 22, builds `dist`, deploys it, and tests the actual public URL. Source changes on main trigger deployment; documentation-only changes do not. Relative asset paths support repository subpaths. Only `dist` is published; SQL and tests are excluded.

Without repository variables, `config.json` contains `{"configured":false}`. Do not commit environment files or secrets. Examples and test identities are synthetic.

## Enable online collaboration

1. For a new Supabase project, apply every file in `supabase/migrations/` in filename order. Five migrations create the baseline, enable Realtime, move helper functions into a private schema, improve RLS/indexes, and fix owner INSERT RETURNING. Local filenames match the actual cloud migration history.
2. For an existing installation, skip already-applied migrations and apply only missing upgrades. Do not recreate tables or reset the database. The upgrades retain Notebook, comment and membership data.
3. Obtain the Project URL and publishable key (or legacy public anon JWT). The frontend needs no service_role key, database password or SMTP password.
4. In GitHub Settings → Secrets and variables → Actions → Variables, add:

```text
SUPABASE_URL=https://kdgigrfuksaedyureaxe.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The legacy public key can use `SUPABASE_ANON_KEY` instead. These are public browser settings. The build rejects incomplete settings and secret keys. No variables are needed for local-demo mode.

5. Include `{{ .Token }}` in the Supabase Auth Magic Link email template for email-code login. Configure your own SMTP; the built-in test mail service restricts recipients and frequency. Set Auth Site URL to the deployed URL. If enabling CAPTCHA, implement the corresponding frontend interaction first.
6. Run the Pages workflow manually. The build generates public configuration and a CSP meta tag allowing the configured HTTPS and WSS connections. Pages cannot set application-specific HTTP response headers; meta cannot set header-only directives such as frame-ancestors.

[Email OTP documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless) · [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)

## Required live acceptance tests — not yet completed

- Owner receives a real email code, signs in, imports synthetic data, shares it and invites a second email.
- Reviewer signs in with that address and posts a comment; owner receives it through Realtime without manual refresh. Both screens show Live updates.
- Owner uploads a revision; reviewer receives it automatically, checks changes and confirms the revision reviewed. Another changed revision requires another check.
- An uninvited third email cannot access the review. Revoking an invitation rejects subsequent reads and writes.
- Database migrations, public deployment variables and real two-user Auth/REST/RLS/Realtime acceptance were completed on 2026-10-09. Email OTP inbox delivery remains unverified. Mock tests alone do not establish live functionality.

## Vercel alternative and local development

For Vercel, select Other framework, build command `node build.mjs`, output `dist`, and the same public variables. `api/config.js` remains available, but the frontend reads static `config.json`; changes require rebuilding. For self-hosted Supabase, also update `vercel.json` connect-src. Check deployment access protection before sharing.

Locally run `npm ci` and `npm start`. To configure a local backend, use `node --env-file=.env dev-server.mjs`; `.env` is ignored by Git. The preview listens on 127.0.0.1 only.

Run `npm run build`, then `node scripts/smoke.mjs https://georgefifth.github.io/notebook-review/` for public frontend verification. The smoke script uses the synthetic example even when Supabase is configured; it does not authenticate or exercise the backend. Use the live acceptance checklist above to verify online collaboration.

## Explicit live two-user test

`npm run test:live` opens two isolated browser contexts against the real public site. It verifies real Auth sessions, invitation-only REST access, comments and revisions without refresh, draft preservation, acknowledgements and revoked-access denial. It removes its own synthetic test project afterwards.

Provide the public configuration above, plus `REVIEW_OWNER_EMAIL`, `REVIEW_OWNER_PASSWORD`, `REVIEW_REVIEWER_EMAIL`, and `REVIEW_REVIEWER_PASSWORD` for two dedicated, confirmed test accounts. Alternatively, a locally supplied `SUPABASE_TEST_ADMIN_KEY` creates two temporary confirmed test accounts and deletes them afterwards. Admin credentials must never enter frontend config, Git, shared output or Pages variables. Do not disable email confirmation for production users to run this test.

The script uses real password grants to initialize test sessions. It does **not** prove email OTP delivery. Separately verify Send code → inbox receipt → Verify and sign in with two real inboxes. Configure SMTP and the `{{ .Token }}` email template first. A publishable key alone cannot apply database migrations or administer test users.

Realtime subscriptions include INSERT/UPDATE only and select small identifier/version payloads. Events trigger authorized REST reads; the application does not use event rows as permission evidence. Backup reconciliation detects deleted projects and revoked access within 30 seconds while the tab is visible. Database reads/writes are denied immediately on revocation; already downloaded data cannot be recalled.

## Current cloud status — 2026-10-09

The five migrations have been applied to `kdgigrfuksaedyureaxe`. GitHub Actions variables provide the Project URL and publishable key; neither is hardcoded in application source. Auth owns user identities; private projects, comments and invited-email relations use PostgreSQL with RLS. Anonymous users have no table access, and internal functions live in non-exposed `review_private`.

Two real, temporary confirmed Auth accounts in separate browser contexts passed the public-site collaboration flow. Those synthetic accounts were provisioned through authorized database administration; password grants established real sessions without sending email. The test project, comments and invitations were removed. The separate request to delete the two test accounts was cancelled at the platform confirmation, so the accounts remain. No pre-existing account existed before these tests. They can be inspected under Authentication → Users; their metadata purpose is `notebook-review-e2e`.

Email auth is enabled and email confirmation remains required. A request to the reserved synthetic address was rejected as `email_address_invalid`; this does not establish whether SMTP is correctly configured. Verify SMTP, the Magic Link template containing `{{ .Token }}`, and actual inbox receipt before promising email-code onboarding. Configure Site URL as `https://georgefifth.github.io/notebook-review/`. No service-role key is required by the deployed frontend.

Security advisors found no remaining exposed business-table/function issues after hardening. They additionally reported disabled leaked-password protection ([setting documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); the production UI uses email codes. Performance advisors prompted indexes and cached Auth expressions. Fresh unused-index notices are not evidence that the indexes should be removed.
