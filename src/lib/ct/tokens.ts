/** CT terminal visual tokens. No colorful public emoji. */

export const MARK = '◈';
export const NODE = '⬢';
export const RAIL = '┃';
export const RULE = '━━━━━━━━';
export const DOT_ON = '●';
export const DOT_OFF = '○';

export const STEPS = ['อ่าน', 'เทียบ', 'ตรวจ', 'รอโอน', 'เสร็จ'] as const;
export type FlowStep = 'scan' | 'match' | 'in' | 'wait' | 'done';

const STEP_INDEX: Record<FlowStep, number> = {
  scan: 0,
  match: 1,
  in: 2,
  wait: 3,
  done: 4,
};

export function progress(step: FlowStep): string {
  const idx = STEP_INDEX[step];
  const dots = STEPS.map((_, i) => (i <= idx ? DOT_ON : DOT_OFF)).join('──');
  const labels = STEPS.map((s, i) => (i === idx ? `<b>${s}</b>` : s)).join('  ');
  return `${dots}\n${RAIL} ${labels}`;
}

export function head(status: string, meta: string): string {
  return `${MARK}  <b>CT</b>\n<i>[ ${status} ]  ${meta}</i>`;
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
