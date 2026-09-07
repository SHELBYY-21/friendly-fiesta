/** Bot API 10 live_photo still sits on photo[]; never OCR the motion clip. */
import jpeg from 'jpeg-js';
import type { StillFrame } from './cardImage';

export type { StillFrame };

export function stillFromTelegram(msg: any): { fileId: string; fileUniqueId: string } | null {
  const sizes = msg?.live_photo?.photo ?? msg?.photo;
  if (!Array.isArray(sizes) || !sizes.length) return null;
  const last = sizes[sizes.length - 1];
  if (!last?.file_id) return null;
  return {
    fileId: String(last.file_id),
    fileUniqueId: String(last.file_unique_id ?? last.file_id),
  };
}

export function isLivePhoto(msg: any): boolean {
  return Boolean(msg?.live_photo);
}

/** Decode the still JPEG so the scan overlay can paint the actual slip. */
export function decodeStillFrame(buf: Buffer): StillFrame | null {
  if (!buf?.length) return null;
  try {
    const raw = jpeg.decode(buf, { maxMemoryUsageInMB: 48, maxResolutionInMP: 6, useTArray: true } as any);
    if (!raw?.data || !raw.width || !raw.height) return null;
    return { data: raw.data, width: raw.width, height: raw.height };
  } catch {
    return null;
  }
}
