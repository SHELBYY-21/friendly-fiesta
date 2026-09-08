export type TelegramUpdateKind = 'message' | 'callback' | 'webapp' | 'ignored';

export type ParsedTelegramUpdate = {
  updateId: number;
  kind: TelegramUpdateKind;
  chatId: number | null;
  userId: number | null;
  text: string | null;
  caption: string | null;
  photoFileId: string | null;
  livePhoto: boolean;
  callbackId: string | null;
  callbackData: string | null;
  webAppData: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n !== 0 ? n : null;
}

export function largestPhoto(photo: unknown): { fileId: string; fileUniqueId: string } | null {
  if (!Array.isArray(photo) || photo.length === 0) return null;
  const ranked = photo
    .map((item, index) => ({ rec: asRecord(item), index }))
    .filter((row): row is { rec: Record<string, unknown>; index: number } => Boolean(row.rec?.file_id))
    .sort((a, b) => {
      const da = Number(a.rec.width ?? 0) * Number(a.rec.height ?? 0);
      const db = Number(b.rec.width ?? 0) * Number(b.rec.height ?? 0);
      if (db !== da) return db - da;
      return b.index - a.index;
    });
  const rec = ranked[0]?.rec;
  const id = rec?.file_id;
  if (typeof id !== 'string' || !id) return null;
  return { fileId: id, fileUniqueId: String(rec.file_unique_id ?? id) };
}

export function largestPhotoFileId(photo: unknown): string | null {
  return largestPhoto(photo)?.fileId ?? null;
}

export function parseTelegramUpdate(body: unknown): ParsedTelegramUpdate | null {
  const root = asRecord(body);
  if (!root) return null;
  const updateId = Number(root.update_id);
  if (!Number.isSafeInteger(updateId) || updateId < 0) return null;

  const callback = asRecord(root.callback_query);
  if (callback) {
    const msg = asRecord(callback.message);
    const chat = asRecord(msg?.chat);
    const from = asRecord(callback.from);
    return {
      updateId,
      kind: 'callback',
      chatId: asId(chat?.id),
      userId: asId(from?.id),
      text: null,
      caption: null,
      photoFileId: null,
      livePhoto: false,
      callbackId: typeof callback.id === 'string' ? callback.id : null,
      callbackData: typeof callback.data === 'string' ? callback.data : null,
      webAppData: null,
    };
  }

  const msg = asRecord(root.message);
  if (!msg) {
    return {
      updateId,
      kind: 'ignored',
      chatId: null,
      userId: null,
      text: null,
      caption: null,
      photoFileId: null,
      livePhoto: false,
      callbackId: null,
      callbackData: null,
      webAppData: null,
    };
  }

  const chat = asRecord(msg.chat);
  const from = asRecord(msg.from);
  const text = typeof msg.text === 'string' ? msg.text.trim() : null;
  const caption = typeof msg.caption === 'string' ? msg.caption.trim() : null;
  const webApp = asRecord(msg.web_app_data);
  const webAppData = typeof webApp?.data === 'string' ? webApp.data : null;
  return {
    updateId,
    kind: webAppData ? 'webapp' : 'message',
    chatId: asId(chat?.id),
    userId: asId(from?.id),
    text: text || null,
    caption: caption || null,
    photoFileId: largestPhotoFileId(msg.photo),
    livePhoto: Boolean(msg.live_photo) || Boolean(msg.video),
    callbackId: null,
    callbackData: null,
    webAppData,
  };
}
