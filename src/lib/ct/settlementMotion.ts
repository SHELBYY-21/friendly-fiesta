/**
 * CE VAULT — Settlement motion tokens
 * Telegram: apply via editMessage / button state (no CSS in chat).
 * Web desk: CSS vars; honor prefers-reduced-motion.
 */

export const SETTLEMENT_COLORS = {
  midnightBlack: '#0A0A0A',
  royalGold: '#C9A84C',
  electricCyan: '#6EE7E5',
  darkPurple: '#7C5CFF',
  softWarn: '#A78BFA',
  textPrimary: '#E8E8E4',
  textDim: '#7A7A7A',
} as const;

export type MotionToken = {
  durationMs: number;
  easing: string;
  opacityFrom?: number;
  opacityTo?: number;
  translateYpx?: number;
  scaleFrom?: number;
  scaleTo?: number;
  glow?: string;
};

export const SETTLEMENT_MOTION = {
  cardEntry: {
    durationMs: 180,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    opacityFrom: 0,
    opacityTo: 1,
    translateYpx: 8,
  } satisfies MotionToken,
  amountUpdate: {
    durationMs: 190,
    easing: 'ease-out',
    opacityFrom: 0.35,
    opacityTo: 1,
  } satisfies MotionToken,
  readyPulse: {
    durationMs: 2500,
    easing: 'ease-in-out',
    opacityFrom: 0.55,
    opacityTo: 1,
    glow: SETTLEMENT_COLORS.electricCyan,
  } satisfies MotionToken,
  matchedCheck: {
    durationMs: 350,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    scaleFrom: 0.86,
    scaleTo: 1,
    glow: SETTLEMENT_COLORS.royalGold,
  } satisfies MotionToken,
  excessCountUp: {
    durationMs: 220,
    easing: 'ease-out',
    glow: SETTLEMENT_COLORS.royalGold,
  } satisfies MotionToken,
  shortAccent: {
    durationMs: 200,
    easing: 'ease-out',
    glow: SETTLEMENT_COLORS.softWarn,
  } satisfies MotionToken,
  settledGlow: {
    durationMs: 320,
    easing: 'ease-out',
    glow: SETTLEMENT_COLORS.royalGold,
  } satisfies MotionToken,
  confirmLoading: {
    durationMs: 0,
    easing: 'linear',
  } satisfies MotionToken,
  errorShake: {
    durationMs: 180,
    easing: 'ease-out',
  } satisfies MotionToken,
} as const;

export type ReducedMotionMode = 'full' | 'reduced';

export function resolveMotionMode(prefersReduced?: boolean): ReducedMotionMode {
  return prefersReduced ? 'reduced' : 'full';
}

export function motionAllows(
  mode: ReducedMotionMode,
  kind: 'pulse' | 'glow' | 'shake' | 'countUp' | 'slide',
): boolean {
  if (mode === 'full') return true;
  void kind;
  return false;
}

export function settlementMotionCssVars(mode: ReducedMotionMode = 'full'): Record<string, string> {
  const m = SETTLEMENT_MOTION;
  const off = mode === 'reduced';
  return {
    '--settle-card-duration': off ? '0ms' : `${m.cardEntry.durationMs}ms`,
    '--settle-card-ease': m.cardEntry.easing,
    '--settle-card-ty': off ? '0px' : `${m.cardEntry.translateYpx}px`,
    '--settle-amount-duration': off ? '0ms' : `${m.amountUpdate.durationMs}ms`,
    '--settle-ready-pulse': off ? '0ms' : `${m.readyPulse.durationMs}ms`,
    '--settle-matched-duration': off ? '0ms' : `${m.matchedCheck.durationMs}ms`,
    '--settle-error-shake': off ? '0ms' : `${m.errorShake.durationMs}ms`,
    '--settle-gold': SETTLEMENT_COLORS.royalGold,
    '--settle-cyan': SETTLEMENT_COLORS.electricCyan,
    '--settle-purple': SETTLEMENT_COLORS.darkPurple,
    '--settle-bg': SETTLEMENT_COLORS.midnightBlack,
  };
}
