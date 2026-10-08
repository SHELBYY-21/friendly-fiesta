import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/deploy-vps.yml', 'utf8');
const deploy = fs.readFileSync('scripts/deploy-production.sh', 'utf8');

assert.match(workflow, /on:\s*\n\s+workflow_dispatch:/);
assert.doesNotMatch(workflow, /^\s+push:\s*$/m);
assert.match(workflow, /VPS_SSH_KNOWN_HOSTS/);
assert.match(workflow, /StrictHostKeyChecking=yes/);
assert.match(workflow, /ssh-keygen -F "\$VPS_HOST"/);
assert.doesNotMatch(workflow, /ssh-keyscan/);
assert.doesNotMatch(workflow, /rsync[^\n]*--delete/);
assert.match(workflow, /--exclude='\/\.env\*'/);
assert.match(workflow, /test -f '\$VPS_DEPLOY_PATH\/\.env\.production'/);
assert.match(workflow, /run_migrations:/);
assert.match(workflow, /register_webhook:/);
assert.match(workflow, /timeout-minutes: 30/);

assert.match(deploy, /run_migrations=\$\{RUN_DB_MIGRATIONS:-false\}/);
assert.match(deploy, /register_webhook=\$\{REGISTER_TELEGRAM_WEBHOOK:-false\}/);
assert.match(deploy, /if \[ "\$run_migrations" = true \]; then/);
assert.match(deploy, /actual_sha256=\$\(sha256sum/);
assert.match(deploy, /if \[ "\$actual_sha256" != "\$approved_migration_sha256" \]; then/);
assert.match(deploy, /if \[ "\$register_webhook" = true \]; then/);
assert.match(deploy, /https:\/\/\$DOMAIN\/api\/health/);
assert.doesNotMatch(deploy, /--remove-orphans/);
assert.doesNotMatch(deploy, /docker compose logs/);

console.log('vps-deploy-safety ok');
