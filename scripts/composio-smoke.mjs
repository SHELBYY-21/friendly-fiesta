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
const composio = new Composio();
const session = await composio.create(userId, {
  toolkits: ['github'],
  manageConnections: true,
});

const search = await session.search({ query: 'github zen quote', toolkits: ['github'] });
const slug =
  search?.results?.[0]?.primaryToolSlugs?.[0] || 'GITHUB_GET_THE_ZEN_OF_GITHUB';

const out = { sessionId: session.sessionId, userId, tool: slug };

try {
  const result = await session.execute(slug, {});
  out.ok = true;
  out.preview = JSON.stringify(result).slice(0, 1000);
  out.logId = result?.logId || result?.log_id || result?.request_id || search?.session?.id || null;
} catch (err) {
  out.ok = false;
  out.error = err instanceof Error ? err.message.slice(0, 400) : String(err).slice(0, 400);
  const req = await session.authorize('github');
  out.connectUrl = req.redirectUrl || req.redirect_url || req.url || null;
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 2);
