import { env } from '@/lib/runtime';
import { authorized } from '@/lib/auth';

/** Lists recent AI analysis executions without exposing credentials or prompts. */
export async function GET() {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const database = (env as unknown as { DB: D1Database }).DB;
  const result = await database
    .prepare(
      'SELECT id,provider,model,requested,succeeded,fallback,duration_ms,error_message,status,created_at FROM analysis_runs ORDER BY id DESC LIMIT 20',
    )
    .all<Record<string, unknown>>();
  return Response.json({
    runs: result.results.map((row) => ({
      id: row.id,
      provider: row.provider,
      model: row.model,
      requested: row.requested,
      succeeded: row.succeeded,
      fallback: row.fallback,
      durationMs: row.duration_ms,
      errorMessage: row.error_message,
      status: row.status,
      createdAt: row.created_at,
    })),
  });
}
