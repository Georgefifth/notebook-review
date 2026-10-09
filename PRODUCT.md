# Product specification: Notebook Review

## User and job
An analyst works in Jupyter. A domain specialist reviews narrative, code and existing results without Python or Git. Both need comments attached to the exact reviewed content and an explicit way to see whether a later version affects them.

## Confirmed decisions
The user chose online collaboration and permitted choosing a host. Use email one-time-password sign-in, GitHub Pages hosting, and an optional Supabase Auth/PostgreSQL backend. Reviewers need only their email account; the deployer needs hosting and database accounts. Project invitations are email allowlists; the application does not automatically email invitations.

## Core workflow
1. Import the base `.ipynb`. Preview locally before any upload.
2. Sign in with an email verification code. Choose "Share online" to upload the exact base snapshot and create a project.
3. Add collaborator email addresses and copy the project link. The owner shares it through an existing channel.
4. Reviewer signs in with their invited email, reads the snapshot and posts cell comments. Comments synchronize every 8 seconds, or on refresh.
5. Owner uploads a revised notebook. Compare source and output changes, positions, removals and added cells. Reviewers use "Refresh review" to fetch the revision.
6. Owner or original commenter closes/reopens feedback after checking it. Previously closed comments on changed/unlinked content still show a recheck warning.
7. Export JSON feedback as an independent record. The export is not a backup of all membership/auth/project revision data.

## MVP boundaries
One immutable base plus one replaceable comparison version per project. Comments belong to base cells. New content is reviewed by starting another project. No simultaneous notebook editing, kernel execution, automatic fixes, AI review, Git integration, comment replies or clinical claims.

Notebook v4, max 5 MB / 10,000 cells. Accept string/list source. Preview common safe Markdown and simple tables; code/raw source, saved text/error outputs and PNG/JPEG. Full Markdown/LaTeX fidelity, attachments, HTML tables, SVG and widgets are outside this MVP and must show an appropriate fallback.

## Acceptance criteria
- Local imports do not upload until explicit sharing.
- OTP login, a project list and invited-email project links work once Supabase is configured. Sessions are scoped to a browser tab.
- Anonymous/nonmembers cannot read private rows; reviewer cannot invite others or replace the baseline/revision. Revocation stops future DB access; downloaded/cached data cannot be recalled.
- Authenticated identity supplies comment author ID/email. Comments cannot be reanchored or attributed to another user. Owner cannot rewrite a reviewer's text.
- Baseline and owner immutable; normal updates use optimistic version checks.
- Malformed files preserve the active review and show readable errors. User markup and comments never execute script.
- Stable IDs survive moves. Legacy matching requires unique identical source/type, does not consume IDs reserved for other cells, and leaves ambiguity unlinked.
- Source/output changes remain visible even when execution counters are ignored.
- Local demo state is explicitly labeled, distinct from online persistence. Local comments are not automatically uploaded under a different authenticated identity.
- Drafts survive background synchronization; switching cells with a draft asks the user to send/clear it first.

## Architecture
A static dependency-free browser application calls Supabase Auth/REST directly with a public key and user JWT. RLS and SQL triggers enforce access and anchoring. Notebook records are private JSONB rows; no public storage bucket. GitHub Pages serves static assets and a generated public-only config.json; Vercel is an alternative host. CSP restricts scripts and media; the default deployment supports hosted `*.supabase.co` URLs.

## Validation
Run domain and PostgreSQL RLS tests. Browser task tests use mocked Auth/REST and do not establish live email/database functionality. A live smoke test is required after applying schema and configuring Supabase + SMTP.

Then compare real tasks from five teams against existing tools. Proposed continuation threshold: at least 30% less feedback-location time, no additional misanchored feedback, and three teams returning for their next task. No market/UX success is currently established.

## Public references
- https://nbformat.readthedocs.io/en/latest/format_description.html
- https://blog.jupyter.org/posts/2026/what-you-told-us-results-from-the-2026-jupyter-user/
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/auth-smtp
- https://vercel.com/docs/functions/runtimes/node-js

## Revision acknowledgement and navigation (2026-10-09)

Changed revisions reopen the need to check closed feedback. The author or review owner may explicitly confirm that the current revision was checked. Online acknowledgements bind to project revision version; local acknowledgements bind to the normalized revision fingerprint. Another changed revision asks for another check. This is not a scientific approval. Existing deployments apply database/migrate-v2.sql without replacing tables.

Search covers source, saved output and comments (including matched revision content). Pending feedback has a direct index and next-item control. The return-to-cell control preserves drafts. Markdown supports common safe formatting and simple tables; inline HTML, scripts, external images, LaTeX and interactive output are not executed/rendered. Source changes have an optional bounded line diff, preserving the full side-by-side preview.

Unconfigured deployments hide unavailable login/share actions and state the local-demo limitation. A synthetic revision is one click; real revisions still require upload.
