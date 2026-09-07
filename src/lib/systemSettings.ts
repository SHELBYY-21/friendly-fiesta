// ============================================================
// อ่านค่า system_settings (แก้ได้จาก dashboard)
// - cache สั้น ๆ กันยิง DB ทุก update
// - ถ้าตาราง/DB มีปัญหา → ถือว่าบอทเปิด (fail-open) เพื่อไม่ให้บอทตายทั้งระบบ
// ============================================================
import { supabaseAdmin } from './supabaseAdmin';

const CACHE_TTL_MS = 10_000;
const SECRET_TTL_MS = 10_000;

let cache: { botEnabled: boolean; maintenanceMessage: string; fetchedAt: number } | null = null;
let secretCache: { typhoon: string | null; at: number } | null = null;

export interface BotGate {
  botEnabled: boolean;
  maintenanceMessage: string;
}

export async function getBotGate(): Promise<BotGate> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { botEnabled: cache.botEnabled, maintenanceMessage: cache.maintenanceMessage };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')
      .in('key', ['bot_enabled', 'maintenance_message']);

    if (error) throw error;

    const map: Record<string, any> = {};
    for (const row of data ?? []) map[row.key] = row.value;

    const gate: BotGate = {
      botEnabled: map.bot_enabled !== false,
      maintenanceMessage:
        typeof map.maintenance_message === 'string' && map.maintenance_message.trim()
          ? map.maintenance_message
          : 'ระบบกำลังปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง',
    };
    cache = { ...gate, fetchedAt: Date.now() };
    return gate;
  } catch {
    return {
      botEnabled: true,
      maintenanceMessage: 'ระบบกำลังปิดปรับปรุงชั่วคราว กรุณาลองใหม่ภายหลัง',
    };
  }
}

export async function getTyphoonSetting(): Promise<string | null> {
  if (secretCache && Date.now() - secretCache.at < SECRET_TTL_MS) return secretCache.typhoon;
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'typhoon_api_key')
      .maybeSingle();
    if (error) throw error;
    const typhoon = asSecret(data?.value);
    secretCache = { typhoon, at: Date.now() };
    return typhoon;
  } catch {
    secretCache = { typhoon: null, at: Date.now() };
    return null;
  }
}

export async function saveTyphoonSetting(key: string): Promise<void> {
  const clean = asSecret(key);
  if (!clean) throw new Error('INVALID_KEY');
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      key: 'typhoon_api_key',
      value: clean,
      updated_at: new Date().toISOString(),
      updated_by: 'dashboard',
    },
    { onConflict: 'key' },
  );
  if (error) throw error;
  secretCache = { typhoon: clean, at: Date.now() };
}

function asSecret(v: unknown): string | null {
  if (typeof v === 'string') {
    const s = v.trim().replace(/^"+|"+$/g, '');
    return s && s.length >= 12 && !/YOUR_API_KEY|placeholder/i.test(s) ? s : null;
  }
  if (v && typeof v === 'object' && 'key' in (v as object)) {
    return asSecret((v as { key: unknown }).key);
  }
  return null;
}

/** ล้าง cache ทันที (เรียกหลัง dashboard แก้ค่า) */
export function invalidateBotGateCache(): void {
  cache = null;
  secretCache = null;
}
