#!/usr/bin/env python3
"""CT terminal card — full ANSI. Same fields as the Telegram bot.

  python3 scripts/preview_card.py
  python3 scripts/preview_card.py --json '{"thbAmount":1090,"receiverLast4":"0343",...}'
"""
from __future__ import annotations

import json
import sys

GOLD = "\033[38;2;201;168;76m"
CYAN = "\033[38;2;110;231;229m"
DIM = "\033[38;2;122;122;122m"
FG = "\033[38;2;232;232;228m"
BOLD = "\033[1m"
RESET = "\033[0m"
BG = "\033[48;2;10;10;10m"


def c(color: str, text: str) -> str:
    return f"{color}{text}{RESET}{BG}"


def row(th: str, en: str, value: str, value_color: str = FG) -> str:
    label = f"{th} ({en})"
    return f"{BG}{c(DIM, label.ljust(22))}{c(value_color, value)}"


def card(d: dict) -> str:
    thb = d.get("thbAmount") or d.get("thb") or 0
    usdt = d.get("shouldSend") or d.get("usdt")
    desk = d.get("desk") or 41
    if usdt is None and thb and desk:
        usdt = round(float(thb) / float(desk), 2)
    mkt = d.get("mkt") or 32.73
    last4 = d.get("receiverLast4") or d.get("last4") or "????"
    name = d.get("receiverName") or d.get("name") or "—"
    bank = d.get("bank") or "KTB"
    ref = d.get("ledger") or "CE-20260826-A2EF"
    conf = d.get("confidence")
    status = d.get("status") or "WAIT"
    due = float(usdt or 0)
    line = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    dots = f"{GOLD}●──●──●──●{DIM}──○{RESET}{BG}"
    tape = f"{DIM}┃ OCR  MATCH  IN  {GOLD}WAIT{DIM}  DONE{RESET}{BG}"
    body = [
        f"{BG}{c(GOLD, '◈')}  {c(BOLD + FG, 'CT')}",
        f"{c(DIM, f'[ รอโอน ({status}) ]  queued')}",
        "",
        dots,
        tape,
        c(DIM, line),
        row("ยอดเข้า", "IN", f"{float(thb):,.2f} THB", BOLD + FG),
        row("ต้องส่ง", "DUE", f"{due:.2f} USDT", GOLD + BOLD),
        row("อัตราโต๊ะ", "DESK", f"{float(desk):.2f}", FG),
        row("ตลาด", "MKT", f"{float(mkt):.2f}", CYAN),
        c(DIM, line),
        row("ผู้รับ", "PAYEE", f"{bank}  ••••{last4}", FG),
        row("ชื่อ", "NAME", str(name), FG),
        row("เลขที่", "REF", f"#{ref.lstrip('#')}", GOLD),
    ]
    if conf is not None:
        body.append(row("ความมั่นใจ", "OCR", f"{int(conf)}%", DIM))
    body += [
        c(DIM, line),
        c(DIM, "คิววันนี้ (QUEUE)     1"),
        c(GOLD, f"due  {due:.2f} USDT"),
        "",
        c(DIM, "buttons  undo · vault · sent"),
        RESET,
    ]
    return "\n".join(body)


SAMPLE = {
    "thbAmount": 1090,
    "shouldSend": 26.59,
    "desk": 41,
    "mkt": 32.73,
    "bank": "KTB",
    "receiverLast4": "0343",
    "receiverName": "สุพัตรา อั้นเจริญ",
    "ledger": "CE-20260826-A2EF",
    "confidence": 96,
    "status": "WAIT",
}


def main() -> None:
    data = dict(SAMPLE)
    if len(sys.argv) >= 3 and sys.argv[1] == "--json":
        data.update(json.loads(sys.argv[2]))
    sys.stdout.write("\033[2J\033[H")
    print(card(data))


if __name__ == "__main__":
    main()
