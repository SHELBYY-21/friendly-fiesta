const fs = require('fs') as typeof import('fs');
const path = require('path') as typeof import('path');
const { validateProductionEnvironment: validateEnvForProduction } = require('../src/lib/runtimeEnv');

const args = process.argv.slice(2);
const exampleMode = args.includes('--example');
const fileIndex = args.indexOf('--file');
const filename = fileIndex >= 0 ? args[fileIndex + 1] : '.env.local';
const absolute = path.resolve(process.cwd(), filename || '.env.local');

if (!fs.existsSync(absolute)) {
  console.error(`ENV INVALID: file not found (${path.basename(absolute)})`);
  process.exit(1);
}

const raw = fs.readFileSync(absolute, 'utf8');
const structuralIssues: string[] = [];
if (/^(?:<{7}|={7}|>{7})/m.test(raw)) structuralIssues.push('merge-conflict-markers');

const env: Record<string, string> = {};
const seen = new Set<string>();
for (const [index, sourceLine] of raw.split(/\r?\n/).entries()) {
  const line = sourceLine.trim();
  if (!line || line.startsWith('#')) continue;
  const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) {
    structuralIssues.push(`invalid-line:${index + 1}`);
    continue;
  }
  const [, key, sourceValue] = match;
  if (seen.has(key)) structuralIssues.push(`duplicate-key:${key}`);
  seen.add(key);
  let value = sourceValue.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const templateKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'API_SECRET',
  'BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'ADMIN_TELEGRAM_IDS',
  'APP_URL',
  'DEFAULT_SELL_RATE',
  'DEFAULT_MARKET_RATE',
  'OCR_AUTO_MIN',
];
if (exampleMode) {
  for (const key of templateKeys) {
    if (!seen.has(key)) structuralIssues.push(`missing-template-key:${key}`);
  }
} else {
  for (const issue of validateEnvForProduction(env)) {
    structuralIssues.push(`${issue.key}:${issue.code}`);
  }
}

const issues = [...new Set(structuralIssues)];
if (issues.length > 0) {
  console.error('ENV INVALID');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`ENV OK (${exampleMode ? 'template' : 'production'})`);
