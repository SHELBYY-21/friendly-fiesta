const path = require('path');

/** @type {import('next').NextConfig} */
const { imageHosts } = (() => {
  try { return require('./image-hosts.config.js'); } catch { return { imageHosts: [] }; }
})();

function validateRequiredEnv() {
  const isPlaceholder = (val) =>
    !val || val.trim() === '' || /^(your[-_]|replace|change|example|placeholder|<.+>|\.\.\.)/i.test(val.trim());

  const PUBLIC_REQUIRED = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const publicMissing = PUBLIC_REQUIRED.filter((k) => isPlaceholder(process.env[k]));

  if (publicMissing.length > 0) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-anon-key';
    }
  }
}

validateRequiredEnv();

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins: ['127.0.0.1', 'localhost', '0.0.0.0'],
  images: imageHosts.length ? { remotePatterns: imageHosts } : undefined,
};

module.exports = nextConfig;
