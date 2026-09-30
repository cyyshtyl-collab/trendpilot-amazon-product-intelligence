import { env } from '@/lib/runtime';
import {
  type GoogleTrendItem,
  fetchGoogleTrends,
  normalizeTrendGeo,
  persistGoogleTrends,
} from '@/lib/google-trends';
import { verifyTrendIngestSignature } from '@/lib/trend-ingest-signature';

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

function automationAuthorized(request: Request): boolean {
  const secret = (env as unknown as { AUTOMATION_SECRET?: string })
    .AUTOMATION_SECRET;
  if (!secret || secret.length < 32) return false;
  const supplied = request.headers.get('authorization');
  return supplied === `Bearer ${secret}`;
}

/** Runs the protected, idempotent daily trend collection used by the scheduler. */
export async function GET(request: Request): Promise<Response> {
  if (!automationAuthorized(request)) {
    return Response.json({ error: '未授权' }, { status: 401 });
  }
  const geo = normalizeTrendGeo(
    new URL(request.url).searchParams.get('geo') ?? 'US',
  );
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db()
    .prepare(
      "SELECT id,finished_at FROM source_runs WHERE source='Google Trends' AND market=? AND status='success' AND substr(finished_at,1,10)=? ORDER BY id DESC LIMIT 1",
    )
    .bind(geo, today)
    .first<{ id: number; finished_at: string }>();
  if (existing) {
    return Response.json(
      {
        ok: true,
        skipped: true,
        reason: 'today_already_collected',
        finishedAt: existing.finished_at,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const startedAt = new Date().toISOString();
  try {
    const items = await fetchGoogleTrends(geo);
    const finishedAt = await persistGoogleTrends(db(), geo, items, startedAt);
    return Response.json(
      { ok: true, skipped: false, geo, itemCount: items.length, finishedAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 500) : '未知错误';
    const finishedAt = new Date().toISOString();
    await db()
      .prepare(
        'INSERT INTO source_runs (source,market,status,item_count,error_message,started_at,finished_at) VALUES (?,?,?,?,?,?,?)',
      )
      .bind('Google Trends', geo, 'failed', 0, message, startedAt, finishedAt)
      .run();
    return Response.json({ ok: false, error: '采集失败' }, { status: 502 });
  }
}

type SignedTrendPayload = {
  geo?: string;
  fetchedAt?: string;
  items?: Array<Partial<GoogleTrendItem>>;
};

/** Accepts a short-lived, signed Google Trends collection from GitHub Actions. */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-trendpilot-timestamp') ?? '';
  const signature = request.headers.get('x-trendpilot-signature') ?? '';
  if (!verifyTrendIngestSignature(rawBody, { timestamp, signature }))
    return Response.json({ error: '签名无效或已过期' }, { status: 401 });

  let body: SignedTrendPayload;
  try {
    body = JSON.parse(rawBody) as SignedTrendPayload;
  } catch {
    return Response.json({ error: '数据格式无效' }, { status: 400 });
  }
  const geo = normalizeTrendGeo(body.geo);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100)
    return Response.json({ error: '趋势条目必须为 1–100 条' }, { status: 400 });
  const items: GoogleTrendItem[] = [];
  for (const item of body.items) {
    const keyword = String(item.keyword ?? '').trim().slice(0, 200);
    const traffic = String(item.traffic ?? '').trim().slice(0, 40);
    const publishedAt = String(item.publishedAt ?? '').trim().slice(0, 120);
    if (!keyword || !traffic || !publishedAt)
      return Response.json({ error: '趋势条目字段不完整' }, { status: 400 });
    items.push({ keyword, traffic, publishedAt, source: 'Google Trends' });
  }
  const fetchedAt = Date.parse(String(body.fetchedAt ?? ''));
  const startedAt = Number.isFinite(fetchedAt)
    ? new Date(fetchedAt).toISOString()
    : new Date().toISOString();
  const finishedAt = await persistGoogleTrends(db(), geo, items, startedAt);
  return Response.json(
    { ok: true, geo, itemCount: items.length, finishedAt, transport: 'github' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
