# GitHub Pages frontend with optional Supabase backend

[Repository](https://github.com/Georgefifth/notebook-review) · [Public demo](https://georgefifth.github.io/notebook-review/)

GitHub Pages hosts static HTML/CSS/JavaScript. It cannot run `api/config.js`, Notebook kernels or a database. [Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). Without Supabase, import, comments, comparisons and exports stay in this browser; the interface labels this local-demo mode. A configured frontend calls external Supabase Auth and REST services directly.

## Default Pages deployment

Select GitHub Actions in the repository Pages settings. `.github/workflows/pages.yml` runs core, database and browser tests with Node 22, builds `dist`, deploys it, and tests the actual public URL. Source changes on main trigger deployment; documentation-only changes do not. Relative asset paths support repository subpaths. Only `dist` is published; SQL and tests are excluded.

Without repository variables, `config.json` contains `{"configured":false}`. Do not commit environment files or secrets. Examples and test identities are synthetic.

## Enable online collaboration

1. Create a dedicated Supabase project and execute `database/schema.sql` in its SQL Editor.
2. For a database already using the previous schema, apply only `database/migrate-v2.sql`. This additive migration preserves comments and adds revision acknowledgement. Do not recreate tables.
3. Obtain the Project URL and publishable key (or legacy public anon JWT). The frontend needs no service_role key, database password or SMTP password.
4. In GitHub Settings → Secrets and variables → Actions → Variables, add:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The legacy public key can use `SUPABASE_ANON_KEY` instead. These are public browser settings. The build rejects incomplete settings and secret keys. No variables are needed for local-demo mode.

5. Include `{{ .Token }}` in the Supabase Auth Magic Link email template for email-code login. Configure your own SMTP; the built-in test mail service restricts recipients and frequency. Set Auth Site URL to the deployed URL. If enabling CAPTCHA, implement the corresponding frontend interaction first.
6. Run the Pages workflow manually. The build generates public configuration and a CSP meta tag allowing the configured HTTPS connection. Pages cannot set application-specific HTTP response headers; meta cannot set header-only directives such as frame-ancestors.

[Email OTP documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless) · [SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)

## Required live acceptance tests — not yet completed

- Owner receives a real email code, signs in, imports synthetic data, shares it and invites a second email.
- Reviewer signs in with that address and posts a comment; owner receives it.
- Owner uploads a revision; reviewer refreshes, checks changes and confirms the revision reviewed. Another changed revision requires another check.
- An uninvited third email cannot access the review. Revoking an invitation rejects subsequent reads and writes.
- No Supabase project has been configured. Mock Auth/REST tests cannot substitute for these checks.

## Vercel alternative and local development

For Vercel, select Other framework, build command `node build.mjs`, output `dist`, and the same public variables. `api/config.js` remains available, but the frontend reads static `config.json`; changes require rebuilding. For self-hosted Supabase, also update `vercel.json` connect-src. Check deployment access protection before sharing.

Locally run `npm ci` and `npm start`. To configure a local backend, use `node --env-file=.env dev-server.mjs`; `.env` is ignored by Git. The preview listens on 127.0.0.1 only.

Run `npm run build`, then `node scripts/smoke.mjs https://georgefifth.github.io/notebook-review/` for public frontend verification. The smoke script uses the synthetic example even when Supabase is configured; it does not authenticate or exercise the backend. Use the live acceptance checklist above to verify online collaboration.
