/** @type {import('next').NextConfig} */
const { imageHosts } = (() => {
  try { return require('./image-hosts.config.js'); } catch { return { imageHosts: [] }; }
})();

// ============================================================
// Build-time environment validation
// - Public (NEXT_PUBLIC_*) vars: hard-fail at build if missing
// - Server-only vars: warn at build, hard-fail at runtime
//   (server-only vars are not always injected during CI build)
// ============================================================
function validateRequiredEnv() {
  const isPlaceholder = (val) =>
    !val || val.trim() === '' || /^(your[-_]|replace|change|example|placeholder|<.+>|\.\.\.)/i.test(val.trim());

  // Public vars MUST be present at build time (Next.js inlines them)
  const PUBLIC_REQUIRED = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  // Server-only vars — warn at build, validated at runtime in API routes
  const SERVER_REQUIRED = [
    ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY'],
    'ANTHROPIC_API_KEY',
  ];

  const publicMissing = PUBLIC_REQUIRED.filter((k) => isPlaceholder(process.env[k]));
  const serverMissing = [];
  for (const entry of SERVER_REQUIRED) {
    if (Array.isArray(entry)) {
      if (!entry.some((k) => !isPlaceholder(process.env[k]))) serverMissing.push(entry[0]);
    } else {
      if (isPlaceholder(process.env[entry])) serverMissing.push(entry);
    }
  }

  if (publicMissing.length > 0) {
    const lines = publicMissing.map((k) => `  ✗ ${k}`).join('\n');
    throw new Error(
      `\n\n🚨  Missing public environment variables (required at build time):\n${lines}\n\n` +
      `  Set these in your .env file before building.\n`
    );
  }

  if (serverMissing.length > 0) {
    const lines = serverMissing.map((k) => `  ⚠ ${k}`).join('\n');
    console.warn(
      `\x1b[33m\n⚠️  Server-only env vars not found at build time (OK if set in production ENV):\n${lines}\n` +
      `  These will be validated at runtime. Set them in your deployment ENV settings.\x1b[0m\n`
    );
  } else {
    console.log(`\x1b[32m✅  ENV validation passed (all required keys present)\x1b[0m`);
  }
}

validateRequiredEnv();

const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
  allowedDevOrigins: ['friendlyf4587.builtwithrocket.new'],
  webpack(config, { dev }) {
    if (dev) {
      config.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: [/node_modules/],
        use: [{
          loader: '@dhiwise/component-tagger/nextLoader',
        }],
      });
    }
    return config;
  }
};

module.exports = nextConfig;
