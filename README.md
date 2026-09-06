# PatchPilot (local MVP scaffold)

PatchPilot watches the third-party APIs your code calls (Stripe, Plaid, App
Store Connect, Twilio, ...) and, when a vendor silently changes a field
without a version bump, doesn't just alert you — it opens a pull request
with the code patch, updated tests, and a plain-English explanation of what
broke.

This repo is a **local, network-free scaffold** that proves the one thing
that differentiates PatchPilot from changelog-watcher tools: given a
before/after API response, it can detect the exact breaking field(s), find
the integration code that assumes the old shape, and produce a real code
patch + updated test + explanation — packaged as a local git branch/commit
(a stand-in for "opens a PR"). See [plan.md](./plan.md) for the full scope
and what's deliberately left out (GitHub App, webhooks, live polling,
billing, real PRs, AST codemods, etc.).

## How it works

1. `fixtures/vendor/` holds a "baseline" schema PatchPilot remembers for a
   vendor endpoint, and a "live" schema simulating what the vendor just
   started returning.
2. `fixtures/demo-repo/` is a tiny stand-in for a customer's codebase: a
   `src/billing.js` that reads fields off a Stripe-shaped subscription
   object, and a test that asserts the current (pre-change) behavior.
3. Running the CLI diffs baseline vs. live, explains the change in plain
   English, finds every line in `billing.js` that touches a changed field,
   generates a patched source + test file, commits them on a new branch
   inside a disposable copy of `demo-repo`, writes a unified diff to disk,
   and finally runs the patched repo's own test suite to prove the patch
   is actually correct — not just plausible-looking text.

## Requirements

- Node.js >= 20 (uses only built-in `node:test`, `node:assert`, `node:fs`,
  `node:child_process` — no npm dependencies).
- `git` on your `PATH`.

## Run it

```sh
# Unit tests for the detection/patch/explain logic itself
npm test

# Demo 1: a real breaking change (field rename + type change)
node bin/patchpilot.js run --vendor stripe

# Demo 2: an unchanged/additive-only schema (should detect nothing, no branch)
node bin/patchpilot.js run --vendor stripe-clean
```

The `stripe` scenario simulates Stripe renaming `plan_id` -> `price_id` and
changing `quantity` from a number to a string, plus an unrelated additive
`livemode` field (correctly ignored as non-breaking). Expect to see:

- A plain-English breakdown of what changed and why it's breaking.
- The exact lines in `fixtures/demo-repo/src/billing.js` that reference the
  changed fields.
- A generated unified diff patching both `src/billing.js` and
  `test/billing.test.js`.
- A new git branch (`patchpilot/stripe-subscription-fix`) and commit created
  inside `fixtures/demo-repo-patched/stripe/` (gitignored scratch output —
  the original `fixtures/demo-repo/` is never modified).
- A final `node --test` run against the patched repo, which passes.

The `stripe-clean` scenario re-runs the same pipeline against an unchanged
baseline/live pair and exits cleanly with "No breaking changes detected",
creating no branch or commit — proving the detector doesn't fire false
positives.

## Layout

```
bin/patchpilot.js      CLI entry point
src/diffSchema.js       structural diff between baseline & live JSON
src/scanUsages.js       finds integration-code lines touching changed fields
src/generatePatch.js    produces patched source/test content + unified diff
src/explainChange.js    turns the diff into a plain-English explanation
src/applyAsBranch.js    git: branch, commit, write the .patch file
fixtures/vendor/        baseline + live API response fixtures per vendor
fixtures/demo-repo/     the "customer's codebase" being patched
test/                   unit tests for src/*.js
```
