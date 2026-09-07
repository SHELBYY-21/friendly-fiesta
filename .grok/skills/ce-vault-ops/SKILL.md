---
name: ce-vault-ops
description: CE Vault desk + Telegram slip bot. Use when mapping Thai bank names or BOT FI codes, parsing Typhoon OCR JSON, picking photo[] for OCR, or changing PIN/rate/pin/KEEP/settle desk forms.
---

# CE Vault ops

Internal desk is **CE Vault**. Public og is **CE EMPIRE**. Do not mix those strings.

## Do not change

- Telegram webhook Route Handler (`POST /api/telegram/webhook`)
- Vault GET polling
- Rate math, USDT, profit
- Fake/mock ledger data

Desk mutations go through `src/lib/desk/actions.ts` (PIN, rate, pin, reset, KEEP, settle, Typhoon key).

## Bank mapping

One table: `normalizeBankCode` + `BOT_BANK` + `bankLabel` in `src/lib/botSecurity.ts`.

- Match pins on **codes** (`KBANK`), never on Thai labels.
- Cards show `กสิกร (KBANK)` via `bankLabel`.
- BOT QR: `004` → KBANK, `006` → KTB, `014` → SCB. Unknown digits → `null`.
- Thai names: กสิกร/LINE BK → KBANK, ไทยพาณิชย → SCB, ธนชาต → TTB.
- KBank dashed `145-3-58306-2`: model `receiverLast4` (often `8306`) wins over digit-slice `3062`.

## OCR photo

`largestPhoto` in `src/lib/telegram/update.ts` — max `width*height`, tie-break last index.

`stillFromTelegram` uses `live_photo.photo ?? photo`. Never OCR the motion clip.

## Typhoon JSON

`typhoon-ocr` → markdown, `typhoon-v2.5-30b-a3b-instruct` → JSON, `slipFromTyphoonJson` → `SlipExtract`.

PAYEE = ไปยัง / ผู้รับ. SENDER = จาก / ผู้โอน. Empty JSON fields fall back to smart-slip markdown. No `usdt` in JSON.

## Desk copy

Staff Thai, verb buttons, numbers fully opaque. Green = in, red = send, gold = brand, cyan = in progress.

## Verify

```
npx tsc --noEmit
NODE_OPTIONS='--require /tmp/ws-polyfill.cjs' npx ts-node --project test/tsconfig.json test/run-test.ts
```

## Indexes

Apply in SQL editor, in order: `patch-v17-vault-poll.sql` then `patch-v18-covering-vault.sql`.
Check with `explain-v17-vault-poll.sql` and `selectivity-v17.sql`. Want Index Only Scan on `idx_tx_chat_type_created`.
