import { env } from '@/lib/runtime';
import { authorized } from '@/lib/auth';

/** Lists one candidate's numeric history for a bounded reporting period. */
export async function GET(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const url = new URL(request.url);
  const candidateId = Number(url.searchParams.get('candidateId'));
  const requestedDays = Number(url.searchParams.get('days'));
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  if (!Number.isInteger(candidateId) || candidateId < 1)
    return Response.json({ error: '无效产品编号' }, { status: 400 });
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const database = (env as unknown as { DB: D1Database }).DB;
  const result = await database
    .prepare(
      'SELECT captured_date,price,bsr,rating,reviews,review_growth,search_volume,trend,revenue,margin FROM candidate_snapshots WHERE candidate_id=? AND captured_date>=? ORDER BY captured_date ASC',
    )
    .bind(candidateId, since)
    .all<Record<string, unknown>>();
  return Response.json({
    snapshots: result.results.map((row) => ({
      date: row.captured_date,
      price: row.price,
      bsr: row.bsr,
      rating: row.rating,
      reviews: row.reviews,
      reviewGrowth: row.review_growth,
      searchVolume: row.search_volume,
      trend: row.trend,
      revenue: row.revenue,
      margin: row.margin,
    })),
  });
}
