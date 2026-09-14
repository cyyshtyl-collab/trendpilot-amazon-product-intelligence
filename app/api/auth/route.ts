import { cookies } from 'next/headers';
import { env } from 'cloudflare:workers';
import {
  authenticateUser,
  authorized,
  createSessionToken,
  SESSION_COOKIE,
  sessionMaxAge,
} from '@/lib/auth';

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

/** Returns whether the current request owns a valid administrator session. */
export async function GET() {
  return Response.json({ authenticated: await authorized() });
}

/** Validates administrator credentials and creates an HTTP-only session. */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };
  const identity = await authenticateUser(
    db(),
    body.username?.trim() ?? '',
    body.password ?? '',
  );
  if (!identity) {
    return Response.json({ error: '账号或密码不正确' }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(identity), {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: sessionMaxAge(),
  });
  return Response.json({ authenticated: true, username: identity.username, role: identity.role });
}

/** Clears the current administrator session. */
export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return Response.json({ authenticated: false });
}
