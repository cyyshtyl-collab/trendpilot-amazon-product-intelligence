import { env } from '@/lib/runtime';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'trendpilot_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const PASSWORD_ITERATIONS = 100_000;

export type UserIdentity = { username: string; role: 'admin' | 'member' };

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
function validAdminCredentials(username: string, password: string): boolean {
  const current = config();
  if (!current.username || !current.password) return false;
  return safeEqual(username, current.username) && safeEqual(password, current.password);
}

async function verifyPassword(password: string, saltHex: string, hashHex: string): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{64}$/i.test(hashHex)) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(saltHex),
      iterations: PASSWORD_ITERATIONS,
    },
    key,
    256,
  );
  return safeEqual(
    [...new Uint8Array(derived)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    hashHex.toLowerCase(),
  );
}

/** Authenticates either the environment administrator or an active internal member. */
export async function authenticateUser(
  database: D1Database,
  username: string,
  password: string,
): Promise<UserIdentity | null> {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(normalized) || password.length > 128) return null;
  if (validAdminCredentials(normalized, password)) return { username: normalized, role: 'admin' };
  const user = await database
    .prepare(
      "SELECT username,password_hash,password_salt,role FROM app_users WHERE username=? AND status='active' LIMIT 1",
    )
    .bind(normalized)
    .first<{ username: string; password_hash: string; password_salt: string; role: string }>();
  if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) return null;
  return { username: user.username, role: user.role === 'admin' ? 'admin' : 'member' };
}

/** Creates a signed, time-limited administrator session token. */
export async function createSessionToken(identity: UserIdentity): Promise<string> {
  const { secret } = config();
  if (!secret || secret.length < 32) throw new Error('会话密钥未配置');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${identity.role}.${identity.username}.${expiresAt}`;
  return `${payload}.${await signature(payload, secret)}`;
}

/** Verifies the current signed administrator session and its expiry. */
export async function authorized(): Promise<boolean> {
  const { secret } = config();
  if (!secret || secret.length < 32) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const [role, username, expiry, suppliedSignature] = token.split('.');
  if (!['admin', 'member'].includes(role) || !username || !expiry || !suppliedSignature) return false;
  const expiresAt = Number(expiry);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000))
    return false;
  const expected = await signature(`${role}.${username}.${expiry}`, secret);
  return safeEqual(suppliedSignature, expected);
}

/** Returns the secure cookie lifetime shared by login and validation. */
export function sessionMaxAge(): number {
  return SESSION_TTL_SECONDS;
}
