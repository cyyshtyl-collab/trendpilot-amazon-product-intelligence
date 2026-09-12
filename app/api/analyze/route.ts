import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

type CandidateRow = {
  id: number;
  name: string;
  category: string;
  trend: number;
  reviews: number;
  margin: number;
  review_text: string;
};

type Analysis = {
  scores: [number, number, number, number, number];
  score: number;
  verdict: '通过' | '观察' | '淘汰';
  signals: string[];
  pains: string[];
  sellingPoint: string;
};

type OpenAIResponse = {
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};
type SiliconFlowResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

async function authorized(): Promise<boolean> {
  const jar = await cookies();
  return jar.get('trendpilot_session')?.value === 'trendpilot-admin-v1';
}

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

function clampScore(value: number): number {
  return Math.min(5, Math.max(1, value));
}

function runtimeConfig(): {
  provider: 'openai' | 'siliconflow';
  apiKey?: string;
  model?: string;
} {
  const runtime = env as unknown as {
    AI_PROVIDER?: string;
    AI_MODEL?: string;
    OPENAI_API_KEY?: string;
    SILICONFLOW_API_KEY?: string;
  };
  const provider =
    runtime.AI_PROVIDER === 'siliconflow' ? 'siliconflow' : 'openai';
  return {
    provider,
    apiKey:
      provider === 'siliconflow'
        ? runtime.SILICONFLOW_API_KEY
        : runtime.OPENAI_API_KEY,
    model: runtime.AI_MODEL,
  };
}

/** Requests one structured result from SiliconFlow's compatible chat API. */
async function analyzeWithSiliconFlow(
  candidate: CandidateRow,
): Promise<Analysis> {
  const { apiKey, model } = runtimeConfig();
  if (!apiKey || !model) throw new Error('硅基流动未配置');
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      scores: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: { type: 'integer', minimum: 1, maximum: 5 },
      },
      score: { type: 'integer', minimum: 5, maximum: 25 },
      verdict: { type: 'string', enum: ['通过', '观察', '淘汰'] },
      signals: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        items: { type: 'string' },
      },
      pains: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: { type: 'string' },
      },
      sellingPoint: { type: 'string' },
    },
    required: [
      'scores',
      'score',
      'verdict',
      'signals',
      'pains',
      'sellingPoint',
    ],
  };
  const response = await fetch(
    'https://api.siliconflow.cn/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              '你是亚马逊选品分析师。只能依据输入数据评分，不得编造评论证据。五项评分依次为需求真实性、竞争可切入度、差异化空间、供应链可控性、双线协同性，每项1到5分。Selling Point 必须是克制、合规的英文短句。请严格输出指定 JSON。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              product: candidate.name,
              category: candidate.category,
              trendPercent: candidate.trend,
              reviewCount: candidate.reviews,
              marginPercent: candidate.margin,
              negativeReviews: candidate.review_text.slice(0, 12000),
            }),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'amazon_product_analysis',
            strict: true,
            schema,
          },
        },
        temperature: 0.2,
      }),
    },
  );
  if (!response.ok) throw new Error(`硅基流动请求失败：${response.status}`);
  const data = (await response.json()) as SiliconFlowResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('硅基流动没有返回结构化结果');
  const parsed = JSON.parse(content) as Analysis;
  if (!Array.isArray(parsed.scores) || parsed.scores.length !== 5)
    throw new Error('模型评分格式无效');
  parsed.scores = parsed.scores.map(clampScore) as Analysis['scores'];
  parsed.score = parsed.scores.reduce((sum, value) => sum + value, 0);
  parsed.verdict =
    parsed.score >= 18 ? '通过' : parsed.score >= 15 ? '观察' : '淘汰';
  return parsed;
}

