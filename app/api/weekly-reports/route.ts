import { env } from '@/lib/runtime';
import { authorized, authorizedAdmin } from '@/lib/auth';
import {
  averageKnown,
  rankDecisionCandidates,
  type DecisionCandidateInput,
  type RankedDecisionCandidate,
} from '@/lib/decision-report';

type CandidateRow = DecisionCandidateInput & { sellingPoint: string };

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

function weekStart(): string {
  const today = new Date();
  const day = today.getUTCDay() || 7;
  today.setUTCDate(today.getUTCDate() - day + 1);
  return today.toISOString().slice(0, 10);
}

function buildMarkdown(
  rows: RankedDecisionCandidate<CandidateRow>[],
  week: string,
): string {
  const highPotential = rows.filter((item) => item.verdict === '通过');
  const watch = rows.filter((item) => item.verdict === '观察');
  const shortlist = rows.filter((item) => item.verdict !== '淘汰').slice(0, 10);
  const table = shortlist
    .map(
      (item, index) =>
        `| ${index + 1} | ${item.name} | ${item.asin} | ${item.category} | ${item.score}/25 | ${item.decisionScore}/100 | ${item.rating} | ${item.reviews} | ${item.verdict} |`,
    )
    .join('\n');
  const sellingPoints = highPotential
    .slice(0, 5)
    .map(
      (item) =>
        `- **${item.name}**：${item.sellingPoint || '等待 AI 生成卖点'}`,
    )
    .join('\n');
  return [
    '# TrendPilot 亚马逊选品周报',
    '',
    `周期开始：${week}`,
    '',
    '## 管理摘要',
    '',
    `- 最终决策产品：${rows.length} 个`,
    `- 建议推进：${highPotential.length} 个`,
    `- 继续观察：${watch.length} 个`,
    `- 趋势平均值：${averageKnown(rows.map((item) => item.trend)).toFixed(1)}%`,
    `- 毛利率平均值：${averageKnown(rows.map((item) => item.margin)).toFixed(1)}%`,
    '',
    '> 口径：仅统计具有有效 ASIN，且价格、BSR、评分、评论数、趋势和毛利全部具备真实数据的商品。',
    '',
    '## 优先候选',
    '',
    '| 排名 | 产品 | ASIN | 类目 | AI 评分 | 决策分 | 评分 | 评论数 | 结论 |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
    table || '| - | 暂无最终评分就绪商品 | - | - | - | - | - | - | - |',
    '',
    '## Selling Point 初稿',
    '',
    sellingPoints || '- 暂无通过产品',
    '',
    '## 本周行动',
    '',
    '1. 优先核验决策分最高商品的供应链报价、包装尺寸和合规要求。',
    '2. 为缺少趋势、关键词或毛利数据的候选补采真实数据。',
    '3. 观察候选继续追踪一个采集周期，暂缓备货。',
    '',
  ].join('\n');
}

/** Lists saved weekly decision reports. */
export async function GET(): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const result = await db()
    .prepare(
      'SELECT id,week_start,title,markdown,tracked_count,high_potential_count,watch_count,alert_count,status,created_at,updated_at FROM weekly_reports ORDER BY week_start DESC LIMIT 12',
    )
    .all<Record<string, unknown>>();
  return Response.json({
    reports: result.results.map((row) => ({
      id: row.id,
      weekStart: row.week_start,
      title: row.title,
      markdown: row.markdown,
      trackedCount: row.tracked_count,
      highPotentialCount: row.high_potential_count,
      watchCount: row.watch_count,
      alertCount: row.alert_count,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

/** Generates or refreshes the current week's persisted management report. */
export async function POST(): Promise<Response> {
  if (!(await authorizedAdmin()))
    return Response.json({ error: '仅管理员可生成正式周报' }, { status: 403 });
  const candidates = await db()
    .prepare(
      "SELECT id,name,asin,category,market,score,verdict,trend,margin,price,bsr,rating,reviews,search_volume,selling_point FROM candidates WHERE asin IS NOT NULL ORDER BY score DESC,id DESC",
    )
    .all<Record<string, unknown>>();
  const normalized = candidates.results.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    asin: String(row.asin),
    category: String(row.category),
    market: String(row.market),
    score: Number(row.score),
    verdict: String(row.verdict),
    trend: Number(row.trend),
    margin: Number(row.margin),
    price: String(row.price),
    bsr: Number(row.bsr),
    rating: Number(row.rating),
    reviews: Number(row.reviews),
    searchVolume: Number(row.search_volume),
    sellingPoint: String(row.selling_point ?? ''),
  })) satisfies CandidateRow[];
  const rows = rankDecisionCandidates(normalized);
  const week = weekStart();
  const now = new Date().toISOString();
  const markdown = buildMarkdown(rows, week);
  const highPotentialCount = rows.filter(
    (item) => item.verdict === '通过',
  ).length;
  const watchCount = rows.filter((item) => item.verdict === '观察').length;
  await db()
    .prepare(
      'INSERT INTO weekly_reports (week_start,title,markdown,tracked_count,high_potential_count,watch_count,alert_count,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(week_start) DO UPDATE SET title=excluded.title,markdown=excluded.markdown,tracked_count=excluded.tracked_count,high_potential_count=excluded.high_potential_count,watch_count=excluded.watch_count,alert_count=excluded.alert_count,status=excluded.status,updated_at=excluded.updated_at',
    )
    .bind(
      week,
      `亚马逊选品周报 · ${week}`,
      markdown,
      rows.length,
      highPotentialCount,
      watchCount,
      0,
      'ready',
      now,
      now,
    )
    .run();
  return Response.json({ generated: true, weekStart: week });
}
