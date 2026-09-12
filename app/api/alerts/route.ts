import { env } from 'cloudflare:workers';
import { authorized } from '@/lib/auth';

type SnapshotPair = Record<string, string | number | null>;
type AlertLevel = 'high' | 'medium';
type AlertStatus = 'pending' | 'acknowledged' | 'resolved';

type MarketAlert = {
  id: string;
  candidateId: number;
  product: string;
  asin: string;
  market: string;
  level: AlertLevel;
  type: string;
  summary: string;
  detail: string;
  action: string;
  date: string;
  status: AlertStatus;
  note: string;
};

/** Converts stored currency-like values into comparable numbers. */
function numeric(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Returns a signed percentage change while protecting zero baselines. */
function percentChange(current: number, previous: number): number {
  return previous > 0 ? ((current - previous) / previous) * 100 : 0;
}

/** Produces actionable marketplace alerts from each product's latest snapshots. */
export async function GET() {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });

  const database = (env as unknown as { DB: D1Database }).DB;
  const [result, actionResult] = await Promise.all([
    database
      .prepare(
        `WITH ranked AS (
        SELECT candidate_id, captured_date, price, bsr, rating, reviews,
          search_volume, margin,
          ROW_NUMBER() OVER (
            PARTITION BY candidate_id ORDER BY captured_date DESC, id DESC
          ) AS snapshot_rank
        FROM candidate_snapshots
      )
      SELECT c.id, c.name, c.asin, c.market,
        curr.captured_date AS current_date,
        curr.price AS current_price, curr.bsr AS current_bsr,
        curr.rating AS current_rating, curr.reviews AS current_reviews,
        curr.search_volume AS current_search_volume, curr.margin AS current_margin,
        prev.captured_date AS previous_date,
        prev.price AS previous_price, prev.bsr AS previous_bsr,
        prev.rating AS previous_rating, prev.reviews AS previous_reviews,
        prev.search_volume AS previous_search_volume, prev.margin AS previous_margin
      FROM candidates c
      JOIN ranked curr ON curr.candidate_id = c.id AND curr.snapshot_rank = 1
      JOIN ranked prev ON prev.candidate_id = c.id AND prev.snapshot_rank = 2
      ORDER BY c.id DESC`,
      )
      .all<SnapshotPair>(),
    database
      .prepare('SELECT alert_key,status,note FROM alert_actions')
      .all<Record<string, string>>(),
  ]);
  const actions = new Map(
    actionResult.results.map((row) => [
      row.alert_key,
      { status: row.status as AlertStatus, note: row.note },
    ]),
  );

  const alerts: MarketAlert[] = [];
  const add = (
    row: SnapshotPair,
    key: string,
    level: AlertLevel,
    type: string,
    summary: string,
    detail: string,
    action: string,
  ) => {
    const id = `${row.id}-${row.current_date}-${key}`;
    const disposition = actions.get(id);
    alerts.push({
      id,
      candidateId: Number(row.id),
      product: String(row.name),
      asin: String(row.asin ?? ''),
      market: String(row.market),
      level,
      type,
      summary,
      detail,
      action,
      date: String(row.current_date),
      status: disposition?.status ?? 'pending',
      note: disposition?.note ?? '',
    });
  };

  for (const row of result.results) {
    const searchChange = percentChange(
      Number(row.current_search_volume),
      Number(row.previous_search_volume),
    );
    const bsrChange = percentChange(
      Number(row.current_bsr),
      Number(row.previous_bsr),
    );
    const priceChange = percentChange(
      numeric(row.current_price),
      numeric(row.previous_price),
    );
    const ratingDrop = Number(row.previous_rating) - Number(row.current_rating);
    const reviewChange = percentChange(
      Number(row.current_reviews),
      Number(row.previous_reviews),
    );
    const marginDrop = Number(row.previous_margin) - Number(row.current_margin);

    if (searchChange >= 20)
      add(
        row,
        'demand',
        'high',
        '需求突增',
        `搜索量上升 ${searchChange.toFixed(1)}%`,
        `${row.previous_search_volume} → ${row.current_search_volume}`,
        '核验核心关键词来源，优先安排样品和供应链报价。',
      );
    if (bsrChange >= 25)
      add(
        row,
        'bsr',
        'medium',
        '排名恶化',
        `BSR 上升 ${bsrChange.toFixed(1)}%`,
        `${row.previous_bsr} → ${row.current_bsr}（数值越低越好）`,
        '检查竞品促销、断货和类目流量变化，暂缓扩大备货。',
      );
    if (priceChange <= -15)
      add(
        row,
        'price',
        'high',
        '价格战',
        `售价下降 ${Math.abs(priceChange).toFixed(1)}%`,
        `${row.previous_price} → ${row.current_price}`,
        '重算到岸成本和广告容错，确认目标毛利仍可实现。',
      );
    if (ratingDrop >= 0.3)
      add(
        row,
        'rating',
        'high',
        '口碑下滑',
        `评分下降 ${ratingDrop.toFixed(1)}`,
        `${row.previous_rating} → ${row.current_rating}`,
        '立即抽查新增差评，确认是否出现结构性质量问题。',
      );
    if (reviewChange >= 15)
      add(
        row,
        'reviews',
        'medium',
        '竞品加速',
        `评论量增长 ${reviewChange.toFixed(1)}%`,
        `${row.previous_reviews} → ${row.current_reviews}`,
        '复核头部竞品投放与促销动作，调整差异化进入策略。',
      );
    if (marginDrop >= 5)
      add(
        row,
        'margin',
        'high',
        '毛利承压',
        `毛利率下降 ${marginDrop.toFixed(1)} 个百分点`,
        `${row.previous_margin}% → ${row.current_margin}%`,
        '重新核算采购、物流和广告成本，未达底线则暂停推进。',
      );
  }

  alerts.sort((left, right) =>
    left.level === right.level ? 0 : left.level === 'high' ? -1 : 1,
  );
  return Response.json({
    alerts,
    summary: {
      high: alerts.filter(
        (alert) => alert.level === 'high' && alert.status !== 'resolved',
      ).length,
      medium: alerts.filter(
        (alert) => alert.level === 'medium' && alert.status !== 'resolved',
      ).length,
      pending: alerts.filter((alert) => alert.status === 'pending').length,
      comparedProducts: result.results.length,
    },
  });
}

/** Saves an alert's workflow status and concise processing note. */
export async function PATCH(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const body = (await request.json()) as {
    id?: unknown;
    status?: unknown;
    note?: unknown;
  };
  const id = String(body.id ?? '').trim();
  const status = String(body.status ?? '') as AlertStatus;
  const note = String(body.note ?? '')
    .trim()
    .slice(0, 500);
  if (!id || !['pending', 'acknowledged', 'resolved'].includes(status))
    return Response.json({ error: '预警状态无效' }, { status: 400 });

  const database = (env as unknown as { DB: D1Database }).DB;
  await database
    .prepare(
      `INSERT INTO alert_actions (alert_key,status,note,updated_at)
       VALUES (?,?,?,?)
       ON CONFLICT(alert_key) DO UPDATE SET
         status=excluded.status,note=excluded.note,updated_at=excluded.updated_at`,
    )
    .bind(id, status, note, new Date().toISOString())
    .run();
  return Response.json({ ok: true, id, status, note });
}
