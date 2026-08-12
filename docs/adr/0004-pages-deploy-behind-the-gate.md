# 0004 — GitHub Pages deploys by calling the CI workflow, not beside it

- **Status** — accepted
- **Date** — 2026-08-12

## Context

Issue 8 requires the app to deploy to GitHub Pages on push to `main`, *after
the validation gate passes*. The gate is four commands (`build`, `lint`,
`typecheck`, `test`) already defined as the `validate` job in `ci.yml`, which
ran on both pull requests and pushes to `main`.

Three arrangements were available, and the choice is hard to reverse once
branch protection and the Pages environment are pointed at particular job
names.

The product sells a mathematical guarantee, so "published from a commit that
had not passed the tests" is not a cosmetic failure mode: the deployed page is
the artefact users cut card from.

## Decision

`deploy.yml` triggers on push to `main` and calls `ci.yml` as a reusable
workflow (`jobs.gate.uses: ./.github/workflows/ci.yml`). The build and deploy
jobs declare `needs:` on it, so nothing is published unless the gate passed on
that exact commit.

`ci.yml` loses its `push: branches: [main]` trigger and gains `workflow_call:`.
Pull requests still run it directly and unchanged.

The site is rebuilt in `deploy.yml` rather than carried out of the gate as an
artifact, and `pages: write` / `id-token: write` are scoped to the deploy job
alone.

Pages is configured with `build_type: workflow` — no `gh-pages` branch exists
and none should be created.

## Consequences

- One definition of the gate. A change to the four commands changes what guards
  `main` and what guards a PR at the same time, because they are the same file.
- On `main` the gate runs once, not twice.
- The gate's job appears as `Deploy / Gate / validate` on `main` and as
  `CI / validate` on a pull request. Any branch-protection required check must
  name the pull-request form, which is the one that matters for protection.
- `dist/` is built twice per push to `main` — once inside the gate, once for the
  upload. That is roughly ten seconds against the alternative of every pull
  request uploading a deployment candidate.
- A deployment can only be triggered by a push to `main` or a manual
  `workflow_dispatch`. There is no path that publishes from a branch.

## Alternatives considered

- **`workflow_run` on CI completion.** The standard chaining trigger, and
  rejected: `workflow_run` fires for *any* conclusion and must re-check
  `github.event.workflow_run.conclusion == 'success'` by hand, it deploys the
  default branch's workflow definition rather than the commit's, and the
  deployment appears detached from the run that authorised it.
- **Duplicating the four commands in `deploy.yml`.** Simplest to read, and the
  copy would drift. The one rule that matters in this repo is that the gate is
  not relaxed; two copies of it is a way to relax one of them by accident.
- **Uploading the Pages artifact from `ci.yml`.** Would save the second build,
  at the cost of every pull request producing a deployment candidate and of
  `ci.yml` needing Pages permissions it otherwise never uses.
- **Deploying from a `gh-pages` branch.** Rejected: it puts build output in
  version control and makes the deployed commit a different commit from the one
  the gate passed on.