/** Requests one evidence-grounded scoring result from the configured OpenAI model. */
async function analyzeWithOpenAI(candidate: CandidateRow): Promise<Analysis> {
  const { apiKey, model } = runtimeConfig();
  if (!apiKey || !model) throw new Error('AI 未配置');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions:
        '你是亚马逊选品分析师。只能依据输入数据评分，不得编造评论证据。五项评分依次为需求真实性、竞争可切入度、差异化空间、供应链可控性、双线协同性，每项1到5分。Selling Point 必须是克制、合规的英文短句。',
      input: JSON.stringify({
        product: candidate.name,
        category: candidate.category,
        trendPercent: candidate.trend,
        reviewCount: candidate.reviews,
        marginPercent: candidate.margin,
        negativeReviews: candidate.review_text.slice(0, 12000),
      }),
      text: {
        format: {
          type: 'json_schema',
          name: 'amazon_product_analysis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              scores: {
                type: 'array',
                minItems: 5,
                maxItems: 5,
                items: { type: 'integer', minimum: 1, maximum: 5 },
              },
              score: { type: 'integer', minimum: 5, maximum: 25 },
              verdict: { type: 'string', enum: ['通过', '观察', '淘汰'] },
              signals: {
                type: 'array',
                minItems: 2,
                maxItems: 5,
                items: { type: 'string' },
              },
              pains: {
                type: 'array',
                minItems: 1,
                maxItems: 5,
                items: { type: 'string' },
              },
              sellingPoint: { type: 'string' },
            },
            required: [
              'scores',
              'score',
              'verdict',
              'signals',
              'pains',
              'sellingPoint',
            ],
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI 请求失败：${response.status}`);
  const data = (await response.json()) as OpenAIResponse;
  const text = data.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === 'output_text')?.text;
  if (!text) throw new Error('模型没有返回结构化结果');
  const parsed = JSON.parse(text) as Analysis;
  if (!Array.isArray(parsed.scores) || parsed.scores.length !== 5)
    throw new Error('模型评分格式无效');
  parsed.scores = parsed.scores.map(clampScore) as Analysis['scores'];
  parsed.score = parsed.scores.reduce((sum, value) => sum + value, 0);
  parsed.verdict =
    parsed.score >= 18 ? '通过' : parsed.score >= 15 ? '观察' : '淘汰';
  return parsed;
}

/** Produces an explainable pre-score from collected market facts. */
function analyze(candidate: CandidateRow): Analysis {
  const demand = clampScore(
    candidate.trend >= 30
      ? 5
      : candidate.trend >= 15
        ? 4
        : candidate.trend >= 5
          ? 3
          : candidate.trend >= 0
            ? 2
            : 1,
  );
  const competition = clampScore(
    candidate.reviews <= 300
      ? 5
      : candidate.reviews <= 800
        ? 4
        : candidate.reviews <= 1500
          ? 3
          : candidate.reviews <= 3000
            ? 2
            : 1,
  );
  const differentiation = clampScore(
    candidate.trend >= 15 && candidate.reviews <= 800
      ? 5
      : candidate.trend >= 5 && candidate.reviews <= 1500
        ? 4
        : candidate.reviews > 3000
          ? 2
          : 3,
  );
  const supply = clampScore(
    candidate.margin >= 40
      ? 5
      : candidate.margin >= 32
        ? 4
        : candidate.margin >= 25
          ? 3
          : candidate.margin >= 18
            ? 2
            : 1,
  );
  const categoryText = `${candidate.category}${candidate.name}`;
  const brand = /宠物|旅行|收纳|办公|咖啡|家居/.test(categoryText) ? 4 : 3;
  const scores = [
    demand,
    competition,
    differentiation,
    supply,
    brand,
  ] as Analysis['scores'];
  const score = scores.reduce((sum, value) => sum + value, 0);
  const verdict = score >= 18 ? '通过' : score >= 15 ? '观察' : '淘汰';
  const reviewSamples = candidate.review_text
    .split(/\r?\n|\|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
  const evidenceRules: Array<[RegExp, string]> = [
    [/break|broke|broken|脱落|断裂|损坏/i, '结构耐用性不足'],
    [/smell|odor|异味|气味/i, '材质或包装存在异味'],
    [/clean|wash|清洗|难洗|污渍/i, '清洁维护不便'],
    [/size|small|large|尺寸|太小|太大/i, '尺寸或适配描述不清'],
    [/leak|漏水|渗漏/i, '密封性能不稳定'],
    [/slip|滑动|吸盘|防滑/i, '固定或防滑能力不足'],
  ];
  const evidencePains = evidenceRules
    .filter(([pattern]) => reviewSamples.some((review) => pattern.test(review)))
    .map(([, pain]) => pain)
    .slice(0, 3);
  const categoryPain = /宠物/.test(categoryText)
    ? ['耐咬与清洁便利性待验证', '不同体型适配可能产生退货']
    : /厨房|咖啡/.test(categoryText)
      ? ['食品接触材质与异味风险', '清洁死角可能影响复购']
      : /旅行|收纳/.test(categoryText)
        ? ['满载耐用性与空间效率待验证', '尺寸描述不清可能引发退货']
        : ['核心使用场景仍需评论验证', '结构耐久性与包装运输待验证'];
  return {
    scores,
    score,
    verdict,
    signals: [
      `近周期趋势 ${candidate.trend >= 0 ? '增长' : '回落'} ${Math.abs(candidate.trend)}%`,
      `竞争样本累计 ${candidate.reviews} 条评论`,
      `预估毛利率 ${candidate.margin}%`,
      reviewSamples.length
        ? `已读取 ${reviewSamples.length} 条差评证据`
        : '尚未导入差评原文',
    ],
    pains: evidencePains.length ? evidencePains : categoryPain,
    sellingPoint: evidencePains.length
      ? `Built to address the everyday details buyers notice most in ${candidate.name}.`
      : `Designed around the details buyers expect from ${candidate.name}.`,
  };
}

/** Runs explainable scoring for selected records or the complete candidate pool. */
export async function POST(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const body = (await request.json()) as { ids?: number[] };
  const ids = Array.isArray(body.ids)
    ? [
        ...new Set(body.ids.filter((id) => Number.isInteger(id) && id > 0)),
      ].slice(0, 200)
    : [];
  const query = ids.length
    ? db()
        .prepare(
          `SELECT id,name,category,trend,reviews,margin,review_text FROM candidates WHERE id IN (${ids.map(() => '?').join(',')})`,
        )
        .bind(...ids)
    : db().prepare(
        'SELECT id,name,category,trend,reviews,margin,review_text FROM candidates LIMIT 200',
      );
  const result = await query.all<CandidateRow>();
  if (!result.results.length)
    return Response.json({ error: '没有可评分的候选产品' }, { status: 400 });
  const config = runtimeConfig();
  const configured = Boolean(config.apiKey && config.model);
  let fallbackCount = 0;
  const outputs = await Promise.all(
    result.results.map(async (candidate, index) => {
      if (!configured || index >= 20) {
        if (configured && index >= 20) fallbackCount += 1;
        return analyze(candidate);
      }
      try {
        return config.provider === 'siliconflow'
          ? await analyzeWithSiliconFlow(candidate)
          : await analyzeWithOpenAI(candidate);
      } catch {
        fallbackCount += 1;
        return analyze(candidate);
      }
    }),
  );
  const statements = result.results.map((candidate, index) => {
    const output = outputs[index];
    return db()
      .prepare(
        'UPDATE candidates SET score=?,verdict=?,scores_json=?,signals_json=?,pains_json=?,selling_point=?,updated_at=? WHERE id=?',
      )
      .bind(
        output.score,
        output.verdict,
        JSON.stringify(output.scores),
        JSON.stringify(output.signals),
        JSON.stringify(output.pains),
        output.sellingPoint,
        new Date().toISOString(),
        candidate.id,
      );
  });
  await db().batch(statements);
  return Response.json({
    analyzed: statements.length,
    mode:
      configured && fallbackCount === 0
        ? config.provider
        : 'explainable-pre-score',
    fallbackCount,
  });
}
