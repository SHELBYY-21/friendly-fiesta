import { headers } from 'next/headers';
import { resolvePublicHost } from '@/lib/og/publicHost';

export async function ShareMeta() {
  const h = await headers();
  const host = resolvePublicHost(h.get('x-forwarded-host') || h.get('host'));
  if (!host) return null;
  const ogImage = `https://${host}/og.jpg`;
  const xBanner = `https://${host}/x-banner.jpg`;
  return (
    <>
      <meta property="og:title" content="CE EMPIRE" />
      <meta property="og:description" content="Exchange · Finance · Digital Assets" />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:type" content="image/jpeg" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={ogImage} />
      <meta property="x:game:image" content={xBanner} />
      <meta property="x:game:image:width" content="1200" />
      <meta property="x:game:image:height" content="264" />
    </>
  );
}
