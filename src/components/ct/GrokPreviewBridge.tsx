'use client';

import { useEffect } from 'react';

const CHANNEL = 'grok-preview-bridge';

export function GrokPreviewBridge() {
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.channel !== CHANNEL) return;
      if (data.type === 'hello' && event.source) {
        (event.source as Window).postMessage(
          { channel: CHANNEL, version: 1, type: 'location', path: window.location.pathname || '/', search: window.location.search, hash: window.location.hash },
          event.origin,
        );
      }
      if (data.type === 'navigate' && typeof data.path === 'string' && data.path.startsWith('/') && !data.path.startsWith('//')) {
        window.location.assign(data.path);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return null;
}
