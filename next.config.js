/** @type {import('next').NextConfig} */
const { imageHosts } = (() => {
  try { return require('./image-hosts.config.js'); } catch { return { imageHosts: [] }; }
})();

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
