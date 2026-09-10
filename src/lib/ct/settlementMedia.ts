/**
 * CE VAULT — Auto Media for Settlement (stickers + brand stills)
 * Live Photos / WebM packs need Telegram file_ids in env — never invent IDs.
 */
import { sendMessage, sendPhoto, type OutgoingMessage } from '../telegram';
import { sendStickerFor } from '../stickerService';
import { heroPng } from './brandCards';
import { SettlementState } from './settlementCard';

export type MediaPlatform = 'ios' | 'android' | 'desktop' | 'web' | 'auto';

type MediaManager = {
  platform: Exclude<MediaPlatform, 'auto'>;
  setPlatform(p: MediaPlatform): void;
};

let _media: MediaManager | null = null;

function detectPlatform(): Exclude<MediaPlatform, 'auto'> {
  const env = (process.env.SETTLEMENT_MEDIA_PLATFORM || '').toLowerCase();
  if (env === 'ios' || env === 'android' || env === 'desktop' || env === 'web') return env;
  return 'android';
}

export function getMediaManager(): MediaManager {
  if (!_media) {
    _media = {
      platform: detectPlatform(),
      setPlatform(p: MediaPlatform) {
        this.platform = p === 'auto' ? detectPlatform() : p;
      },
    };
  }
  return _media;
}

export function setupMedia(platform: MediaPlatform = 'auto') {
  getMediaManager().setPlatform(platform);
}

function stickerKeyForState(state: SettlementState | string): string {
  const s = String(state).toUpperCase();
  if (s === 'READY') return 'WAITING';
  if (s === 'MATCHED' || s === 'SETTLED') return 'SUCCESS';
  if (s === 'SHORT' || s === 'EXCESS') return 'RETRY';
  return 'PROCESSING';
}

function heroKindForState(state: SettlementState | string): 'vault' | 'locked' | 'settled' {
  const s = String(state).toUpperCase();
  if (s === 'SETTLED' || s === 'MATCHED') return 'settled';
  if (s === 'READY') return 'locked';
  return 'vault';
}

export async function sendWithSticker(
  chatId: number,
  state: SettlementState | string,
  message: OutgoingMessage,
): Promise<number> {
  await sendStickerFor(chatId, stickerKeyForState(state));
  return sendMessage(chatId, message);
}

export async function sendWithBrandStill(
  chatId: number,
  state: SettlementState | string,
  message: OutgoingMessage,
): Promise<number> {
  try {
    const png = heroPng(heroKindForState(state), {
      hero: String(state).toUpperCase(),
      sub: 'CE VAULT SETTLEMENT',
      meta: 'CE',
    });
    return await sendPhoto(chatId, png, message);
  } catch {
    return sendMessage(chatId, message);
  }
}

/**
 * Smart media: optional sticker (env file_id via stickerService) then text card.
 * WebM / Live Photo: only when SETTLEMENT_WEBM_<STATE>_ID exists (not hardcoded).
 */
export async function sendSmartMedia(
  chatId: number,
  state: SettlementState | string,
  message: OutgoingMessage,
): Promise<number> {
  const envKey = `SETTLEMENT_WEBM_${String(state).toUpperCase()}_ID`;
  const webmId = process.env[envKey];
  if (webmId) {
    try {
      const { sendSticker } = await import('../telegram');
      await sendSticker(chatId, webmId);
    } catch {
      /* ignore */
    }
  } else {
    await sendStickerFor(chatId, stickerKeyForState(state));
  }
  return sendMessage(chatId, message);
}
