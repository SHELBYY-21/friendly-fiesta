/** Bot API 10 live_photo still sits on photo[]; never OCR the motion clip. */
import jpeg from 'jpeg-js';
import type { StillFrame } from './cardImage';
import { largestPhoto } from '../telegram/update';

export type { StillFrame };

export function stillFromTelegram(msg: any): { fileId: string; fileUniqueId: string } | null {
  return largestPhoto(msg?.live_photo?.photo ?? msg?.photo);
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
