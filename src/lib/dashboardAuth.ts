// PIN gate สำหรับหน้า dashboard
import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'ce_vault_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

function getSessionSecret(): string | null {
  const secret = process.env.DASHBOARD_SESSION_SECRET || process.env.API_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

export function getConfiguredPin(): string | null {
  const pin = process.env.DASHBOARD_PIN;
  if (!pin || !/^\d{6}$/.test(pin)) return null;
  return pin;
}

export function isAuthConfigured(): boolean {
  return getConfiguredPin() !== null && getSessionSecret() !== null;
}

export function verifyPin(input: string): boolean {
  const pin = getConfiguredPin();
  if (!pin) return false;
  if (!/^\d{6}$/.test(input)) return false;
  return constantTimeEqual(input, pin);
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

export async function createSessionToken(): Promise<string | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const json = JSON.stringify({ exp });
  const payload = toBase64Url(new TextEncoder().encode(json));
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const secret = getSessionSecret();
  if (!secret) return false;

  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = await sign(payload, secret);
  if (!constantTimeEqual(signature, expected)) return false;

  try {
    const decoded = JSON.parse(fromBase64Url(payload));
    const exp = Number(decoded?.exp);
    if (!Number.isFinite(exp)) return false;
    return exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') || 'unknown';
}

export async function requireDashboardSession(req: NextRequest): Promise<NextResponse | null> {
  if (!isAuthConfigured()) return null;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
