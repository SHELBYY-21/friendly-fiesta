/** Hostname suitable for absolute og:image URLs. */
export function publicAppHost(hostHeader?: string | null): string {
  const host = String(hostHeader ?? '')
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase();
  if (!host || !/^[a-z0-9.-]+$/.test(host) || !host.includes('.')) return '';
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return '';
  return host;
}

export function resolvePublicHost(hostHeader?: string | null): string {
  const fromEnv = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '');
  return publicAppHost(fromEnv) || publicAppHost(hostHeader);
}
