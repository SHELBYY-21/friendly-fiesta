/** Sticker file_ids from env only. Never hardcode. Missing IDs are skipped. */
export const STICKER_IDS = {
  WELCOME: process.env.STICKER_WELCOME_ID,
  PROCESSING: process.env.STICKER_PROCESSING_ID,
  OCR_DONE: process.env.STICKER_OCR_DONE_ID,
  WAITING: process.env.STICKER_WAITING_ID,
  SUCCESS: process.env.STICKER_SUCCESS_ID,
  ERROR: process.env.STICKER_ERROR_ID,
  RETRY: process.env.STICKER_RETRY_ID,
  THANK_YOU: process.env.STICKER_THANKYOU_ID,
  VIP: process.env.STICKER_VIP_ID,
  QUEUE: process.env.STICKER_QUEUE_ID,
} as const;

export type StickerState = keyof typeof STICKER_IDS;

const FLOW_MAP: Record<string, StickerState> = {
  welcome: 'WELCOME',
  loading: 'PROCESSING',
  receiving: 'PROCESSING',
  ocr: 'OCR_DONE',
  verified: 'SUCCESS',
  waiting: 'WAITING',
  queue: 'QUEUE',
  completed: 'SUCCESS',
  error: 'ERROR',
  warning: 'RETRY',
  cancelled: 'RETRY',
};

export function validateStickers(): string[] {
  return (Object.entries(STICKER_IDS) as Array<[StickerState, string | undefined]>)
    .filter(([, id]) => !id)
    .map(([key]) => key);
}

export function getSticker(state: StickerState | string): string | undefined {
  const key = (FLOW_MAP[String(state).toLowerCase()] ?? state) as StickerState;
  const id = STICKER_IDS[key];
  return id || undefined;
}
