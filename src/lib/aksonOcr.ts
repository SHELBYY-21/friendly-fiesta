/** AksonOCR Thai OCR — https://aksonocr.com/blog/thai-ocr-api-guide */
const DEFAULT_BASE = 'https://api.aksonocr.com';
const DEFAULT_MODEL = 'aksonocr-1.0';

export function aksonOcrKey(): string | null {
  const k =
    process.env.AKSONOCR_API_KEY ||
    process.env.thai_ocr ||
    process.env.thaiocr;
  const s = k?.trim();
  if (!s || /YOUR_API_KEY|placeholder/i.test(s)) return null;
  return s;
}

function baseUrl(): string {
  return (process.env.AKSONOCR_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
}

function model(): string {
  return process.env.AKSONOCR_MODEL?.trim() || DEFAULT_MODEL;
}

async function toUploadBlob(imageSrc: string): Promise<{ blob: Blob; filename: string } | null> {
  try {
    if (imageSrc.startsWith('data:')) {
      const m = /^data:([^;]+);base64,(.+)$/i.exec(imageSrc);
      if (!m) return null;
      const mime = m[1] || 'image/jpeg';
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length || buf.length > 8_000_000) return null;
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      return { blob: new Blob([new Uint8Array(buf)], { type: mime }), filename: `slip.${ext}` };
    }
    const res = await fetch(imageSrc, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 8_000_000) return null;
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0] || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    return { blob: new Blob([new Uint8Array(buf)], { type: mime }), filename: `slip.${ext}` };
  } catch {
    return null;
  }
}

/** Returns markdown/text from AksonOCR, or null if unavailable. */
export async function extractTextWithAkson(imageSrc: string): Promise<string | null> {
  const key = aksonOcrKey();
  if (!key || !imageSrc) return null;
  const upload = await toUploadBlob(imageSrc);
  if (!upload) return null;
  try {
    const form = new FormData();
    form.append('file', upload.blob, upload.filename);
    form.append('model', model());
    const res = await fetch(`${baseUrl()}/v2/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn('AksonOCR error:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const json: any = await res.json();
    const pages = Array.isArray(json?.pages) ? json.pages : [];
    const text = pages
      .map((p: any) => (typeof p?.markdown === 'string' ? p.markdown : typeof p?.text === 'string' ? p.text : ''))
      .filter(Boolean)
      .join('\n\n')
      .trim();
    return text.length >= 8 ? text : null;
  } catch (e) {
    console.warn('AksonOCR failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
