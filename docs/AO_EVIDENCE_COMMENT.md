# AO Evidence Comment Helper

`scripts/ao-evidence-comment.mjs` is a low-intrusion prototype for posting visual validation evidence to GitHub PRs.

It does not change AO core. It uses Playwright to open the GitHub PR page with a persistent browser profile, uploads screenshots through GitHub's normal comment attachment UI, and submits a Markdown comment. This lets an AO worker validate a PR locally, capture screenshots, and leave reviewable evidence on the PR without spending GitHub Actions minutes.

## Setup

If Chromium is not installed for Playwright yet:

```bash
pnpm --filter @aoagents/ao-web screenshot:install
```

Log in once with a GitHub bot account:

```bash
pnpm evidence:comment login
```

The default browser profile is stored outside the repo:

```text
~/.agent-orchestrator/github-browser-profile
```

Use a bot account, not a personal primary account. The profile contains browser login state.

## Post Evidence

```bash
pnpm evidence:comment comment \
  --pr https://github.com/org/repo/pull/123 \
  --body-file .ao/evidence/pr-123/result.md \
  --image .ao/evidence/pr-123/home.png \
  --image .ao/evidence/pr-123/settings.png
```

To test the browser upload without submitting:

```bash
pnpm evidence:comment comment \
  --pr https://github.com/org/repo/pull/123 \
  --body-file .ao/evidence/pr-123/result.md \
  --image .ao/evidence/pr-123/home.png \
  --no-submit
```

When only a PR number is provided, pass the repository too:

```bash
pnpm evidence:comment comment --repo org/repo --pr 123 --body "Validation passed."
```

## Suggested Worker Rule

Add this to a project `WORKFLOW.md` or to `agentRulesFile`:

```md
## AO Visual Handoff

After opening a PR, do not stop at code completion.

Before `ao report ready-for-review`:

1. Start the app locally from this worktree.
2. Use browser automation to verify the changed user flow.
3. Capture screenshots for every changed visible state.
4. Check browser console and failed network requests.
5. If validation fails, fix the code and repeat.
6. Write `.ao/evidence/pr-<number>/result.md`.
7. Post or update a PR comment titled `AO Validation Evidence` with screenshots.
8. Only then run `ao report ready-for-review`.
```

## Limits

- This uses GitHub's web UI, not the REST comment API. GitHub's official comment API accepts Markdown text only; image upload happens through the web attachment flow.
- It depends on GitHub UI selectors, so it is a prototype helper. If GitHub changes the comment form, the selector fallback list may need updates.
- It currently posts a new comment. A later version should update an existing sticky `AO Validation Evidence` comment.
- Concurrent workers using the same browser profile can conflict. Run one evidence comment upload at a time per bot profile.
