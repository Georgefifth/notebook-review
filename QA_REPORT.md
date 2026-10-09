# Firefox acceptance report — 2026-10-09

## Scope and method

Acceptance requires completing tasks in a real headless Firefox 157 browser through Playwright. HTML presence alone is insufficient. Public target: https://georgefifth.github.io/notebook-review/. Local acceptance uses port 4187; live cloud acceptance uses port 4188. Synthetic Notebooks and two existing, independent Supabase Auth accounts are used. No real analysis data is uploaded. Account deletion remains cancelled.

The checklist below was established before execution. `test/qa/acceptance.spec.mjs` clicks controls, opens file choosers, types, submits, downloads and parses feedback, refreshes, navigates back and asserts resulting task state. It collects page exceptions, console errors, failed requests and HTTP errors. `scripts/live-e2e.mjs` checks browser behavior plus real database state and permissions. Screenshot files are excluded from Git; CI retains browser evidence as an artifact.

## Acceptance checklist

| Scenario | Evidence / required outcome |
| --- | --- |
| First visit and email form | Purpose visible; skip link works; invalid/blank email makes no Auth request; Escape closes dialog and restores focus |
| Complete local review | Feedback saved; cell switching protects draft; pending/all filters work; resolution, revision and confirmation change business state; later revision requires review again; exported JSON contains the actual feedback; reopening after refresh restores saved comments |
| Invalid and empty uploads | Invalid JSON, v3, duplicate IDs and >5 MB preserve current review; valid empty Notebook exports an empty comment list; example remains usable |
| Whitespace feedback | Visible corrective message, input focus, no stored empty comment; valid retry succeeds |
| Responsive workflows | Real feedback, revision, line diff and return navigation at 320, 390, 768 and 1440 px; no page horizontal overflow |
| Keyboard-only review | Tab/Enter reach example and Discuss; input focused; typed feedback submitted with keyboard and saved |
| Auth failure | Deliberate 429 displays recoverable message; submit reenabled; local draft retained and postable |
| Slow configuration | Controlled delayed response; sign-in disabled while connecting, enabled when ready; dialog then opens without a false configuration error |
| Unsafe content | Notebook scripts, HTML output and feedback remain inert; no external image request; saved feedback stays readable |
| Navigation and Changes filter | Cancelled draft discard and home navigation preserve text; home/back/example recovers saved feedback; two changed original cells and one added cell remain distinct |
| Real two-user cloud workflow | Owner shares; anonymous/uninvited cannot read; invited reviewer posts; owner receives feedback without refresh; revision and acknowledgement synchronize; reviewer cannot change Notebook; revoked reads/writes denied; reload/list refresh/logout work |
| Cloud failure recovery | Injected 503, network abort and 401; explicit feedback, retained drafts and enabled retry; real retry persists; same-account recovery restores draft; different-account regression prevents disclosure |
| Real email OTP onboarding | **Blocked:** no controlled inbox/received code supplied; seeded/password-grant sessions and controlled verify fixtures do not establish email delivery |
| Native browser offline simulation | **Blocked/inconclusive:** Firefox `setOffline(true)` did not reliably stop the request in this environment; successful request-abort recovery is reported separately |

## Findings and fixes

| ID / severity | Reproduction and before | Implemented acceptance condition |
| --- | --- | --- |
| QA-01 / P1 | Open online review, type a draft, inject expired-session 401, sign in again: selected cell and draft were cleared | Restore in-memory draft only for the original user/project/cell; same-user text restored, another account receives empty input; explicit logout/discard clears recovery state |
| QA-02 / P2 | First visit with config response delayed, click sign-in immediately: false “not configured” message and no dialog | Disable sign-in until initialization settles; delayed-config browser scenario completes sign-in dialog opening |
| QA-03 / P2 | Select a cell, enter spaces, post: no result and no corrective message | “Write feedback before posting.” with input focus; no empty record; valid retry saves |
| QA-04 / P2 | Successful verification, later session expiry, reopen sign-in with same email: stale Verify step/code persisted | Reset OTP step, code and feedback after successful verification and explicit dialog close; repeated login regression passes |
| QA-05 / P2 | Reopen invitation dialog while membership request runs: old Remove access controls briefly remained; live removal assertion failed | Clear members before displaying/loading dialog; show loading feedback; fresh controls successfully revoke access in the unchanged live test |
| QA-06 / P2 | Sign in with a long email at 390 px: account header widened the page | Account controls wrap; email can break within the available width; actual authenticated mobile cloud check asserts no horizontal overflow |

