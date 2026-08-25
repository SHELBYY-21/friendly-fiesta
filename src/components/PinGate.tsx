'use client';

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
        setMessage('locked');
      } else if (res.status === 503) {
        window.location.href = nextPath;
        return;
      } else {
        setStatus('error');
        setMessage('wrong pin');
      }
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch {
      setStatus('error');
      setMessage('offline');
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

  return (
    <section className="card w-full max-w-sm text-center">
      <p className="text-2xl text-gold">◈</p>
      <h1 className="mt-4 text-sm tracking-[0.22em]">CT</h1>
      <p className="mt-2 text-xs text-muted">private desk</p>
      <div className="mt-8 flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            inputMode="numeric"
            maxLength={6}
            disabled={status === 'locked' || status === 'checking'}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
            }}
            className="field h-14 w-11 px-0 text-center text-xl"
            aria-label={`digit ${i + 1}`}
          />
        ))}
      </div>
      <p className="mt-5 min-h-5 text-sm text-muted">
        {status === 'checking' ? '…' : message}
        {status === 'locked' && lockSeconds > 0 ? ` ${lockSeconds}s` : ''}
      </p>
    </section>
  );
}
