'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Box,
  CircleDollarSign,
  Clipboard,
  Database,
  Download,
  FileOutput,
  Filter,
  Gauge,
  LockKeyhole,
  LogOut,
  Plus,
  Pencil,
  Search,
  Sparkles,
  TrendingUp,
  Trash2,
  Upload,
  Workflow,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Verdict = '通过' | '观察' | '淘汰';
type Candidate = {
  id: number;
  name: string;
  asin?: string;
  category: string;
  market: string;
  score: number;
  verdict: Verdict;
  trend: number;
  revenue: string;
  reviews: number;
  margin: number;
  price?: string;
  bsr?: number;
  rating?: number;
  searchVolume?: number;
  reviewGrowth?: number;
  reviewText?: string;
  scores: [number, number, number, number, number];
  signals: string[];
  pains: string[];
  sellingPoint: string;
};
type AiStatus = {
  configured: boolean;
  provider: string;
  model: string | null;
};

const DEFAULT_CANDIDATES: Candidate[] = [
  {
    id: 1,
    name: '磁吸旅行收纳袋',
    category: '旅行配件',
    market: '美国站',
    score: 22,
    verdict: '通过',
    trend: 36,
    revenue: '$68K',
    reviews: 486,
    margin: 38,
    scores: [5, 4, 5, 4, 4],
    signals: [
      '近 6 个月搜索持续上升',
      'Top 20 评论集中在 300–800',
      'TikTok 收纳场景内容增长',
    ],
    pains: ['磁吸点易脱落', '装满后体积膨胀', '分区标签不清晰'],
    sellingPoint: 'Pack smarter with magnetic, modular organization.',
  },
  {
    id: 2,
    name: '宠物慢食嗅闻垫',
    category: '宠物用品',
    market: '美国站',
    score: 20,
    verdict: '通过',
    trend: 21,
    revenue: '$51K',
    reviews: 812,
    margin: 34,
    scores: [4, 4, 4, 4, 4],
    signals: ['稳定常青需求', '差评痛点高度集中', '内容演示效果强'],
    pains: ['吸盘抓地力不足', '机洗后变形', '大型犬容易翻起'],
    sellingPoint: 'A calmer, cleaner way to slow every mealtime.',
  },
  {
    id: 3,
    name: '便携咖啡冷萃杯',
    category: '厨房用品',
    market: '美国站',
    score: 17,
    verdict: '观察',
    trend: 14,
    revenue: '$43K',
    reviews: 1260,
    margin: 31,
    scores: [4, 3, 3, 4, 3],
    signals: ['夏季需求明显', '客单价可接受', '达人内容成熟'],
    pains: ['滤网清洗麻烦', '密封圈有异味', '玻璃材质运输破损'],
    sellingPoint: 'Smooth cold brew, wherever the day takes you.',
  },
  {
    id: 4,
    name: '折叠式桌下脚踏',
    category: '办公家居',
    market: '德国站',
    score: 16,
    verdict: '观察',
    trend: 9,
    revenue: '$29K',
    reviews: 674,
    margin: 29,
    scores: [3, 4, 3, 3, 3],
    signals: ['远程办公需求稳定', '低评论新品有增长', '场景较单一'],
    pains: ['高度调节范围小', '防滑脚垫脱落', '折叠结构有异响'],
    sellingPoint: 'Flexible comfort for focused workdays.',
  },
  {
    id: 5,
    name: '硅胶空气炸锅内胆',
    category: '厨房用品',
    market: '英国站',
    score: 13,
    verdict: '淘汰',
    trend: -8,
    revenue: '$18K',
    reviews: 4980,
    margin: 22,
    scores: [2, 2, 2, 4, 3],
    signals: ['搜索热度连续回落', '头部评论壁垒过高', '同质化严重'],
    pains: ['影响热风循环', '残留油污难清洗', '尺寸兼容投诉多'],
    sellingPoint: '—',
  },
];
const stages = [
  {
    number: '01',
    name: '数据采集',
    detail: '卖家精灵 · Octoparse',
    icon: Database,
  },
  {
    number: '02',
    name: '趋势分析',
    detail: '飞书多维表格 · Airtable',
    icon: BarChart3,
  },
  {
    number: '03',
    name: 'AI 评分',
    detail: 'Coze · Dify · GPT',
    icon: Sparkles,
  },
  {
    number: '04',
    name: '决策产出',
    detail: 'n8n · Make · 飞书',
    icon: FileOutput,
  },
];
const scoreLabels = [
  '需求真实性',
  '竞争可切入度',
  '差异化空间',
  '供应链可控性',
  '双线协同性',
];

/** Returns a stable status class for supported product verdicts. */
function verdictClass(verdict: Verdict): string {
  if (verdict === '通过') return 'status status-pass';
  if (verdict === '观察') return 'status status-watch';
  return 'status status-reject';
}

