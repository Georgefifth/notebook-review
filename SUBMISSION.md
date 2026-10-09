# Notebook Review — submission draft

## Inspiration

Analysts work in Jupyter, while domain experts may review results through screenshots, exported documents or email. Those channels can separate questions from the exact cell that prompted them. Notebook Review explores a focused review workflow that keeps feedback attached to an immutable snapshot and makes later changes visible.

## What it does

Import an existing Notebook, preview saved results, leave cell-specific feedback, compare a revision, and explicitly confirm that changed content has been checked. Safe Markdown, saved text and image output, line differences, search and pending-feedback navigation help reviewers keep their place. Notebook code is never executed.

## How we built it

A static JavaScript frontend runs on GitHub Pages. Optional email-code authentication and private collaboration use Supabase Auth, PostgreSQL row-level security and Realtime. Stable cell IDs anchor comments; older Notebooks without IDs use conservative matching. Baseline fingerprints and version-bound acknowledgements protect review context.

## Working demo

[Open the demo](https://georgefifth.github.io/notebook-review/) and choose **Open example review**. Select **Discuss** on Cell 2, post a question and mark it resolved. Choose **See example changes**: the changed source and output trigger another check. Open the line differences, inspect the changes, and choose **Confirm revision reviewed**.

## Finished versus planned

The public demo supports local import, feedback, revision comparison and export. The frontend is connected to a real Supabase backend. Two independent authenticated users passed live invitation, comment, revision, acknowledgement and revocation tests on the public site. Email OTP inbox delivery remains unverified; test sessions used real password grants for temporary synthetic accounts. The example stays local until explicitly shared.

This is a review prototype, not a scientific validation system. Examples are synthetic. There is no clinical outcome evidence, proven time saving or validated market advantage. User testing with analyst–reviewer teams is the next validation step.

## Links

[Source code](https://github.com/Georgefifth/notebook-review) · [Deployment instructions](DEPLOYMENT.md) · [Test evidence](TESTING.md)

This is editable submission copy, not a submitted Devpost entry. Add the actual team details and demonstration video before submission.
