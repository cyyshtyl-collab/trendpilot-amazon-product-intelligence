import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

/** Reports AI readiness without exposing any secret value. */
export async function GET() {
  const jar = await cookies();
  if (jar.get('trendpilot_session')?.value !== 'trendpilot-admin-v1')
    return Response.json({ error: '未登录' }, { status: 401 });
  const runtime = env as unknown as {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
  };
  return Response.json({
    configured: Boolean(runtime.OPENAI_API_KEY && runtime.OPENAI_MODEL),
    provider: 'OpenAI',
    model: runtime.OPENAI_MODEL || null,
  });
}
