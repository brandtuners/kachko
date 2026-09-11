# kachko — Automatic PR review agent

The reviewer checks GitHub PR changes against the HLD, LLD, and development blueprint, then creates or updates one `kachko documentation review` comment. Rohan owns backend work and Girish owns frontend work; the reviewer checks the requirements relevant to each PR's scope and development stage.

## Files

| File | Purpose |
|---|---|
| [Workflow](../.github/workflows/pr-docs-review.yml) | Runs on PR creation, new commits, reopening, edits and ready-for-review events, on any target branch |
| [Reviewer instructions](../.github/review/prompt.md) | Project rules, scope, evidence requirements and review behavior |
| [Output schema](../.github/review/schema.json) | Structured findings and verdict |
| [Comment publisher](../.github/review/publish.cjs) | Validates output, checks the current commit, and updates the bot comment |
| [Publisher tests](../.github/review/publish.test.cjs) | Tests stale reviews, failure handling, citations and deduplication |

## One-time activation — Rohan

1. Commit these files and merge them into each intended PR target branch (for example `dev` and `main`). The first installation PR needs human review: the workflow intentionally loads reviewer instructions and the publisher from the **base branch**, so they will not be available there until this setup is merged. The setup itself does not activate remote automation while it exists only locally.
2. In GitHub repository **Settings → Secrets and variables → Actions**, add the repository secret `OPENAI_API_KEY` with an API key allowed to use Codex. Enter it directly in GitHub; do not commit it. Automated runs use API billing. No separate GitHub PAT is needed: the workflow uses the job's `GITHUB_TOKEN` for PR access and comments.
3. Confirm repository/organization Actions policies allow `actions/checkout`, `actions/github-script`, and `openai/codex-action`, plus the workflow's declared read permissions and PR-comment write permissions.
4. Open or update a test PR after the workflow files exist on its base branch. Check the Actions run and the bot's summary comment. Confirm a known, scoped doc violation produces a failed gate and a follow-up fix updates the same comment.
5. Add a branch protection rule or ruleset for `dev`/`main`: require pull requests and the status check named **Documentation review gate** before merging. Select the check after it has run once. Require the branch to be up to date, and configure bypass permissions appropriately. Keep build/test checks and human review requirements separately enabled.

The workflow creates the status check; it cannot make that check mandatory merely by existing. GitHub branch rules enforce the merge restriction. Nobody is automatically approved or merged by this agent.

## Review flow

```text
PR opened / updated
  → Read base-branch project docs and reviewer instructions
  → Inspect changes at the exact PR head (read-only)
  → Produce cited findings or a scoped no-findings result
  → Validate report and recheck PR state/base/head
  → Create or update one bot comment
  → Documentation review gate passes only for a complete passing review
  → Separate CI and human review
  → Human merges when required checks pass
```

Each finding includes severity, a changed-code reference, a baseline documentation section, impact/evidence, and a correction. Explicit blueprint decisions resolve the known LLD differences. Future features and recommendations are not automatically demanded in an incremental PR. Documentation changes themselves are reviewed; they do not silently waive the base-branch requirements.

The comment records both reviewed commit and documentation baseline. A fixed PR gets a refreshed comment. A run that observes a different head/base or a closed PR refuses to publish stale feedback. Comment updates have no atomic SHA condition, so a commit arriving immediately after the last check can briefly leave an old summary; its SHA remains visible and the new run replaces it.

## Failures and coverage

- Findings fail the gate. Missing credentials, action failures, invalid reports, or incomplete review also fail it; they are never treated as successful reviews. Where posting is possible, the bot explains that review was incomplete.
- Fork PRs do not receive repository secrets and are not analyzed or commented on by this configuration. Their gate fails with a maintainer-review message. A maintainer must review them or move approved changes to a repository branch for this agent to run. Dependabot events may likewise lack secrets. Do not switch to privileged execution of fork code to work around this.
- Draft PRs run too. PR edits retrigger the review, so changing the declared scope causes a fresh check.
- This is static code/document review, not an application test runner. It reads available CI check results and reports verification limits. It does not install project dependencies, execute proposed code, run migrations, or claim browser testing.
- The model job has no PR write permission. A separate publisher receives only the structured output and uses base-branch code to post it. It updates only its marked `github-actions[bot]` comment and leaves human comments untouched.
- Model findings can be wrong. Rohan/Girish should assess the cited evidence, fix valid issues or clarify the documented contract, and rerun the review. It supplements human review and CI.

## Local verification

```sh
node --test .github/review/publish.test.cjs
```

The publisher tests use a mocked GitHub client and never post live comments. A live Actions run still requires the one-time activation above. Change `prompt.md` to adjust project review behavior; after that change is reviewed and merged, subsequent PR reviews use it.

## References

The workflow follows the [Codex GitHub Action documentation](https://developers.openai.com/codex/github-action/). GitHub explains [workflow token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) and [required status checks on protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
