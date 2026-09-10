/**
 * CE VAULT — Auto Effects for Settlement Card
 * Telegram has no CSS animation; effects are metadata + optional editMessage cues.
 * Web desk can read tokens via settlementMotion.
 */
import {
  SETTLEMENT_MOTION,
  motionAllows,
  resolveMotionMode,
  type ReducedMotionMode,
} from './settlementMotion';
import { SettlementState } from './settlementCard';

export type EffectName = 'pulse' | 'glow' | 'shake' | 'count_up' | 'fade';
export type PerformanceTier = 'high' | 'medium' | 'low' | 'minimal';

type EffectConfig = { enabled: boolean; interval?: number; duration: number };

export type AppliedEffect = {
  name: EffectName;
  durationMs: number;
  /** Soft cue for Telegram caption / status line (never changes money values). */
  telegramCue: string | null;
  allowed: boolean;
};

class AutoEffectManager {
  enabled = true;
  reducedMotion = false;
  performanceTier: PerformanceTier = 'medium';
  configs: Record<EffectName, EffectConfig> = {
    pulse: { enabled: true, interval: 2.5, duration: SETTLEMENT_MOTION.readyPulse.durationMs / 1000 },
    glow: { enabled: true, duration: SETTLEMENT_MOTION.matchedCheck.durationMs / 1000 },
    shake: { enabled: true, duration: SETTLEMENT_MOTION.errorShake.durationMs / 1000 },
    count_up: { enabled: true, duration: SETTLEMENT_MOTION.excessCountUp.durationMs / 1000 },
    fade: { enabled: true, duration: SETTLEMENT_MOTION.cardEntry.durationMs / 1000 },
  };

  setPerformanceTier(tier: PerformanceTier) {
    this.performanceTier = tier;
    if (tier === 'high') {
      this.enabled = true;
      this.configs.pulse.enabled = true;
      this.configs.glow.enabled = true;
      this.configs.shake.enabled = true;
      this.configs.count_up.enabled = true;
      this.configs.fade.enabled = true;
    } else if (tier === 'medium') {
      this.enabled = true;
      this.configs.pulse.enabled = true;
      this.configs.glow.enabled = false;
      this.configs.shake.enabled = true;
      this.configs.count_up.enabled = true;
      this.configs.fade.enabled = true;
    } else if (tier === 'low') {
      this.enabled = true;
      this.configs.pulse.enabled = false;
      this.configs.glow.enabled = false;
      this.configs.shake.enabled = false;
      this.configs.count_up.enabled = false;
      this.configs.fade.enabled = true;
    } else {
      this.enabled = false;
    }
  }

  setReducedMotion(on: boolean) {
    this.reducedMotion = on;
  }

  enableEffect(name: EffectName, enabled = true) {
    if (this.configs[name]) this.configs[name].enabled = enabled;
  }

  mode(): ReducedMotionMode {
    return resolveMotionMode(this.reducedMotion || this.performanceTier === 'minimal');
  }

  apply(name: EffectName, cue?: string): AppliedEffect {
    const cfg = this.configs[name];
    const mode = this.mode();
    const kind =
      name === 'pulse' ? 'pulse'
        : name === 'glow' ? 'glow'
          : name === 'shake' ? 'shake'
            : name === 'count_up' ? 'countUp'
              : 'slide';
    const allowed =
      this.enabled &&
      Boolean(cfg?.enabled) &&
      motionAllows(mode, kind);
    return {
      name,
      durationMs: allowed ? Math.round((cfg?.duration ?? 0.2) * 1000) : 0,
      telegramCue: allowed ? (cue ?? null) : null,
      allowed,
    };
  }
}

let _mgr: AutoEffectManager | null = null;

export function getEffectManager(): AutoEffectManager {
  if (!_mgr) _mgr = new AutoEffectManager();
  return _mgr;
}

export async function setupAutoEffects(opts?: {
  tier?: PerformanceTier;
  reducedMotion?: boolean;
}): Promise<PerformanceTier> {
  const mgr = getEffectManager();
  const tier = opts?.tier ?? (await autoDetectPerformance());
  mgr.setPerformanceTier(tier);
  if (opts?.reducedMotion != null) mgr.setReducedMotion(opts.reducedMotion);
  return tier;
}

export async function autoDetectPerformance(): Promise<PerformanceTier> {
  // Serverless: default medium (no psutil). Env override supported.
  const raw = (process.env.SETTLEMENT_FX_TIER || '').toLowerCase();
  if (raw === 'high' || raw === 'medium' || raw === 'low' || raw === 'minimal') return raw;
  return 'medium';
}

export function setPerformanceTier(tier: PerformanceTier) {
  getEffectManager().setPerformanceTier(tier);
}

export async function addPulseEffect(): Promise<AppliedEffect> {
  return getEffectManager().apply('pulse', '·');
}

export async function addGlowEffect(): Promise<AppliedEffect> {
  return getEffectManager().apply('glow', '✦');
}

export async function addShakeEffect(): Promise<AppliedEffect> {
  return getEffectManager().apply('shake', '!');
}

export async function addCountUpEffect(_from: number, _to: number): Promise<AppliedEffect> {
  void _from;
  void _to;
  return getEffectManager().apply('count_up', '↑');
}

export async function addFadeEffect(): Promise<AppliedEffect> {
  return getEffectManager().apply('fade', null);
}

/** Map settlement state → one effect (financial values untouched). */
export async function effectForState(state: SettlementState): Promise<AppliedEffect | null> {
  switch (state) {
    case SettlementState.READY:
      return addPulseEffect();
    case SettlementState.MATCHED:
    case SettlementState.SETTLED:
      return addGlowEffect();
    case SettlementState.SHORT:
      return addShakeEffect();
    case SettlementState.EXCESS:
      return addCountUpEffect(0, 0);
    default:
      return null;
  }
}
