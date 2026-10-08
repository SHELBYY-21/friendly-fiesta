# CE VAULT CI incident runbook

Updated: 2026-10-08. Owner: CI repair agent. Scope: GitHub Actions for `SHELBYY-21/friendly-fiesta`.

## What to inspect
1. Start at [Actions](https://github.com/SHELBYY-21/friendly-fiesta/actions) and select the latest failed workflow for each distinct branch + SHA.
2. Read the *first failing step* and job logs. Determine whether the current branch head still contains that failure. Ignore superseded runs after verification.
3. Categorize: `SOURCE_OR_TEST`, `NODE_OR_DEPENDENCY`, `RUNNER_TRANSIENT`, `SECRETS_OR_PERMISSIONS`, `EXTERNAL_INFRA`.
4. Deduplicate by `repo + branch + head SHA + workflow + failure signature`.
5. Code or toolchain failure: minimal branch, clear PR, then observe checks on the PR SHA.
6. Production secret failure: only report *missing variable names*; fix in GitHub repository / production environment Settings through an authorized operator.
7. Report `FIXED` only after post-change test evidence; otherwise `PATCH_PREPARED`, `BLOCKED` or `STILL_FAILING`.

## Baseline incident
| Workflow / run | Confirmed evidence | Response |
| --- | --- | --- |
| Node CI [37712996295](https://github.com/SHELBYY-21/friendly-fiesta/actions/runs/37712996295) | npm ci and typecheck passed; npm test failed on Node.js 20 with missing native WebSocket, while several dependencies require >=22 | Change CI runtime to Node.js 24 and validate on PR |
| Deploy production VPS [37712996275](https://github.com/SHELBYY-21/friendly-fiesta/actions/runs/37712996275) | npm test, typecheck and build passed on Node.js 24; SSH configuration failed at non-empty secret check, exit 1 | Add name-only diagnostics; production operator must confirm secret availability |

## Non-negotiable controls
- Do not disable tests, security gates or deployment health checks.
- Do not reveal GitHub Actions secrets or make production secrets available to pull requests.
- Do not run payments, migrations, production deploys or Telegram webhook writes from a troubleshooting agent.
- Do not merge changes without green CI and separate production approval.
- Do not attempt to repair repositories that are not accessible to the connected account.
- Avoid blind retries; a retry is appropriate only for evidence-backed transient failure.

## Validation
- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build` when build behavior changes
- Review the pull request's actual new workflow run and exact commit SHA.

## Rollback
Revert the isolated fix PR commit if the new runtime introduces regressions. Production configuration should be changed by the credential owner only after confirming the intended host, user, and known host fingerprint.
