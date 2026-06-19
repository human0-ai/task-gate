# Task Gate

A merge gate that holds an agent's PR until someone else has signed off on the
**task** behind it.

The [code reviewer](https://github.com/human0-ai/code-review) reads the diff. It
can't see the platform — the task's success criteria, the company's knowledge,
or why the agent thought this work was worth doing. That informed second look is
the review you actually trust, and it shouldn't land *after* the merge. This gate
puts it *in front of* the merge.

It's a CI check, nothing more. It stays red until an **independent** Human0 agent —
one that isn't the work's author — has reviewed the task and approved it. Make it
a required check and GitHub blocks the merge the same way a failing test does. No
new merge button, no platform magic, fails safe.

This is the gate that makes hands-off shipping trustworthy. An agent opens a PR.
The reviewer checks the code. The gate checks that the work was independently
approved. Only then does it merge. It's the same setup that builds and ships
[human0](https://human0.ai) itself.

## How it works

On every pull request the action:

1. **Checks the author.** Not the Human0 app? It passes — human PRs are out of
   scope.
2. **Finds the task link.** An app PR must carry a `Task: <url>/tasks/<id>` line
   in its description. Missing → the gate fails.
3. **Asks the platform.** It calls the Human0 dashboard with the task id and this
   PR's URL, which answers `approved` or `blocked`. No secret — the endpoint
   returns only a boolean for a task and PR that already reference each other.
4. **Sets the check.** `approved` → green; `blocked` → red, with the reason in the
   Checks tab.

The platform turns the check green the moment the task reaches full independent
approval, so the PR merges on its own once review lands.

## Set it up

No secrets, no configuration. Add the workflow at
`.github/workflows/task-gate.yml`:

```yaml
name: Task Gate

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, edited, reopened]

permissions:
  contents: read
  pull-requests: read

jobs:
  # Job id is the status-check name — keep it `task-gate` so the required check
  # you set below matches.
  task-gate:
    if: ${{ !github.event.pull_request.draft }}
    runs-on: ubuntu-latest
    timeout-minutes: 5
    concurrency:
      group: task-gate-${{ github.event.pull_request.number }}
      cancel-in-progress: true
    steps:
      - uses: human0-ai/task-gate@v1
        with:
          pr_number: ${{ github.event.pull_request.number }}
          repo: ${{ github.repository }}
          github_token: ${{ github.token }}
```

Then mark `task-gate` a **required status check** on the default branch in branch
protection — without "required", a red check doesn't block the merge.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `pr_number` | yes | Pull request number. Use `${{ github.event.pull_request.number }}`. |
| `repo` | yes | Repository in `owner/name` form. Use `${{ github.repository }}`. |
| `github_token` | yes | Token used to read the PR. Use `${{ github.token }}`. |

The dashboard URL and the gated app login are baked into the action — there's
nothing repo-specific to configure.

## Why a separate action

The gate is a different concern from code review — a merge *precondition*, not a
diff critique — with its own pass/fail semantics, so bundling it into
[`code-review`](https://github.com/human0-ai/code-review) would couple two checks
that should pass or fail independently. As its own action it's versioned and
pinned (`@v1`) once, then reused verbatim across every repo.

## Contributing

A small Node action — `run.mjs` plus pure helpers in `gate.mjs` (tested in
`gate.test.mjs`, no dependencies). Run `npm run lint && npm test`; CI runs both on
every PR. Releases are driven by `package.json`: bump the `version` in a PR, and
merging it tags and releases that version and re-points the floating `@v1` tag.

## License

Apache 2.0 — see [LICENSE](./LICENSE).
