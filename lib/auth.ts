import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'trendpilot_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function config(): { username?: string; password?: string; secret?: string } {
  const runtime = env as unknown as {
    AUTH_USERNAME?: string;
    AUTH_PASSWORD?: string;
    SESSION_SECRET?: string;
  };
  return {
    username: runtime.AUTH_USERNAME,
    password: runtime.AUTH_PASSWORD,
    secret: runtime.SESSION_SECRET,
  };
}

function encode(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function signature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return encode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

/** Validates credentials stored only in the hosted runtime environment. */
export function validCredentials(username: string, password: string): boolean {
  const current = config();
  if (!current.username || !current.password) return false;
  return safeEqual(username, current.username) && safeEqual(password, current.password);
}

/** Creates a signed, time-limited administrator session token. */
export async function createSessionToken(): Promise<string> {
  const { secret } = config();
  if (!secret || secret.length < 32) throw new Error('会话密钥未配置');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin.${expiresAt}`;
  return `${payload}.${await signature(payload, secret)}`;
}

/** Verifies the current signed administrator session and its expiry. */
export async function authorized(): Promise<boolean> {
  const { secret } = config();
  if (!secret || secret.length < 32) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const [role, expiry, suppliedSignature] = token.split('.');
  if (role !== 'admin' || !expiry || !suppliedSignature) return false;
  const expiresAt = Number(expiry);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000))
    return false;
  const expected = await signature(`${role}.${expiry}`, secret);
  return safeEqual(suppliedSignature, expected);
}

/** Returns the secure cookie lifetime shared by login and validation. */
export function sessionMaxAge(): number {
  return SESSION_TTL_SECONDS;
}
