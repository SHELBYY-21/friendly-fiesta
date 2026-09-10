/**
 * Slip OCR/Clearance effects — transition-only (no loops).
 * Telegram: soft cues / captions; never mutate money.
 */
export type SlipFxState =
  | 'UPLOAD'
  | 'READING'
  | 'OCR_SCANNING'
  | 'AMOUNT_DETECTED'
  | 'ACCOUNT_MATCHED'
  | 'DATE_VERIFIED'
  | 'DUPLICATE_CHECKED'
  | 'CALCULATING'
  | 'CLEARED'
  | 'MATCHED'
  | 'EXCESS'
  | 'SHORT'
  | 'DUPLICATE'
  | 'OCR_LOW';

export type SlipFxTone = 'cyan' | 'gold' | 'amber' | 'red' | 'purple';

export type SlipFxEvent = {
  state: SlipFxState;
  tone: SlipFxTone;
  durationMs: number;
  cue: string | null;
  /** One-shot only */
  once: true;
};

const TONE: Record<SlipFxState, SlipFxTone> = {
  UPLOAD: 'cyan',
  READING: 'cyan',
  OCR_SCANNING: 'cyan',
  AMOUNT_DETECTED: 'cyan',
  ACCOUNT_MATCHED: 'cyan',
  DATE_VERIFIED: 'cyan',
  DUPLICATE_CHECKED: 'cyan',
  CALCULATING: 'cyan',
  CLEARED: 'gold',
  MATCHED: 'gold',
  EXCESS: 'amber',
  SHORT: 'purple',
  DUPLICATE: 'red',
  OCR_LOW: 'amber',
};

const DUR: Partial<Record<SlipFxState, number>> = {
  UPLOAD: 180,
  OCR_SCANNING: 220,
  AMOUNT_DETECTED: 200,
  ACCOUNT_MATCHED: 200,
  DATE_VERIFIED: 160,
  CALCULATING: 240,
  MATCHED: 280,
  EXCESS: 280,
  SHORT: 180,
  DUPLICATE: 300,
  OCR_LOW: 260,
  CLEARED: 300,
};

/** Emit effect only when state changes. */
export function effectOnTransition(
  from: SlipFxState | null,
  to: SlipFxState,
): SlipFxEvent | null {
  if (from === to) return null;
  return {
    state: to,
    tone: TONE[to],
    durationMs: DUR[to] ?? 200,
    cue: to === 'MATCHED' || to === 'CLEARED' ? '✓' : to === 'SHORT' ? '!' : to === 'EXCESS' ? '↑' : null,
    once: true,
  };
}

export function pipelineToFx(stage: string, opts?: { duplicate?: boolean; lowOcr?: boolean; lineStatus?: string }): SlipFxState {
  if (opts?.duplicate) return 'DUPLICATE';
  if (opts?.lowOcr) return 'OCR_LOW';
  const ls = (opts?.lineStatus || '').toUpperCase();
  if (ls === 'EXCESS') return 'EXCESS';
  if (ls === 'SHORT') return 'SHORT';
  if (ls === 'MATCHED') return 'MATCHED';
  switch (stage) {
    case 'RECEIVED':
      return 'UPLOAD';
    case 'OCR_PROCESSING':
      return 'OCR_SCANNING';
    case 'OCR_VERIFIED':
      return 'AMOUNT_DETECTED';
    case 'MATCHING':
      return 'ACCOUNT_MATCHED';
    case 'CALCULATION':
      return 'CALCULATING';
    case 'CLEARANCE':
      return 'CLEARED';
    default:
      return 'READING';
  }
}
