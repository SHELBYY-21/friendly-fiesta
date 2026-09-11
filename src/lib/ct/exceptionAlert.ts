import { notifyException } from '../notifier';

export type AlertSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

const recent = new Map<string, number>();
const DEDUPE_MS = 5 * 60 * 1000;

export async function alertException(input: {
  code: string;
  severity: AlertSeverity;
  chatId?: number | null;
  fingerprint?: string | null;
  detail?: string;
  action?: string;
}): Promise<void> {
  const key = [input.chatId ?? 'ops', input.code, input.fingerprint ?? ''].join('|');
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < DEDUPE_MS) return;
  recent.set(key, now);
  await notifyException({
    severity: input.severity,
    code: input.code,
    detail: input.detail,
    action: input.action,
  });
}
