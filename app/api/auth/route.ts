import { cookies } from 'next/headers';

const COOKIE_NAME = 'trendpilot_session';
const SESSION_VALUE = 'trendpilot-admin-v1';

/** Returns whether the current request owns a valid administrator session. */
export async function GET() {
  const jar = await cookies();
  return Response.json({
    authenticated: jar.get(COOKIE_NAME)?.value === SESSION_VALUE,
  });
}

/** Validates administrator credentials and creates an HTTP-only session. */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    username?: string;
    password?: string;
  };
  if (body.username !== 'admin' || body.password !== 'admin000000') {
    return Response.json({ error: '账号或密码不正确' }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(COOKIE_NAME, SESSION_VALUE, {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return Response.json({ authenticated: true });
}

/** Clears the current administrator session. */
export async function DELETE() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  return Response.json({ authenticated: false });
}
