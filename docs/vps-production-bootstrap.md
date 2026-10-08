# VPS production deployment — controlled bootstrap

Canonical production source: `SHELBYY-21/friendly-fiesta`. VPS hosting provider, allocated server, public hostname, and SSH access **have not been verified**. Do not deploy to a guessed VPS, or repoint another working CE VAULT service.

## Status

`Deploy production VPS` is a **manual GitHub Actions workflow_dispatch**. Ordinary `main` pushes only run CI, not a production deploy. This prevents repeated failed or accidental deployments before the server is provisioned. The workflow rejects missing secrets and invalid host/destination values.

## Preconditions (verified outside the repository)

1. Provision an authorized Linux VPS with Docker Engine, Docker Compose plugin, SSH and rsync. Confirm access and cost/ownership before provisioning.
2. Identify a dedicated deployment directory such as `/srv/ce-vault/friendly-fiesta`. **Do not use `/`, `/home`, or an existing unrelated application's directory.** Set the directory owner to the dedicated deploy user.
3. Put a private, permission-restricted `.env.production` in that directory. Use `chmod 600 .env.production`; never commit it. Ensure the domain's DNS points to the VPS and TLS is ready through Caddy.
4. Independently verify the VPS SSH **host public key fingerprint** against the hosting provider's trusted console, then store the full matching `known_hosts` line. `ssh-keyscan` output alone must not be trusted; it can be useful for collecting a candidate line **only after independent fingerprint verification**.
5. Add five GitHub **Environment secrets** under `Settings → Environments → production`:

   - `VPS_HOST`: real DNS name or IP (no protocol or port).
   - `VPS_USER`: dedicated SSH deploy user.
   - `VPS_DEPLOY_PATH`: restricted dedicated absolute directory.
   - `VPS_SSH_KEY`: separate, authorized SSH private key for that deploy user, preferably not reused from any other service.
   - `VPS_SSH_KNOWN_HOSTS`: independently fingerprint-verified full `known_hosts` line for `VPS_HOST`.

Do not put these values in Issues, PRs, chats, logs or Git tracked files.

## Deploy sequence

1. Confirm `Node CI` on `main` is green (typecheck, unit tests, production build).
2. Open **Actions → Deploy production VPS → Run workflow**. Use default inputs:
   - `run_migrations=false`
   - `register_webhook=false`
3. The workflow checks all five secrets, validates host/user/directory, checks that a real `.env.production` already exists **before any upload**, uses strict pinned SSH host verification, and copies reviewed source **without remote deletion**.
4. Docker Compose starts app and Caddy, then the workflow checks the HTTPS `/api/health` endpoint. A failed check stops the workflow; investigate privately on the VPS, not by printing full customer logs into Actions.
5. Only after an independently reviewed database backup and SQL review, dispatch with `run_migrations=true` and the exact `sha256sum supabase/patch-v17-sandbox-workflow.sql` in `migration_sha256`. It refuses mismatched checksums. **Running a migration is a real production database write; do not trigger it merely to clear the CI status.**
6. `register_webhook=true` is separate and should be enabled only after confirming the correct canonical Telegram bot and webhook destination. Never re-register blindly.

## Langfuse

GitHub Environment variables `LANGFUSE_BASE_URL` and `LANGFUSE_PUBLIC_KEY` are not automatically installed on the VPS. Add only a **newly rotated** `LANGFUSE_SECRET_KEY` via GitHub secret settings (previously pasted keys are considered exposed) and supply the runtime secrets through the VPS's private environment. Keep `LANGFUSE_TELEMETRY_ENABLED=0` until a synthetic-only, PII-free end-to-end test is confirmed.

## Cleanup and recovery

- This workflow excludes `.env*`, `.git`, `.next`, and `node_modules` from rsync and never uses `rsync --delete`. The production script does not run `docker compose --remove-orphans`. As a trade-off, unused application files may remain on the server: clean them only after a verified inventory.
- The deployment script does not output Docker application logs into GitHub Actions.
- Roll back using a reviewed previous commit. Retain a recent database backup for any explicitly approved migration. To disable optional Langfuse, set `LANGFUSE_TELEMETRY_ENABLED=0` on the server and restart the app.
- The workflow is intentionally manual. Only consider automatic main-branch deployment after at least one validated live deployment, stable health checks, known-host pinning, complete secrets, backup/rollback verification, and production environment protection are confirmed.
