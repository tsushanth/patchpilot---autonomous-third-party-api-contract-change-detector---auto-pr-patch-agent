# PatchPilot — Local MVP Scaffold Plan

## Goal of this MVP

Prove the one differentiating claim of the product locally, with no network
dependencies and no external accounts: **when a third-party API's response
shape silently changes, PatchPilot detects the exact breaking field(s), finds
the integration code that assumes the old shape, and produces a real code
patch + updated test + plain-English explanation — packaged as a local git
branch/commit (a stand-in for "opens a PR").**

Everything else about the real product (GitHub App install, webhooks, live
polling of Stripe/Plaid/etc., billing, multi-repo/multi-tenant state) is
infrastructure around that core loop, not the core loop itself, and is scoped
out below.

## Stack choice

**Plain Node.js CLI, no TypeScript, no framework, no build step.**

- Node's built-in `node --test` for tests (no Jest/Mocha/Vitest install).
- Node's built-in `fs`, `child_process` (for git), and `assert` — no npm
  dependencies at all if avoidable. If a JSON-diff or unified-diff helper is
  wanted for readability, allow at most one tiny, zero-transitive-dep npm
  package (e.g. `diff`) — otherwise hand-roll the ~30 lines needed.
- Why not TypeScript: the demo's value is in the detection→patch→explain
  logic, not in type safety for a throwaway scaffold; skipping the compile
  step keeps `node bin/patchpilot.js` a single command.
- Why not Python/Go instead: the "integration code" being patched is
  JavaScript (realistic for a GitHub App targeting JS/TS SaaS codebases), so
  writing the patch generator in JS keeps the source-editing logic and the
  target-editing logic in one language and one mental model.
- Patches are generated via targeted string/regex transforms on the fixture
  file, not a full AST codemod (e.g. jscodeshift/ts-morph). AST tooling is the
  right call for the real product but is unnecessary weight to prove the
  concept on one deliberately small fixture file.

## Explicitly out of scope for this local demo

- No GitHub App, no GitHub API calls, no webhooks, no OAuth/auth of any kind.
- No real network calls to Stripe/Plaid/Twilio/App Store Connect. "Live" API
  responses are recorded fixture JSON files, swapped in to simulate a vendor
  change. (A real fetch could later replace the fixture-read in one place —
  the detection logic doesn't care where the JSON came from.)
- No hosting/deploy, no server, no database, no scheduler/cron/polling loop.
- No billing/accounts/multi-tenant anything.
- No actual "open a pull request" API call. Local git branch + commit +
  `.patch` file stands in for the PR artifact.
- No full AST-based codemod engine — regex/string-based patch generation on
  one small fixture repo only.
- No Slack/email notifications.
- Only one vendor scenario is built (a Stripe-shaped example: a field rename
  plus a type change), not a library of vendor-specific adapters.

## File/directory layout

```
patchpilot/
  plan.md                          # this file
  package.json                     # name, "type":"module", no/near-zero deps
  README.md                        # one-paragraph what-is-this + run command
  bin/
    patchpilot.js                  # CLI entry: `node bin/patchpilot.js run`
  src/
    diffSchema.js                  # structural diff of two JSON schemas/samples
    scanUsages.js                  # finds integration-code lines touching changed fields
    generatePatch.js               # produces the code + test edits and a unified diff
    explainChange.js               # turns the structural diff into plain English
    applyAsBranch.js               # git: create branch, write files, commit, write .patch
  fixtures/
    vendor/
      stripe.subscription.baseline.json   # schema PatchPilot "remembers"
      stripe.subscription.live.json       # simulated new vendor response (breaking change)
    demo-repo/
      src/billing.js               # tiny fake integration code using the old field names
      test/billing.test.js         # existing test, asserts old field usage
  test/
    diffSchema.test.js
    scanUsages.test.js
    generatePatch.test.js
    explainChange.test.js
```

The `demo-repo/` fixture is the "customer's codebase" stand-in: small enough
to read in full, but real enough (a billing.js file reading
`subscription.plan_id` that the "vendor" renames to `subscription.price_id`,
plus a status enum value change) to make the patch non-trivial.

## How this will be verified

1. **Unit tests** (`node --test`) covering the pure logic, independent of git:
   - `diffSchema`: given baseline vs. live fixture JSON, correctly reports
     the renamed field, the type change, and ignores unrelated additive
     fields (additive/non-breaking changes should be flagged as info, not
     as a break).
   - `scanUsages`: given `billing.js`, correctly locates every line
     referencing a changed field.
   - `generatePatch`: given the diff + usages, produces edited source and
     test content that no longer references the stale field/value.
   - `explainChange`: produces a human-readable string naming the field,
     old vs. new shape, and which vendor/endpoint it came from.

2. **Manual end-to-end run-through**, the actual demo script:
   ```
   node bin/patchpilot.js run --vendor stripe
   ```
   Expected observable behavior:
   - Prints the detected breaking change (field rename + type change) in
     plain English.
   - Creates a local git branch (e.g. `patchpilot/stripe-subscription-fix`)
     inside `fixtures/demo-repo`.
   - Commits the patched `src/billing.js` and updated
     `test/billing.test.js` on that branch.
   - Writes a `.patch` file to stdout/disk showing the unified diff, as the
     artifact that would become a PR body.
   - Running `node --test` against the patched `demo-repo` afterward passes,
     proving the generated patch is actually correct against the new schema
     (not just cosmetically plausible text).

3. **Regression check**: re-running the CLI against an unchanged
   baseline/live pair (no schema drift) exits cleanly with "no breaking
   changes detected" and creates no branch/commit — proving it doesn't
   fire false positives on non-breaking or identical schemas.
