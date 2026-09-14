import { env } from '@/lib/runtime';
import { authorized } from '@/lib/auth';

/** Reports AI readiness without exposing any secret value. */
export async function GET() {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const runtime = env as unknown as {
    AI_PROVIDER?: string;
    AI_MODEL?: string;
    OPENAI_API_KEY?: string;
    SILICONFLOW_API_KEY?: string;
  };
  const provider =
    runtime.AI_PROVIDER === 'siliconflow' ? 'SiliconFlow' : 'OpenAI';
  const apiKey =
    provider === 'SiliconFlow'
      ? runtime.SILICONFLOW_API_KEY
      : runtime.OPENAI_API_KEY;
  return Response.json({
    configured: Boolean(apiKey && runtime.AI_MODEL),
    provider,
    model: runtime.AI_MODEL || null,
  });
}
