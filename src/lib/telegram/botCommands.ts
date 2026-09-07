export const PRIVATE_ONLY_COMMANDS = new Set(['start', 'help', 'register']);

export const GROUP_COMMANDS: Array<{ command: string; description: string }> = [
  { command: 'rate', description: 'ดูหรือตั้งเรทโต๊ะ' },
  { command: 'pin', description: 'ปักบัญชีรับ' },
  { command: 'unpin', description: 'ถอนหมุดบัญชี' },
  { command: 'save_slip', description: 'บันทึกสลิปมือ' },
  { command: 'recent_slips', description: 'สลิปล่าสุด' },
  { command: 'summary', description: 'สรุปยอดวันนี้' },
];

export const PRIVATE_COMMANDS: Array<{ command: string; description: string }> = [
  { command: 'start', description: 'เปิดการ์ดห้อง' },
  { command: 'help', description: 'วิธีใช้สั้นๆ' },
  ...GROUP_COMMANDS,
];

export function isPrivateOnlyCommand(name: string | null | undefined): boolean {
  return !!name && PRIVATE_ONLY_COMMANDS.has(name);
}

let synced = false;

export async function ensureBotCommandScopes(): Promise<void> {
  if (synced) return;
  const { setMyCommands } = await import('../telegram');
  await setMyCommands(GROUP_COMMANDS, { type: 'default' });
  await setMyCommands(GROUP_COMMANDS, { type: 'all_group_chats' });
  await setMyCommands(PRIVATE_COMMANDS, { type: 'all_private_chats' });
  synced = true;
}
