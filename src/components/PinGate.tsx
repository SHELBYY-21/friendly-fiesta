'use client';

// ============================================================
// PIN gate — ช่องกรอก PIN 6 หลัก (auto-advance, paste ได้)
// ============================================================
import { useEffect, useRef, useState } from 'react';

export default function PinGate({ nextPath = '/dashboard' }: { nextPath?: string }) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [status, setStatus] = useState<'idle' | 'checking' | 'error' | 'locked' | 'ok'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setInterval(() => {
      setLockSeconds((s) => {
        if (s <= 1) {
          setStatus('idle');
          setMessage(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [lockSeconds]);

  const submit = async (pin: string) => {
    setStatus('checking');
    setMessage(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();

      if (res.ok && json.ok) {
        setStatus('ok');
        window.location.href = nextPath;
        return;
      }

      if (res.status === 429) {
        setStatus('locked');
        setLockSeconds(Number(json.secondsLeft) || 900);
        setMessage('ใส่ PIN ผิดหลายครั้ง — ถูกล็อกชั่วคราว');
      } else if (res.status === 503) {
        setStatus('error');
        setMessage(json.message || 'ระบบยังไม่ได้ตั้งค่า PIN');
      } else {
        setStatus('error');
        setMessage('PIN ไม่ถูกต้อง');
      }
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch {
      setStatus('error');
      setMessage('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง');
    }
  };

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const next = [...digits];
    // paste หลายตัว → เติมต่อเนื่อง
    for (let i = 0; i < clean.length && index + i < 6; i++) {
      next[index + i] = clean[i];
    }
    setDigits(next);

    const filledTo = Math.min(index + clean.length, 5);
    inputs.current[filledTo]?.focus();

    const joined = next.join('');
    if (joined.length === 6 && !next.includes('')) submit(joined);
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const joined = digits.join('');
      if (joined.length === 6 && !digits.includes('')) submit(joined);
    }
  };

  const disabled = status === 'checking' || status === 'locked' || status === 'ok';

  return (
    <div className="w-full max-w-sm">
      <div className="glass accent-top reveal p-7">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-2xl shadow-lg shadow-emerald-500/30">
            ⬢
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            <span className="gradient-text">CE Vault</span>
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--muted)]">
            Premium AI Fintech Command Center
          </p>
          <p className="mt-4 text-xs text-[color:var(--muted)]">ใส่ PIN 6 หลักเพื่อเข้าใช้งาน</p>
        </div>

        <div className="mt-5 flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              disabled={disabled}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-label={`PIN หลักที่ ${i + 1}`}
              className={`h-12 w-11 rounded-xl border bg-black/40 text-center text-xl font-bold tabular-nums text-[color:var(--text)] transition focus:outline-none disabled:opacity-50 ${
                status === 'error' || status === 'locked' ?'border-rose-500/60 focus:border-rose-400' :'border-[color:var(--border)] focus:border-emerald-500/70'
              }`}
            />
          ))}
        </div>

        <div className="mt-4 min-h-[40px] text-center">
          {status === 'checking' && (
            <p className="text-sm text-[color:var(--muted)]">
              <span className="animate-pulse">กำลังตรวจสอบ…</span>
            </p>
          )}
          {status === 'ok' && <p className="text-sm text-emerald-400">✓ เข้าสู่ระบบสำเร็จ</p>}
          {message && status !== 'ok' && (
            <p className={`text-sm ${status === 'locked' ? 'text-amber-400' : 'text-rose-400'}`}>
              {message}
              {status === 'locked' && lockSeconds > 0 && (
                <>
                  <br />
                  <span className="tabular-nums">
                    ลองใหม่ได้ใน {Math.floor(lockSeconds / 60)}:
                    {String(lockSeconds % 60).padStart(2, '0')}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-[color:var(--muted)]">
        ระบบบันทึกธุรกรรม USDT Arbitrage / P2P
      </p>
    </div>
  );
}
