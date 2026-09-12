import { env } from 'cloudflare:workers';
import { authorized } from '@/lib/auth';

type CandidateRow = {
  id: number;
  name: string;
  category: string;
  market: string;
  score: number;
  verdict: string;
  trend: number;
  margin: number;
  selling_point: string;
};

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

function weekStart(): string {
  const today = new Date();
  const day = today.getUTCDay() || 7;
  today.setUTCDate(today.getUTCDate() - day + 1);
  return today.toISOString().slice(0, 10);
}

function deduplicateRows(rows: CandidateRow[]): CandidateRow[] {
  const unique = new Map<string, CandidateRow>();
  for (const row of rows) {
    const key = `${row.market}|${row.name.trim().toLocaleLowerCase('zh-CN')}`;
    const current = unique.get(key);
    if (!current || row.score > current.score || (row.score === current.score && row.id > current.id)) {
      unique.set(key, row);
    }
  }
  return [...unique.values()].sort(
    (left, right) => right.score - left.score || right.id - left.id,
  );
}

function buildMarkdown(rows: CandidateRow[], week: string): string {
  const highPotential = rows.filter((item) => item.verdict === '通过');
  const watch = rows.filter((item) => item.verdict === '观察');
  const shortlist = rows.filter((item) => item.verdict !== '淘汰').slice(0, 10);
  const table = shortlist
    .map(
      (item, index) =>
        `| ${index + 1} | ${item.name} | ${item.category} | ${item.market} | ${item.score}/25 | ${item.trend}% | ${item.margin}% | ${item.verdict} |`,
    )
    .join('\n');
  const sellingPoints = highPotential
    .slice(0, 5)
    .map((item) => `- **${item.name}**：${item.selling_point || '等待 AI 生成卖点'}`)
    .join('\n');
  return `# TrendPilot 亚马逊选品周报\n\n周期开始：${week}\n\n## 管理摘要\n\n- 追踪产品：${rows.length} 个\n- 建议推进：${highPotential.length} 个\n- 继续观察：${watch.length} 个\n- 建议淘汰：${rows.filter((item) => item.verdict === '淘汰').length} 个\n\n## 优先候选\n\n| 排名 | 产品 | 类目 | 站点 | 评分 | 趋势 | 毛利率 | 结论 |\n| --- | --- | --- | --- | ---: | ---: | ---: | --- |\n${table || '| - | 暂无候选 | - | - | - | - | - | - |'}\n\n## Selling Point 初稿\n\n${sellingPoints || '- 暂无通过产品'}\n\n## 本周行动\n\n1. 为高分候选核验供应链报价、包装尺寸和合规要求。\n2. 为观察候选补充 Amazon 评论和关键词数据。\n3. 对趋势转弱或毛利不足的候选暂停投入。\n`;
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
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const candidates = await db()
    .prepare(
      "SELECT id,name,category,market,score,verdict,trend,margin,selling_point FROM candidates WHERE category<>'待归类' OR asin IS NOT NULL ORDER BY score DESC,id DESC",
    )
    .all<CandidateRow>();
  const rows = deduplicateRows(candidates.results);
  const week = weekStart();
  const now = new Date().toISOString();
  const markdown = buildMarkdown(rows, week);
  const highPotentialCount = rows.filter((item) => item.verdict === '通过').length;
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