The initial general acceptance run was 15 Pass / 5 Fail across 20 executions. Two failures were whitespace validation; one was premature sign-in; two were an incorrect keyboard test that tabbed away from the already focused input. The keyboard test now asserts the intended automatic focus, then types and submits using keys. Subsequent cloud tests found QA-01, QA-04 and QA-05. These are actual reproduced defects, not conclusions from code inspection alone.

Other harness corrections preserve business assertions: service-error messages intentionally do not expose raw backend text; the 503 check now expects visible “not saved” feedback plus intact text and successful real retry. The Changes test separately counts original and added cells. No business assertion was deleted or relaxed to mask a product failure.

An additional preventive fix from code review keeps an unavailable-review error visible after a successful sign-in closes its dialog. A Firefox controlled Auth/REST test verifies visible owner-contact guidance and continued local example use; this was not reproduced through a real email inbox.

## Visual and UX review

Inspected actual Firefox screenshots of welcome, desktop revision/diff, 320 px discussion/revision, validation, service failure and session recovery. Main task hierarchy, original/revised labels, saved-output labels and error feedback are readable. No overlap or page horizontal overflow was observed in these fixtures. Screenshots do not prove arbitrary Notebook layouts or WCAG conformance.

The first-use example explains the purpose without requiring developer documentation. Feedback takes three task actions after opening a Notebook: Discuss, enter text, Post. Revision comparison takes Compare revision, choose file, then Confirm for previously resolved feedback. These counts describe this scripted workflow, not measured human efficiency or competitor advantage. The fixes restore task success and remove erroneous recovery steps; they do not add features or reduce normal posting steps.

Remaining UX observations: the 320 px stacked revision is long; desktop discussion with multiple comments has its own scroll area; full-page images can show only part of this scroll area. Basic keyboard focus/skip-link/modal tests pass, but no screen-reader or formal contrast audit was performed. Consider making long-review navigation/form position easier after testing with actual reviewers. No user satisfaction or real-user task-success percentage is claimed.

## Console and limitations

Uncaught page exceptions must be zero. General acceptance fails any unexpected console/network/HTTP error. Auth 429, cloud 503/401 and one aborted comment request are explicit controlled failures and remain recorded. Firefox emitted known Supabase/Cloudflare `__cf_bm` invalid-domain cookie messages; they are retained in cloud evidence rather than hidden. They did not prevent the asserted real Realtime and REST tasks. The network-abort scenario also emitted the expected CORS/network diagnostic. Unexpected cloud diagnostics still fail the test.

No new administrator credential is needed for this QA. Real email delivery/verification is required before claiming complete new-user cloud acceptance. Draft recovery is in memory within the tab, not a durable draft backup after closing/reloading it. Beforeunload protects an unsent draft; saved local feedback survives reopening the same snapshot. Full-fidelity HTML/widgets/equations, 10,000-cell browser rendering, physical-device testing and real-user research are outside demonstrated coverage. Stale-version denial is covered by real PostgreSQL tests, not a timed simultaneous-edit browser race.

## Reproduction

- `npm test`: domain and PostgreSQL policies.
- `npm run test:browser`: existing Chromium regressions; `REVIEW_BROWSER=firefox npm run test:browser`: same mocked-service regressions in Firefox.
- `npm run test:qa`: headless Firefox against public and local versions. Configure the public Supabase URL/key through environment variables; no credentials are embedded.
- `REVIEW_BROWSER=firefox REVIEW_QA=1 npm run test:live`: two existing test-account credentials from environment; uses real services plus explicitly labeled recovery fault injection. `REVIEW_LIVE_URL` selects local/public target; `REVIEW_EVIDENCE_PREFIX` distinguishes screenshot filenames. QA rejects admin account creation/deletion.
- Pages CI verifies local Firefox before deployment and public Firefox after deployment. Live account tests remain an explicit local invocation, not a CI secret or mocked claim.

Final deployment and execution totals are recorded below after release verification.
