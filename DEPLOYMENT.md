# Deployment: Vercel + Supabase

## 1. Create a NEW Supabase project

Use a project dedicated to this MVP. Run `database/schema.sql` once in its SQL Editor. It creates private review projects, email membership and comments with RLS. Do not apply this migration to an unrelated existing database.

Copy the Project URL and a **publishable key** (or the legacy public anon JWT). The frontend does not need a service-role key, database password or SMTP secret. Do not configure these as public keys.

## 2. Configure email login

In Authentication → Email Templates, set the Magic Link template to include `{{ .Token }}` so the user receives an email verification code. The app calls the OTP and verify endpoints with `type: email`.

Configure a custom SMTP provider for use by arbitrary reviewers. Supabase's built-in sender is for testing and has recipient/rate restrictions; a deployed UI alone does not establish working public email login. Set the Auth Site URL to the deployed URL. If you use stronger rate limits/CAPTCHA, adapt the UI before public launch.

References:
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp

## 3. Configure Vercel

Deploy this isolated directory using Vercel "Other" framework, build command `node build.mjs`, output directory `dist`. `api/config.js` is a Vercel function and returns only public configuration.

Environment variables:

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Legacy public keys can use `SUPABASE_ANON_KEY` instead. The config endpoint rejects secret/service-role keys and does not return them. Add variables for the intended Preview/Production environments, then redeploy. Do not upload `.env` files.

The default CSP permits the hosted Supabase domain. If using a custom/self-hosted domain, deliberately update `connect-src` in `vercel.json` to that exact HTTPS origin.

`vercel deploy` creates a preview; check Vercel's deployment protection settings before sharing with reviewers. Publish production only after configuring and passing the live smoke test.

## 4. Live smoke test (still required unless recorded in TESTING.md)

1. Owner signs in with an actual emailed code.
2. Owner imports only the synthetic example, explicitly shares it, and adds a second email.
3. Second user follows the link, signs in, adds a comment; owner receives it.
4. Owner uploads `public/examples/revision.ipynb`; reviewer refreshes and sees source/output changes.
5. A third, noninvited email cannot retrieve the project/comments.
6. Revoke the second user's membership and confirm new requests are denied.

Use only synthetic data during setup. Do not call the online MVP operational until the live checks pass.

## Local configured preview

Set the same public environment variables for `node dev-server.mjs`. Node 22 also supports `node --env-file=.env dev-server.mjs` if you create a local `.env`. This repo excludes that file from Git/deployment.
