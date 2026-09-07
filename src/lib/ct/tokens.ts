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

const NOW: Record<FlowStep, string> = {
  scan: 'กำลังอ่านสลิป (scanning)',
  match: 'กำลังเทียบบัญชี (matching)',
  in: 'อ่านครบแล้ว → รอคนยืนยัน (ready)',
  wait: 'รับเงินแล้ว → รอโอน USDT (queued)',
  done: 'โอนครบแล้ว (settled)',
};

const CHIP: Record<string, string> = {
  AGENT: 'อ่านสลิป (OCR)',
  สรุปยอด: 'VAULT',
  เงินเข้า: 'ยอดรับเข้า (IN)',
  ยอดรับเข้า: 'ยอดรับเข้า (IN)',
  รอโอน: 'รอโอน (WAIT)',
  รอรวมยอด: 'รอโอน (WAIT)',
  โอนแล้ว: 'โอนสำเร็จ (DONE)',
  โอนสำเร็จ: 'โอนสำเร็จ (DONE)',
  แจ้งเตือน: 'แจ้งเตือน (ALERT)',
  ตั้งค่า: 'ตั้งค่า (SETTINGS)',
  บัญชีรับ: 'บัญชีรับเงินวันนี้ (PINS)',
  อัตราแลกเปลี่ยน: 'เราขาย (DESK)',
  รายการ: 'รายการ (LEDGER)',
  เลือกห้อง: 'เลือกห้อง (ROOMS)',
};

export function progress(step: FlowStep): string {
  const idx = STEP_INDEX[step];
  const dots = STEPS.map((_, i) => (i <= idx ? DOT_ON : DOT_OFF)).join('\u2500\u2500');
  return `${dots}  <b>${STEPS[idx]}</b>  ·  ${NOW[step]}`;
}

export function head(status: string, meta?: string): string {
  const chip = CHIP[status] ?? status;
  return meta
    ? `${MARK}  <b>CT</b>  ·  <b>${chip}</b>\n${meta}`
    : `${MARK}  <b>CT</b>  ·  <b>${chip}</b>`;
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
  return `${th}  <i>(${en})</i>\n${value}`;
}

export function term(cmd: string, en: string, value?: string): string {
  const headLine = `> ${cmd}  <i>(${en})</i>`;
  return value ? `${headLine}\n  ${value}` : headLine;
}
