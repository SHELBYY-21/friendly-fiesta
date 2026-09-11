import type { Admin } from '@/types/transactions';

export class SettledMutationError extends Error {
  constructor(message = 'SETTLED_LOCKED') {
    super(message);
    this.name = 'SettledMutationError';
  }
}

/** True when a ledger/pending row should refuse silent edit/delete. */
export function isSettledLike(row: { status?: string | null; settled_at?: string | null } | null | undefined): boolean {
  if (!row) return false;
  const s = String(row.status ?? '').toUpperCase();
  if (s === 'SETTLED' || s === 'CONFIRMED' || s === 'CLEARED') return true;
  if (row.settled_at) return true;
  return false;
}

/** SuperAdmin may mutate settled rows only with an explicit non-empty reason. */
export function assertCanMutateSettled(
  row: { status?: string | null; settled_at?: string | null } | null | undefined,
  admin: Pick<Admin, 'role'> | null | undefined,
  reason?: string | null,
): void {
  if (!isSettledLike(row)) return;
  const role = admin?.role ?? null;
  if (role === 'SuperAdmin' && reason && String(reason).trim().length >= 3) return;
  throw new SettledMutationError(
    role === 'SuperAdmin'
      ? 'SETTLED_LOCKED: SuperAdmin ต้องใส่เหตุผลอย่างน้อย 3 ตัวอักษร'
      : 'SETTLED_LOCKED: รายการปิดยอดแล้ว — แก้/ลบได้เฉพาะ SuperAdmin พร้อมเหตุผล',
  );
}