function parseCsvRow(row: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"' && quoted && row[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  cells.push(value.trim());
  return cells;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [selectedId, setSelectedId] = useState(1);
  const [candidates, setCandidates] = useState<Candidate[]>(DEFAULT_CANDIDATES);
  const [filter, setFilter] = useState<'全部' | Verdict>('全部');
  const [categoryFilter, setCategoryFilter] = useState('全部类目');
  const [sortBy, setSortBy] = useState<'score' | 'trend' | 'margin'>('score');
  const [query, setQuery] = useState('');
  const [editorMode, setEditorMode] = useState<'new' | 'edit' | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [aiStatus, setAiStatus] = useState<AiStatus>({
    configured: false,
    provider: 'OpenAI',
    model: null,
  });
  const selected =
    candidates.find((item) => item.id === selectedId) ?? candidates[0];
  const categories = useMemo(
    () => ['全部类目', ...new Set(candidates.map((item) => item.category))],
    [candidates],
  );
  const filtered = useMemo(() => {
    const sortValue = (item: Candidate) =>
      sortBy === 'trend'
        ? item.trend
        : sortBy === 'margin'
          ? item.margin
          : item.score;
    return candidates
      .filter(
        (item) =>
          (filter === '全部' || item.verdict === filter) &&
          (categoryFilter === '全部类目' || item.category === categoryFilter) &&
          item.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
      .sort((left, right) => sortValue(right) - sortValue(left));
  }, [candidates, categoryFilter, filter, query, sortBy]);
  const analysis = useMemo(() => {
    const average = (values: number[]) =>
      values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;
    const passed = candidates.filter((item) => item.verdict === '通过');
    const baseline = Math.max(30, 76 - Math.max(-20, selected?.trend ?? 0));
    const lift = (selected?.trend ?? 0) / 5;
    const trendData = ['4月', '5月', '6月', '7月', '8月', '9月'].map(
      (month, index) => ({
        month,
        demand: Math.round(baseline + lift * index),
        social: Math.round(baseline * 0.72 + lift * (index + 0.5)),
      }),
    );
    return {
      highPotential: passed.length,
      tracked: candidates.length,
      categories: new Set(candidates.map((item) => item.category)).size,
      averageTrend: average(candidates.map((item) => item.trend)),
      passedMargin: average(passed.map((item) => item.margin)),
      rising: candidates.filter((item) => item.trend >= 15).length,
      cooling: candidates.filter((item) => item.trend < 0).length,
      trendData,
    };
  }, [candidates, selected]);
  const reportCandidates = useMemo(
    () =>
      [...candidates]
        .filter((item) => item.verdict !== '淘汰')
        .sort((left, right) => right.score - left.score)
        .slice(0, 8),
    [candidates],
  );
  const reportMarkdown = useMemo(() => {
    const rows = reportCandidates
      .map(
        (item, index) =>
          `| ${index + 1} | ${item.name} | ${item.category} | ${item.score}/25 | ${item.trend}% | ${item.margin}% | ${item.verdict} |`,
      )
      .join('\n');
    return `# TrendPilot 亚马逊选品周报\n\n生成时间：${new Date().toLocaleDateString('zh-CN')}\n\n## 决策摘要\n\n- 追踪产品：${analysis.tracked} 个\n- 高潜候选：${analysis.highPotential} 个\n- 平均趋势增幅：${analysis.averageTrend.toFixed(1)}%\n- 通过产品平均毛利率：${analysis.passedMargin.toFixed(1)}%\n\n## 候选清单\n\n| 排名 | 产品 | 类目 | 评分 | 趋势 | 毛利率 | 结论 |\n| --- | --- | --- | ---: | ---: | ---: | --- |\n${rows || '| - | 暂无通过或观察产品 | - | - | - | - | - |'}\n\n## 本周建议\n\n1. 优先验证评分最高产品的供应链报价和样品质量。\n2. 对趋势增幅超过 15% 的产品补充关键词与社媒数据。\n3. 对观察产品继续追踪一个采集周期，暂缓备货。\n\n> 说明：当前评分为可解释预评分，接入大模型后可追加评论语义与卖点论证。\n`;
  }, [analysis, reportCandidates]);
  useEffect(() => {
    void fetch('/api/auth')
      .then((response) => response.json())
      .then((result: { authenticated?: boolean }) => {
        setIsAuthenticated(result.authenticated === true);
        if (result.authenticated) {
          void loadCandidates();
          void loadAiStatus();
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  /** Reads AI readiness without requesting or exposing provider credentials. */
  async function loadAiStatus(): Promise<void> {
    const response = await fetch('/api/ai/status');
    if (!response.ok) return;
    setAiStatus((await response.json()) as AiStatus);
  }

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: 'filter_candidates',
          title: '筛选候选产品',
          description: '按选品结论筛选当前候选池。',
          inputSchema: {
            type: 'object',
            properties: {
              verdict: {
                type: 'string',
                enum: ['全部', '通过', '观察', '淘汰'],
              },
            },
            required: ['verdict'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            const value = (input as { verdict?: string })?.verdict;
            if (!['全部', '通过', '观察', '淘汰'].includes(value ?? ''))
              throw new Error('不支持的筛选条件');
            setFilter(value as '全部' | Verdict);
            return {
              verdict: value,
              count:
                value === '全部'
                  ? candidates.length
                  : candidates.filter((item) => item.verdict === value).length,
            };
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'select_candidate',
          title: '查看候选产品',
          description: '按产品编号打开候选产品评分详情。',
          inputSchema: {
            type: 'object',
            properties: { id: { type: 'number', minimum: 1 } },
            required: ['id'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            const id = (input as { id?: number })?.id;
            const item = candidates.find((candidate) => candidate.id === id);
            if (!item) throw new Error('未找到候选产品');
            setSelectedId(item.id);
            return {
              id: item.id,
              name: item.name,
              score: item.score,
              verdict: item.verdict,
            };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [candidates]);

  /** Creates or updates a candidate and persists the standard scoring contract. */
  async function handleSaveCandidate(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const boundedScore = (name: string) =>
      Math.min(5, Math.max(1, Number(values.get(name)) || 1));
    const scores: Candidate['scores'] = [
      boundedScore('demand'),
      boundedScore('competition'),
      boundedScore('differentiation'),
      boundedScore('supply'),
      boundedScore('brand'),
    ];
    const total = scores.reduce((sum, value) => sum + value, 0);
    const verdict: Verdict =
      total >= 18 ? '通过' : total >= 15 ? '观察' : '淘汰';
    const existing = editorMode === 'edit' ? selected : undefined;
    const candidate: Candidate = {
      id: existing?.id ?? Math.max(0, ...candidates.map((item) => item.id)) + 1,
      name: String(values.get('name') ?? '').trim(),
      asin:
        String(values.get('asin') ?? '')
          .trim()
          .toUpperCase() || undefined,
      category: String(values.get('category') ?? '').trim() || '未分类',
      market: String(values.get('market') ?? '美国站'),
      score: total,
      verdict,
      trend: Number(values.get('trend')) || 0,
      revenue: String(values.get('revenue') ?? '').trim() || '$0',
      reviews: existing?.reviews ?? 0,
      margin: Number(values.get('margin')) || 0,
      scores,
      signals: existing?.signals ?? ['等待接入关键词与社媒趋势数据'],
      pains: existing?.pains ?? ['等待评论摘要分析'],
      sellingPoint: existing?.sellingPoint ?? '等待 AI 生成卖点文案',
      reviewText: String(values.get('reviewText') ?? '').trim(),
    };
    if (!candidate.name) return;
    const response = await fetch('/api/candidates', {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate),
    });
    if (!response.ok) return;
    await loadCandidates();
    if (existing) setSelectedId(existing.id);
    setEditorMode(null);
  }

  /** Removes the selected candidate while preserving a non-empty workspace. */
  async function handleDeleteCandidate(): Promise<void> {
    if (candidates.length <= 1) return;
    const response = await fetch(`/api/candidates?id=${selected.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) return;
    const remaining = candidates.filter((item) => item.id !== selected.id);
    setCandidates(remaining);
    setSelectedId(remaining[0].id);
  }

  /** Parses a SellerSprite-style CSV and persists its normalized candidate rows. */
  async function handleCsvImport(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage('正在读取并校验数据…');
    try {
      const lines = (await file.text())
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter((line) => line.trim());
      if (lines.length < 2) throw new Error('CSV 中没有可导入的数据行');
      const headers = parseCsvRow(lines[0]).map((value) => value.toLowerCase());
      const find = (aliases: string[]) =>
        headers.findIndex((header) => aliases.includes(header));
      const column = {
        name: find(['产品名称', 'name', 'product_name']),
        asin: find(['asin', '产品asin', '产品标识']),
        category: find(['类目', 'category']),
        market: find(['站点', 'market']),
        trend: find(['趋势增幅', 'trend']),
        revenue: find(['月销售额', 'revenue']),
        reviews: find(['评论数', 'reviews']),
        margin: find(['毛利率', 'margin']),
        price: find(['价格', 'price']),
        bsr: find(['bsr', '大类排名', '排名']),
        rating: find(['评分', 'rating']),
        searchVolume: find(['关键词搜索量', '搜索量', 'search_volume']),
        reviewGrowth: find(['评论增速', 'review_growth']),
        reviewText: find([
          '差评内容',
          '评论文本',
          'review_text',
          'reviews_text',
        ]),
        scores: [
          find(['需求真实性', 'demand']),
          find(['竞争可切入度', 'competition']),
          find(['差异化空间', 'differentiation']),
          find(['供应链可控性', 'supply']),
          find(['双线协同性', 'brand']),
        ],
      };
      if (column.name < 0) throw new Error('缺少“产品名称”列');
      const read = (cells: string[], index: number, fallback = '') =>
        index >= 0 ? (cells[index] ?? fallback) : fallback;
      const imported = lines.slice(1, 201).map((line) => {
        const cells = parseCsvRow(line);
        const scores = column.scores.map((index) =>
          Math.min(5, Math.max(1, Number(read(cells, index, '3')) || 3)),
        ) as Candidate['scores'];
        const score = scores.reduce((sum, value) => sum + value, 0);
        return {
          name: read(cells, column.name).trim(),
          asin: read(cells, column.asin).trim().toUpperCase() || undefined,
          category: read(cells, column.category, '未分类') || '未分类',
          market: read(cells, column.market, '美国站') || '美国站',
          trend: Number(read(cells, column.trend)) || 0,
          revenue: read(cells, column.revenue, '$0') || '$0',
          reviews: Number(read(cells, column.reviews)) || 0,
          margin: Number(read(cells, column.margin)) || 0,
          price: read(cells, column.price, '$0') || '$0',
          bsr: Number(read(cells, column.bsr)) || 0,
          rating: Number(read(cells, column.rating)) || 0,
          searchVolume: Number(read(cells, column.searchVolume)) || 0,
          reviewGrowth: Number(read(cells, column.reviewGrowth)) || 0,
          reviewText: read(cells, column.reviewText).slice(0, 20000),
          scores,
          score,
          verdict: score >= 18 ? '通过' : score >= 15 ? '观察' : '淘汰',
          signals: ['CSV 批量导入，等待趋势数据更新'],
          pains: ['等待 AI 评论摘要分析'],
          sellingPoint: '等待 AI 生成卖点文案',
        } satisfies Omit<Candidate, 'id'>;
      });
      if (imported.some((item) => !item.name))
        throw new Error('存在产品名称为空的数据行');
      const response = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imported),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '导入失败');
      await loadCandidates();
      setImportMessage(`已成功导入 ${imported.length} 条候选产品`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '导入失败');
    } finally {
      event.target.value = '';
    }
  }

  /** Downloads the canonical CSV header and one example row. */
  function downloadCsvTemplate(): void {
    const template = [
      'ASIN,产品名称,类目,站点,价格,BSR,评分,评论数,评论增速,关键词搜索量,趋势增幅,月销售额,毛利率,差评内容,需求真实性,竞争可切入度,差异化空间,供应链可控性,双线协同性',
      'B0EXAMPLE1,示例产品,旅行配件,美国站,$29.99,1250,4.4,386,12,18500,24,$38K,35,"The zipper broke after one trip || Hard to clean",4,4,4,4,4',
    ].join('\n');
    const blob = new Blob([`\uFEFF${template}`], {
      type: 'text/csv;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'TrendPilot-标准导入模板.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /** Runs explainable scoring for one candidate or the full candidate pool. */
  async function handleAnalyze(ids?: number[]): Promise<void> {
    setAnalysisLoading(true);
    setAnalysisMessage('');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const result = (await response.json()) as {
        analyzed?: number;
        error?: string;
        mode?: string;
        fallbackCount?: number;
      };
      if (!response.ok) throw new Error(result.error ?? '预评分失败');
      await loadCandidates();
      setAnalysisMessage(
        result.mode === 'openai' || result.mode === 'siliconflow'
          ? `已用 ${aiStatus.provider} · ${aiStatus.model ?? '已配置模型'} 完成 ${result.analyzed ?? 0} 个产品分析`
          : `已完成 ${result.analyzed ?? 0} 个产品的智能预评分${result.fallbackCount ? `，${result.fallbackCount} 个已安全回退` : ''}`,
      );
    } catch (error) {
      setAnalysisMessage(error instanceof Error ? error.message : '预评分失败');
    } finally {
      setAnalysisLoading(false);
    }
  }

  /** Downloads the current management report as a reusable Markdown document. */
  function downloadReport(): void {
    const blob = new Blob([reportMarkdown], {
      type: 'text/markdown;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TrendPilot-选品周报-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
    setReportMessage('周报已下载');
  }

  /** Copies the report for direct pasting into Feishu or WeCom. */
  async function copyReport(): Promise<void> {
    await navigator.clipboard.writeText(reportMarkdown);
    setReportMessage('周报已复制，可直接粘贴到飞书或企业微信');
  }

  /** Loads the cloud candidate pool and creates initial records once when empty. */
  async function loadCandidates(): Promise<void> {
    const response = await fetch('/api/candidates');
    if (!response.ok) return;
    const result = (await response.json()) as { candidates?: Candidate[] };
    if (Array.isArray(result.candidates) && result.candidates.length > 0) {
      setCandidates(result.candidates);
      setSelectedId(result.candidates[0].id);
      return;
    }
    for (const candidate of DEFAULT_CANDIDATES) {
      await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidate),
      });
    }
    const seeded = await fetch('/api/candidates');
    if (seeded.ok) {
      const data = (await seeded.json()) as { candidates: Candidate[] };
      setCandidates(data.candidates);
      setSelectedId(data.candidates[0]?.id ?? 1);
    }
  }

  /** Validates the local preview account and starts a browser session. */
  async function handleLogin(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const username = String(values.get('username') ?? '').trim();
    const password = String(values.get('password') ?? '');
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      setLoginError('账号或密码不正确');
      return;
    }
    setLoginError('');
    setIsAuthenticated(true);
    await loadCandidates();
    await loadAiStatus();
  }

  /** Ends the current local preview session. */
  async function handleLogout(): Promise<void> {
    await fetch('/api/auth', { method: 'DELETE' });
    setIsAuthenticated(false);
  }

  if (!isAuthenticated) {
    return (
      <main className="login-page">
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-brand">
            <div className="brand-mark">
              <TrendingUp size={23} strokeWidth={2.5} />
            </div>
            <div>
              <strong>TrendPilot</strong>
              <span>亚马逊选品情报工作台</span>
            </div>
          </div>
          <div className="login-copy">
            <span className="login-kicker">PRIVATE WORKSPACE</span>
            <h1 id="login-title">欢迎回来</h1>
            <p>登录后进入本周选品机会雷达。</p>
          </div>
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="username">账号</label>
            <div className="login-input">
              <span>AD</span>
              <input
                id="username"
                name="username"
                autoComplete="username"
                required
                placeholder="请输入账号"
              />
            </div>
            <label htmlFor="password">密码</label>
            <div className="login-input">
              <LockKeyhole size={17} />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="请输入密码"
              />
            </div>
            {loginError && (
              <p className="login-error" role="alert">
                {loginError}
              </p>
            )}
            <button className="login-submit" type="submit">
              登录工作台 <ArrowUpRight size={16} />
            </button>
          </form>
          <p className="login-note">
            当前为内部演示认证，正式上线前将升级为服务端账号系统。
          </p>
        </section>
        <aside className="login-visual" aria-hidden="true">
          <div className="login-orbit orbit-one" />
          <div className="login-orbit orbit-two" />
          <div className="login-radar">
            <span>机会雷达</span>
            <strong>
              22<small>/25</small>
            </strong>
            <i />
          </div>
          <div className="login-signal signal-one">
            <TrendingUp size={16} />
            <span>搜索趋势</span>
            <strong>+36%</strong>
          </div>
          <div className="login-signal signal-two">
            <Sparkles size={16} />
            <span>高潜候选</span>
            <strong>2</strong>
          </div>
        </aside>
      </main>
    );
  }
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <TrendingUp size={21} strokeWidth={2.5} />
          </div>
          <div>
            <strong>TrendPilot</strong>
            <span>选品情报工作台</span>
          </div>
        </div>
        <div className="pipeline-label">自动选品流程</div>
        <nav className="stage-list" aria-label="自动选品流程">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <button
                className={`stage ${index === 2 ? 'stage-active' : ''}`}
                key={stage.number}
              >
                <span className="stage-icon">
                  <Icon size={18} />
                </span>
                <span className="stage-copy">
                  <strong>{stage.name}</strong>
                  <small>{stage.detail}</small>
                </span>
                <span className="stage-number">{stage.number}</span>
              </button>
            );
          })}
        </nav>
        <div className="connector-card">
          <div className="connector-head">
            <Workflow size={17} />
            <span>连接状态</span>
          </div>
          <div className="connector-row">
            <span className="live-dot" />
            演示数据已同步
          </div>
          <button>
            管理数据源 <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-foot">
          <span>TP</span>
          <div>
            <strong>产品策略组</strong>
            <small>本地工作空间</small>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p>2026 年第 37 周</p>
            <h1>亚马逊机会雷达</h1>
          </div>
          <div className="top-actions">
            <label className="search">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索候选产品"
              />
            </label>
            <button
              className="report-button"
              onClick={() => {
                setReportMessage('');
                setShowReport(true);
              }}
            >
              <FileOutput size={17} />
              生成周报
            </button>
            <button
              className="import-button"
              disabled={analysisLoading}
              onClick={() => void handleAnalyze()}
            >
              <Sparkles size={17} />
              {analysisLoading
                ? '评分中…'
                : aiStatus.configured
                  ? '批量 AI 分析'
                  : '批量预评分'}
            </button>
            <button
              className="import-button"
              onClick={() => {
                setImportMessage('');
                setShowImport(true);
              }}
            >
              <Upload size={17} />
              批量导入
            </button>
            <button
              className="primary-button"
              onClick={() => setEditorMode('new')}
            >
              <Plus size={17} />
              新增候选
            </button>
            <button
              className="logout-button"
              onClick={handleLogout}
              aria-label="退出登录"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        {analysisMessage && (
          <div className="analysis-toast" role="status">
            <Sparkles size={15} />
            {analysisMessage}
          </div>
        )}
        <div
          className={aiStatus.configured ? 'ai-status ai-ready' : 'ai-status'}
        >
          <span />
          {aiStatus.configured
            ? `${aiStatus.provider} · ${aiStatus.model} 已连接`
            : '真实 AI 未连接 · 当前自动使用可解释预评分'}
        </div>
        <div className="content-grid">
          <section className="main-column">
            <div className="metrics-grid">
              <article className="metric-card metric-featured">
                <div className="metric-icon">
                  <Gauge size={20} />
                </div>
                <div>
                  <span>高潜候选</span>
                  <strong>{analysis.highPotential}</strong>
                  <small>总分 ≥ 18</small>
                </div>
                <em>+1 本周</em>
              </article>
              <article className="metric-card">
                <div className="metric-icon">
                  <Activity size={20} />
                </div>
                <div>
                  <span>追踪产品</span>
                  <strong>{analysis.tracked}</strong>
                  <small>{analysis.categories} 个重点类目</small>
                </div>
                <em>+12.5%</em>
              </article>
              <article className="metric-card">
                <div className="metric-icon">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <span>平均趋势增幅</span>
                  <strong>{analysis.averageTrend.toFixed(1)}%</strong>
                  <small>近 6 个月</small>
                </div>
                <em>↑ 4.2%</em>
              </article>
              <article className="metric-card">
                <div className="metric-icon">
                  <CircleDollarSign size={20} />
                </div>
                <div>
                  <span>目标毛利率</span>
                  <strong>{analysis.passedMargin.toFixed(1)}%</strong>
                  <small>通过产品均值</small>
                </div>
                <em>达标</em>
              </article>
            </div>
            <article className="panel trend-panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">市场信号</span>
                  <h2>热度正在形成交叉验证</h2>
                </div>
                <div className="legend">
                  <span>
                    <i className="dot-indigo" />
                    搜索需求
                  </span>
                  <span>
                    <i className="dot-mint" />
                    社媒热度
                  </span>
                </div>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analysis.trendData}
                    margin={{ top: 10, right: 8, left: -24, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="demand" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#6c63e8"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="100%"
                          stopColor="#6c63e8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      vertical={false}
                      stroke="#e9e8ef"
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#878593', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#a09eaa', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: '#e3e1ec',
                        boxShadow: '0 8px 24px rgba(46,42,78,.08)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="demand"
                      stroke="#6c63e8"
                      strokeWidth={3}
                      fill="url(#demand)"
                    />
                    <Area
                      type="monotone"
                      dataKey="social"
                      stroke="#24b99a"
                      strokeWidth={2.5}
                      fill="transparent"
                      strokeDasharray="5 5"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="trend-summary">
                <div>
                  <span>当前观察</span>
                  <strong>{selected.name}</strong>
                </div>
                <div>
                  <span>快速升温</span>
                  <strong>{analysis.rising} 个</strong>
                </div>
                <div>
                  <span>趋势回落</span>
                  <strong>{analysis.cooling} 个</strong>
                </div>
                <p>
                  {selected.trend >= 15
                    ? '搜索热度已进入加速区间，建议优先验证评论痛点与供应链。'
                    : selected.trend < 0
                      ? '热度正在回落，建议暂停投入并观察下一个采集周期。'
                      : '需求保持平稳，可结合毛利率和竞争评分继续筛选。'}
                </p>
              </div>
            </article>
            <article className="panel candidates-panel">
              <div className="panel-head table-head">
                <div>
                  <span className="eyebrow">候选池</span>
                  <h2>产品机会排行</h2>
                </div>
                <div className="filters">
                  <Filter size={15} />
                  <select
                    aria-label="按类目筛选"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <select
                    aria-label="候选产品排序"
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(event.target.value as typeof sortBy)
                    }
                  >
                    <option value="score">按评分</option>
                    <option value="trend">按趋势</option>
                    <option value="margin">按毛利率</option>
                  </select>
                  {(['全部', '通过', '观察', '淘汰'] as const).map((value) => (
                    <button
                      className={filter === value ? 'filter-active' : ''}
                      key={value}
                      onClick={() => setFilter(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>产品</th>
                      <th>AI 评分</th>
                      <th>搜索趋势</th>
                      <th>月销售额</th>
                      <th>毛利率</th>
                      <th>结论</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          selected.id === item.id ? 'row-selected' : ''
                        }
                      >
                        {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- labeled button is nested in this data cell */}
                        <td>
                          <div className="product-cell">
                            <span>
                              <Box size={17} />
                            </span>
                            <div>
                              <button
                                className="product-select"
                                aria-label={`查看${item.name}评分详情`}
                                onClick={() => setSelectedId(item.id)}
                              >
                                {item.name}
                              </button>
                              <small>
                                {item.category} · {item.market}
                                {item.asin ? ` · ${item.asin}` : ''}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <b className="score-number">
                            {item.score}
                            <small>/25</small>
                          </b>
                        </td>
                        <td>
                          <span
                            className={
                              item.trend >= 0 ? 'positive' : 'negative'
                            }
                          >
                            {item.trend >= 0 ? '+' : ''}
                            {item.trend}%
                          </span>
                        </td>
                        <td>{item.revenue}</td>
                        <td>{item.margin}%</td>
                        <td>
                          <span className={verdictClass(item.verdict)}>
                            {item.verdict}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="empty-state">没有找到匹配的候选产品</div>
                )}
              </div>
            </article>
          </section>
          <aside className="detail-column">
            <article className="detail-card">
              <div className="detail-top">
                <div>
                  <span className={verdictClass(selected.verdict)}>
                    {selected.verdict}
                  </span>
                  <h2>{selected.name}</h2>
                  <p>
                    {selected.category} · {selected.market}
                  </p>
                </div>
                <div className="detail-actions">
                  <button
                    aria-label="编辑候选产品"
                    onClick={() => setEditorMode('edit')}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    aria-label="删除候选产品"
                    onClick={handleDeleteCandidate}
                    disabled={candidates.length <= 1}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="total-score">
                <div>
                  <span>AI 综合评分</span>
                  <strong>
                    {selected.score}
                    <small>/25</small>
                  </strong>
                </div>
                <div
                  className="score-ring"
                  style={
                    {
                      '--score': `${selected.score * 4}%`,
                    } as React.CSSProperties
                  }
                >
                  <span>{selected.score * 4}%</span>
                </div>
              </div>
              <div className="score-list">
                {scoreLabels.map((label, index) => (
                  <div className="score-row" key={label}>
                    <div>
                      <span>{label}</span>
                      <b>{selected.scores[index]}.0</b>
                    </div>
                    <div className="score-track">
                      <i style={{ width: `${selected.scores[index] * 20}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="section-block">
                <div className="section-title">
                  <Sparkles size={16} />
                  <h3>机会信号</h3>
                </div>
                <ul className="signal-list">
                  {selected.signals.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="section-block">
                <div className="section-title">
                  <Activity size={16} />
                  <h3>未解决痛点</h3>
                  <span className="evidence-count">
                    {selected.reviewText
                      ? `${selected.reviewText.split(/\r?\n|\|\|/).filter((item) => item.trim()).length} 条评论证据`
                      : '待补充评论证据'}
                  </span>
                </div>
                <div className="pain-tags">
                  {selected.pains.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
              <div className="selling-point">
                <span>SELLING POINT · 智能预评分</span>
                <p>{selected.sellingPoint}</p>
                <button
                  disabled={analysisLoading}
                  onClick={() => void handleAnalyze([selected.id])}
                >
                  {analysisLoading ? '分析中…' : '重新分析当前产品'}{' '}
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          </aside>
        </div>
      </section>
      {editorMode && (
        <div className="modal-backdrop">
          <dialog
            open
            className="modal"
            aria-labelledby="add-title"
            key={`${editorMode}-${selected.id}`}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">候选产品数据</span>
                <h2 id="add-title">
                  {editorMode === 'edit' ? '编辑候选产品' : '新增候选产品'}
                </h2>
              </div>
              <button
                aria-label="关闭新增候选窗口"
                onClick={() => setEditorMode(null)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveCandidate}>
              <div className="form-grid">
                <label>
                  产品名称
                  <input
                    name="name"
                    required
                    defaultValue={editorMode === 'edit' ? selected.name : ''}
                    placeholder="例如：便携折叠水杯"
                  />
                </label>
                <label>
                  ASIN
                  <input
                    name="asin"
                    maxLength={10}
                    defaultValue={editorMode === 'edit' ? selected.asin : ''}
                    placeholder="例如：B0XXXXXXXX"
                  />
                </label>
                <label>
                  目标站点
                  <select
                    name="market"
                    defaultValue={
                      editorMode === 'edit' ? selected.market : '美国站'
                    }
                  >
                    <option>美国站</option>
                    <option>英国站</option>
                    <option>德国站</option>
                  </select>
                </label>
                <label>
                  产品类目
                  <input
                    name="category"
                    defaultValue={
                      editorMode === 'edit' ? selected.category : ''
                    }
                    placeholder="选择或输入类目"
                  />
                </label>
                <label>
                  近 6 月趋势增幅 (%)
                  <input
                    name="trend"
                    type="number"
                    defaultValue={editorMode === 'edit' ? selected.trend : 0}
                  />
                </label>
                <label>
                  预估月销售额
                  <input
                    name="revenue"
                    defaultValue={
                      editorMode === 'edit' ? selected.revenue : '$0'
                    }
                    placeholder="$25K"
                  />
                </label>
                <label>
                  预估毛利率 (%)
                  <input
                    name="margin"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={editorMode === 'edit' ? selected.margin : 30}
                  />
                </label>
                <fieldset className="score-editor">
                  <legend>五维评分（每项 1–5 分）</legend>
                  {scoreLabels.map((label, index) => (
                    <label key={label}>
                      {label}
                      <input
                        name={
                          [
                            'demand',
                            'competition',
                            'differentiation',
                            'supply',
                            'brand',
                          ][index]
                        }
                        type="number"
                        min="1"
                        max="5"
                        required
                        defaultValue={
                          editorMode === 'edit' ? selected.scores[index] : 3
                        }
                      />
                    </label>
                  ))}
                </fieldset>
                <label className="review-input">
                  差评原文（每行一条，也可用 || 分隔）
                  <textarea
                    name="reviewText"
                    maxLength={20000}
                    defaultValue={
                      editorMode === 'edit' ? selected.reviewText : ''
                    }
                    placeholder="粘贴 Amazon 差评原文，用于提炼可复核痛点"
                  />
                </label>
              </div>
              <div className="upgrade-note">
                <Database size={18} />
                <div>
                  <strong>数据会自动保存在当前浏览器</strong>
                  <p>评分结论根据总分自动计算；接入飞书后将沿用相同字段。</p>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setEditorMode(null)}>
                  取消
                </button>
                <button type="submit" className="primary-button">
                  {editorMode === 'edit' ? '保存修改' : '创建并进入分析'}
                </button>
              </div>
            </form>
          </dialog>
        </div>
      )}
      {showImport && (
        <div className="modal-backdrop">
          <dialog
            open
            className="modal import-modal"
            aria-labelledby="import-title"
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">数据采集 · CSV</span>
                <h2 id="import-title">批量导入候选产品</h2>
              </div>
              <button
                aria-label="关闭导入窗口"
                onClick={() => setShowImport(false)}
              >
                ×
              </button>
            </div>
            <label className="upload-zone">
              <Upload size={28} />
              <strong>选择 CSV 文件</strong>
              <span>支持卖家精灵、Octoparse 导出结果，每次最多 200 条</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvImport}
              />
            </label>
            <button
              type="button"
              className="template-button"
              onClick={downloadCsvTemplate}
            >
              <Download size={15} />
              下载标准 CSV 模板
            </button>
            <div className="field-guide">
              <strong>字段说明</strong>
              <p>
                建议必填：ASIN + 产品名称；同一站点的相同 ASIN
                会更新原记录，不再重复创建。
              </p>
              <p>
                支持：价格、BSR、评分、评论数、评论增速、关键词搜索量、差评内容、趋势、销售额、毛利率及五维评分；缺省评分按
                3 分处理。
              </p>
            </div>
            {importMessage && <p className="import-message">{importMessage}</p>}
            <div className="modal-actions">
              <button type="button" onClick={() => setShowImport(false)}>
                完成
              </button>
            </div>
          </dialog>
        </div>
      )}
      {showReport && (
        <div className="modal-backdrop">
          <dialog
            open
            className="modal report-modal"
            aria-labelledby="report-title"
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">决策产出 · 本周</span>
                <h2 id="report-title">亚马逊选品决策周报</h2>
              </div>
              <button
                aria-label="关闭周报"
                onClick={() => setShowReport(false)}
              >
                ×
              </button>
            </div>
            <div className="report-kpis">
              <div>
                <span>追踪产品</span>
                <strong>{analysis.tracked}</strong>
              </div>
              <div>
                <span>高潜候选</span>
                <strong>{analysis.highPotential}</strong>
              </div>
              <div>
                <span>平均趋势</span>
                <strong>{analysis.averageTrend.toFixed(1)}%</strong>
              </div>
              <div>
                <span>通过毛利率</span>
                <strong>{analysis.passedMargin.toFixed(1)}%</strong>
              </div>
            </div>
            <div className="report-list">
              <div className="report-list-head">
                <strong>优先候选清单</strong>
                <span>已按 AI 评分排序</span>
              </div>
              {reportCandidates.map((item, index) => (
                <div className="report-row" key={item.id}>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.category} · {item.market}
                    </span>
                  </div>
                  <em>{item.score}/25</em>
                  <span className={verdictClass(item.verdict)}>
                    {item.verdict}
                  </span>
                </div>
              ))}
              {reportCandidates.length === 0 && (
                <p className="report-empty">暂无通过或观察产品</p>
              )}
            </div>
            <div className="report-advice">
              <strong>本周行动建议</strong>
              <ol>
                <li>优先验证最高分产品的供应链报价和样品质量。</li>
                <li>为趋势增幅超过 15% 的产品补充关键词与社媒数据。</li>
                <li>观察产品继续追踪一个采集周期，暂缓备货。</li>
              </ol>
            </div>
            {reportMessage && <p className="import-message">{reportMessage}</p>}
            <div className="modal-actions report-actions">
              <button type="button" onClick={() => void copyReport()}>
                <Clipboard size={15} />
                复制周报
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={downloadReport}
              >
                <Download size={15} />
                下载 Markdown
              </button>
            </div>
          </dialog>
        </div>
      )}
    </main>
  );
}
