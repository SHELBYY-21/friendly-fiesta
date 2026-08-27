/** CT terminal visual tokens. */

export const MARK = '\u25C8';
export const NODE = '\u2B22';
export const RAIL = '\u2503';
export const RULE = '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';
export const DOT_ON = '\u25CF';
export const DOT_OFF = '\u25CB';

export const STEPS = ['OCR', 'MATCH', 'IN', 'WAIT', 'DONE'] as const;
export type FlowStep = 'scan' | 'match' | 'in' | 'wait' | 'done';

const STEP_INDEX: Record<FlowStep, number> = {
  scan: 0,
  match: 1,
  in: 2,
  wait: 3,
  done: 4,
};

const STATUS_EN: Record<string, string> = {
  AGENT: 'AGENT',
  'สรุปยอด': 'VAULT',
  'เงินเข้า': 'IN',
  'รอโอน': 'WAIT',
  'รอรวมยอด': 'QUEUE',
  'โอนแล้ว': 'SETTLED',
  'แจ้งเตือน': 'ALERT',
  'ตั้งค่า': 'SETUP',
  'บัญชีรับ': 'PIN',
  'อัตราแลกเปลี่ยน': 'RATE',
  'รายการ': 'SLIP',
};

export function progress(step: FlowStep): string {
  const idx = STEP_INDEX[step];
  return STEPS.map((s, i) => {
    const dot = i <= idx ? DOT_ON : DOT_OFF;
    const label = i === idx ? `<b>${s}</b>` : s;
    return `${dot} ${label}`;
  }).join(' \u2500\u2500 ');
}

export function head(status: string, meta: string): string {
  const en = STATUS_EN[status];
  const chip = en || status;
  return `${MARK}  <b>CT</b>  \u00B7  <b>${chip}</b>\n${meta}`;
}

export function rule(): string {
  return RULE;
}

export function spoiler(text: string): string {
  return `<tg-spoiler>${text}</tg-spoiler>`;
}

export function quote(text: string, expandable = true): string {
  return expandable
    ? `<blockquote expandable>${text}</blockquote>`
    : `<blockquote>${text}</blockquote>`;
}

export function kv(th: string, en: string, value: string): string {
  return `${th}  <i>${en}</i>\n${value}`;
}
