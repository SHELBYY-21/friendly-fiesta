import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Composio } from '@composio/core';

for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 1) continue;
  const k = t.slice(0, i);
  const v = t.slice(i + 1);
  if (!process.env[k]) process.env[k] = v;
}

if (!process.env.COMPOSIO_API_KEY) {
  console.error('COMPOSIO_API_KEY missing from .env.local');
  process.exit(1);
}

const userId = process.env.COMPOSIO_TEST_USER_ID || 'ce-vault-desk';
const mint = process.argv.includes('--connect');
const composio = new Composio();

const list = await composio.connectedAccounts.list({
  userIds: [userId],
  toolkitSlugs: ['github'],
});
const items = list?.items || [];

function slim(a) {
  return {
    id: a.id,
    status: a.status,
    toolkit: a.toolkit?.slug || a.appName || 'github',
    createdAt: a.createdAt || a.created_at,
    updatedAt: a.updatedAt || a.updated_at,
  };
}

const expired = items.filter((a) => String(a.status).toUpperCase() === 'EXPIRED');
const pending = items.filter((a) => String(a.status).toUpperCase() === 'INITIALIZING');
const active = items.filter((a) => String(a.status).toUpperCase() === 'ACTIVE');

for (const a of expired) {
  try {
    await composio.connectedAccounts.delete(a.id);
  } catch {
    /* keep going */
  }
}

const after = ((await composio.connectedAccounts.list({
  userIds: [userId],
  toolkitSlugs: ['github'],
})).items || []).map(slim);

const diagnosis = [];
if (active.length) diagnosis.push('token live — execute GitHub tools');
else if (pending.length) {
  diagnosis.push('OAuth started, GitHub never posted the code back (INITIALIZING). Complete the existing Connect Link. Do not mint another.');
} else {
  diagnosis.push('no GitHub token. Code exchange never ran. Connect links expire ~10m if the consent screen is not finished.');
}

const out = {
  userId,
  flow: [
    '1 SDK (ak_ project key) → session',
    '2 authorize/github → Connect Link (authorization code)',
    '3 user consents on github.com → redirect to connect.composio.dev',
    '4 Composio exchanges code for access_token → ACTIVE',
    '5 session.execute(GITHUB_*) uses that token',
  ],
  before: items.map(slim),
  deletedExpired: expired.map((a) => a.id),
  after,
  diagnosis,
};

if (mint && !active.length && !pending.length) {
  const session = await composio.create(userId, { toolkits: ['github'], manageConnections: true });
  const req = await session.authorize('github');
  out.connectUrl = req.redirectUrl || req.redirect_url || req.url || null;
  out.connectionId = req.id || req.connectedAccountId || null;
}

console.log(JSON.stringify(out, null, 2));
