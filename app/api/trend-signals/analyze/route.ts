import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

type AiDecision = {
  id: number;
  verdict: '推荐' | '观察' | '忽略';
  score: number;
  reason: string;
};

async function authorized(): Promise<boolean> {
  const jar = await cookies();
  return jar.get('trendpilot_session')?.value === 'trendpilot-admin-v1';
}

function runtime(): {
  db: D1Database;
  apiKey?: string;
  model?: string;
} {
  const current = env as unknown as {
    DB: D1Database;
    SILICONFLOW_API_KEY?: string;
    AI_MODEL?: string;
  };
  return { db: current.DB, apiKey: current.SILICONFLOW_API_KEY, model: current.AI_MODEL };
}

function validDecision(value: unknown): value is AiDecision {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AiDecision>;
  return (
    Number.isInteger(item.id) &&
    ['推荐', '观察', '忽略'].includes(item.verdict ?? '') &&
    typeof item.score === 'number' &&
    typeof item.reason === 'string'
  );
}

/** Screens recent market signals without automatically creating candidates. */
export async function POST(): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const { db, apiKey, model } = runtime();
  if (!apiKey || !model)
    return Response.json({ error: '硅基流动尚未配置' }, { status: 503 });

  const result = await db
    .prepare(
      'SELECT id,keyword,market,traffic_text,traffic_value FROM trend_signals WHERE candidate_id IS NULL AND screened_at IS NULL ORDER BY captured_date DESC, traffic_value DESC, id DESC LIMIT 12',
    )
    .all<Record<string, unknown>>();
  if (!result.results.length)
    return Response.json({ analyzed: 0, message: '没有待筛选的市场信号' });

  const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content:
            '你是亚马逊美国站选品研究员。判断公开热搜词是否可能对应可销售、可供应链落地的实体消费品。娱乐人物、赛事、新闻、政治、纯软件和不可商品化事件应忽略。输出严格 JSON 对象，唯一字段 results 为数组；每项保留输入 id，verdict 只能是推荐、观察、忽略，score 为0到100整数，reason 为不超过30字中文理由。不要编造市场规模或竞争数据。',
        },
        { role: 'user', content: JSON.stringify(result.results) },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok)
    return Response.json({ error: `AI 筛选失败：${response.status}` }, { status: 502 });
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return Response.json({ error: 'AI 未返回筛选结果' }, { status: 502 });
  const parsed = JSON.parse(content) as unknown;
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { results?: unknown[] })?.results)
      ? (parsed as { results: unknown[] }).results
      : [];
  const allowedIds = new Set(result.results.map((row) => Number(row.id)));
  const decisions = raw.filter(validDecision).filter((item) => allowedIds.has(item.id));
  if (!decisions.length)
    return Response.json({ error: 'AI 筛选结果格式无效' }, { status: 502 });

  const screenedAt = new Date().toISOString();
  await db.batch(
    decisions.map((item) =>
      db
        .prepare(
          'UPDATE trend_signals SET ai_verdict=?,ai_score=?,ai_reason=?,screened_at=? WHERE id=?',
        )
        .bind(
          item.verdict,
          Math.min(100, Math.max(0, Math.round(item.score))),
          item.reason.slice(0, 120),
          screenedAt,
          item.id,
        ),
    ),
  );
  return Response.json({ analyzed: decisions.length });
}
