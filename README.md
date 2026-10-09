# Notebook Review

An online notebook review MVP: import an immutable snapshot, invite by email, comment on cells, and compare a revised notebook. Keeps the existing Jupyter workflow. Does not execute notebooks.

## Run

Use Node 22 or newer. There are no runtime npm dependencies.

```bash
node dev-server.mjs
```

Open http://127.0.0.1:4173. Without Supabase configuration, the site explicitly runs as a local demo. Use the synthetic example to try comments and revision comparison; the revised example is `public/examples/revision.ipynb`.

## Enable online collaboration

See [DEPLOYMENT.md](DEPLOYMENT.md). You need a Supabase project, this schema applied to that NEW project, a working Auth email OTP template and SMTP, plus the public Supabase URL/key. Use GitHub Pages or Vercel for the frontend. Ordinary reviewers need only their invited email.

Local notebook imports stay local until choosing "共享为在线审阅". Comments on a demo remain local and are not silently uploaded as another identity. Online comments poll every eight seconds; explicitly refresh to fetch a newly uploaded revision. The user sends invitation links; the app records access permissions but does not send invitation emails.

## Tests

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

PostgreSQL policy tests execute the SQL in PGlite with Supabase-like auth helpers and roles. Browser tests mock Auth/REST; they do not verify real OTP delivery or a live Supabase deployment.

## Limits

- Notebook v4, up to 5 MB and 10,000 cells. Complex outputs may use a text fallback or unsupported-output notice.
- Base snapshots never change; start a new project for a new review round. No notebook editing, AI review or code execution.
- Anonymous legacy cells are matched only by unique, unchanged source. Edited/duplicate legacy cells remain uncertain.
- Exported feedback JSON is a review record, not a full database backup or import format.
- A previously downloaded or cached snapshot cannot be revoked; invitation removal protects future requests.
- No real research or patient data was used to build the examples or run the tests.

See PRODUCT.md for acceptance criteria and proposed user-validation targets.

## Public demo and current status

[GitHub Pages demo](https://georgefifth.github.io/notebook-review/) · [Repository](https://github.com/Georgefifth/notebook-review)

The public site currently runs in local-demo mode. Supabase and SMTP have not been configured; it does not sync feedback between browsers. Read DEPLOYMENT.md to enable the existing online workflow.

Recent improvements: safe common Markdown and tables, optional line diff, feedback/content search, pending-feedback navigation, mobile return to context, explicit revision acknowledgement, indexed comparison, deduplicated Auth refresh and Pages subpath support. No notebook execution or AI service.

Research and limitations: COMPETITIVE_RESEARCH.md. Priorities, acceptance and before/after evidence: IMPROVEMENTS.md. Verification: TESTING.md. Existing Supabase deployments need database/migrate-v2.sql; new projects use schema.sql.
