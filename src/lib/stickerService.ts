import { sendSticker } from './telegram';
import { getSticker } from '@/config/stickers';

/** Optional WebM/animated sticker. No-ops when env file_id is missing. Never extra-spams the live card. */
export async function sendStickerFor(chatId: number, key: string): Promise<boolean> {
  try {
    const id = getSticker(key);
    if (!id) return false;
    await sendSticker(chatId, id);
    return true;
  } catch (e) {
    console.warn('sendStickerFor error', e instanceof Error ? e.message : e);
    return false;
  }
}

export default { sendStickerFor };
