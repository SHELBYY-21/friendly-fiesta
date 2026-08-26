#!/usr/bin/env python3
"""Test Grok Vision the same way CT desk reads a slip.

  export GROK_API_KEY=xai-...
  python3 scripts/test_vision.py /path/to/slip.jpg
"""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

def load_env() -> None:
    root = Path(__file__).resolve().parents[1]
    for name in (".env.local", ".env"):
        path = root / name
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[7:]
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = value


load_env()
API = "https://api.x.ai/v1/chat/completions"
MODEL = os.environ.get("GROK_MODEL") or "grok-4.20-non-reasoning"
PROMPT = """You are an expert Thai bank slip parser (KPlus, SCB Easy, Krungthai NEXT, Bualuang, ttb, GSB, TrueMoney, LINE BK).
Reply with ONLY a JSON object:
{
  "thbAmount": number,
  "time": "HH:MM",
  "date": "DD/MM/YY",
  "receiverLast4": "XXXX",
  "senderLast4": "XXXX or null",
  "bank": "KBANK|SCB|BBL|KTB|BAY|TTB|GSB|KKP|CIMB|LH|UOB|TISCO|TRUEMONEY|PROMPTPAY",
  "receiverName": "name or null",
  "senderName": "name or null",
  "confidence": number|null
}
CRITICAL — account roles:
- receiverLast4 = PAYEE / บัญชีรับเงิน / ไปยัง / ผู้รับ / เข้าบัญชี.
- senderLast4 = ผู้โอน / จาก / บัญชีต้นทาง. NEVER copy sender digits into receiverLast4.
- receiverName = PAYEE name only. Strip titles นาย นาง น.ส. คุณ.
- bank = bank of the RECEIVER. กรุงไทย → KTB. กสิกร/LINE BK → KBANK. ไทยพาณิชย์ → SCB.
Rules: raw JSON only. Unreadable fields = null. Never invent."""


def data_url(path: Path) -> str:
    raw = path.read_bytes()
    if not raw:
        raise SystemExit(f"empty file: {path}")
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"


def call_vision(image: str) -> dict:
    key = os.environ.get("GROK_API_KEY") or os.environ.get("XAI_API_KEY")
    if not key:
        raise SystemExit("set GROK_API_KEY first")
    body = json.dumps(
        {
            "model": MODEL,
            "temperature": 0,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {"type": "image_url", "image_url": {"url": image, "detail": "high"}},
                    ],
                }
            ],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        API,
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            payload = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise SystemExit(f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:500]}") from e
    text = payload.get("choices", [{}])[0].get("message", {}).get("content") or ""
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end < 0:
        raise SystemExit(f"not JSON:\n{text[:800]}")
    return json.loads(cleaned[start : end + 1])


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: python3 scripts/test_vision.py slip.jpg")
    src = sys.argv[1]
    image = src if src.startswith("http") else data_url(Path(src))
    data = call_vision(image)
    print(json.dumps(data, ensure_ascii=False, indent=2))
    last4 = data.get("receiverLast4")
    thb = data.get("thbAmount")
    name = data.get("receiverName")
    print(f"\ncheck  THB={thb}  recv={last4}  name={name}  conf={data.get('confidence')}")
    if not thb or not last4:
        raise SystemExit("fail: need thbAmount + receiverLast4")


if __name__ == "__main__":
    main()
