import { authorized } from '@/lib/auth';
import { env } from '@/lib/runtime';

type VerificationRow = Record<string, string | number | null>;

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

/** Lists the latest structured verification events for one candidate. */
export async function GET(request: Request): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const candidateId = Number(new URL(request.url).searchParams.get('candidateId'));
  if (!Number.isInteger(candidateId) || candidateId < 1)
    return Response.json({ error: '无效产品编号' }, { status: 400 });
  const result = await db()
    .prepare(
      `SELECT id,verified_fields,source,verified_date,owner,created_at
       FROM data_verifications
       WHERE candidate_id=?
       ORDER BY verified_date DESC, id DESC
       LIMIT 50`,
    )
    .bind(candidateId)
    .all<VerificationRow>();
  return Response.json({
    verifications: result.results.map((row) => ({
      id: Number(row.id),
      fields: String(row.verified_fields ?? ''),
      source: String(row.source ?? ''),
      verifiedDate: String(row.verified_date ?? ''),
      owner: String(row.owner ?? ''),
      createdAt: String(row.created_at ?? ''),
    })),
  });
}
