'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

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
        setMessage('ใส่ผิดหลายครั้ง — รอแล้วค่อยลองใหม่');
      } else if (res.status === 503) {
        window.location.href = nextPath;
        return;
      } else {
        setStatus('error');
        setMessage('รหัสไม่ตรง ใส่ใหม่ 6 หลัก');
      }
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch {
      setStatus('error');
      setMessage('ต่อเน็ตไม่ได้ ตรวจสัญญาณแล้วใส่ใหม่');
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
    if (clean.length > 1) {
      clean.slice(0, 6).split('').forEach((ch, i) => {
        if (index + i < 6) next[index + i] = ch;
      });
      setDigits(next);
      const filled = next.join('');
      if (filled.length === 6) void submit(filled);
      else inputs.current[Math.min(index + clean.length, 5)]?.focus();
      return;
    }
    next[index] = clean;
    setDigits(next);
    if (index < 5) inputs.current[index + 1]?.focus();
    if (next.join('').length === 6) void submit(next.join(''));
  };

  const busy = status === 'locked' || status === 'checking';

  return (
    <section className="pin-gate" aria-labelledby="pin-gate-title">
      <span className="ce-mark">
        <Image src="/brand/ce-mark-512.png" width={48} height={48} alt="" priority unoptimized />
      </span>
      <h1 id="pin-gate-title">CE Vault</h1>
      <p>ใส่รหัส 6 หลักจากหัวหน้ากะ เพื่อเปิดโต๊ะ</p>
      <div className="pin-gate__row">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            disabled={busy}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
            }}
            className={'pin-gate__cell' + (status === 'error' ? ' is-bad' : '')}
            aria-invalid={status === 'error'}
            aria-label={`หลักที่ ${i + 1}`}
          />
        ))}
      </div>
      <p className={'pin-gate__hint' + (status === 'error' || status === 'locked' ? ' is-bad' : '')} role="status" aria-live="polite">
        {status === 'checking' ? 'กำลังเปิดโต๊ะ…' : message}
        {status === 'locked' && lockSeconds > 0 ? ` ${lockSeconds} วินาที` : ''}
      </p>
    </section>
  );
}
