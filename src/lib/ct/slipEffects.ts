/**
 * Slip effects — one-shot, non-blocking metadata (Telegram has no CSS loops).
 */
export type SlipEffectConfig = {
  scanLine: boolean;
  dataReveal: boolean;
  calculationBeam: boolean;
  clearanceRing: boolean;
  settlementLink: boolean;
};

export const defaultSlipEffects: SlipEffectConfig = {
  scanLine: true,
  dataReveal: true,
  calculationBeam: true,
  clearanceRing: true,
  settlementLink: true,
};

export type AppliedSlipEffect = {
  name: keyof SlipEffectConfig;
  durationMs: number;
  cue: string | null;
};

/** Visual cues only — never mutate money fields. */
export function applySlipEffects(
  config: SlipEffectConfig = defaultSlipEffects,
): AppliedSlipEffect[] {
  const out: AppliedSlipEffect[] = [];
  if (config.scanLine) out.push({ name: 'scanLine', durationMs: 180, cue: null });
  if (config.dataReveal) out.push({ name: 'dataReveal', durationMs: 200, cue: null });
  if (config.calculationBeam) out.push({ name: 'calculationBeam', durationMs: 100, cue: '→' });
  if (config.clearanceRing) out.push({ name: 'clearanceRing', durationMs: 350, cue: '✓' });
  if (config.settlementLink) out.push({ name: 'settlementLink', durationMs: 0, cue: null });
  return out;
}
