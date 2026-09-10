/**
 * Effects — one-shot, non-blocking (Telegram metadata cues).
 * scanLine / dataReveal / calculationBeam / clearanceRing / settlementLink
 */
export type EffectConfig = {
  scanLine: boolean;
  dataReveal: boolean;
  calculationBeam: boolean;
  clearanceRing: boolean;
  settlementLink: boolean;
};

export const defaultEffects: EffectConfig = {
  scanLine: true,
  dataReveal: true,
  calculationBeam: true,
  clearanceRing: true,
  settlementLink: true,
};

export type AppliedEffect = {
  name: keyof EffectConfig;
  durationMs: number;
  cue: string | null;
};

export function applyEffects(
  _slip: { settlementId?: string },
  config: EffectConfig = defaultEffects,
): AppliedEffect[] {
  const out: AppliedEffect[] = [];
  if (config.scanLine) out.push({ name: 'scanLine', durationMs: 180, cue: null });
  if (config.dataReveal) out.push({ name: 'dataReveal', durationMs: 200, cue: null });
  if (config.calculationBeam) out.push({ name: 'calculationBeam', durationMs: 100, cue: '→' });
  if (config.clearanceRing) out.push({ name: 'clearanceRing', durationMs: 350, cue: '✓' });
  if (config.settlementLink) out.push({ name: 'settlementLink', durationMs: 0, cue: null });
  return out;
}

/** Keep transition helper for callers that still import it */
export type SlipFxState =
  | 'UPLOAD'
  | 'OCR_SCANNING'
  | 'CALCULATING'
  | 'CLEARED'
  | 'MATCHED'
  | 'EXCESS'
  | 'SHORT';

export function effectOnTransition(from: SlipFxState | null, to: SlipFxState) {
  if (from === to) return null;
  return { state: to, once: true as const, durationMs: 200, cue: to === 'CLEARED' || to === 'MATCHED' ? '✓' : null };
}

export function pipelineToFx(stage: string): SlipFxState {
  if (stage === 'CLEARANCE' || stage === 'CLEARED') return 'CLEARED';
  if (stage === 'CALCULATION') return 'CALCULATING';
  if (stage === 'OCR_PROCESSING') return 'OCR_SCANNING';
  return 'UPLOAD';
}
