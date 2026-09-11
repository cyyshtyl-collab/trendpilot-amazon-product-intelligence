'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Box,
  CircleDollarSign,
  Database,
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
  category: string;
  market: string;
  score: number;
  verdict: Verdict;
  trend: number;
  revenue: string;
  reviews: number;
  margin: number;
  scores: [number, number, number, number, number];
  signals: string[];
  pains: string[];
  sellingPoint: string;
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
const trendData = [
  { month: '4月', demand: 62, social: 45 },
  { month: '5月', demand: 68, social: 52 },
  { month: '6月', demand: 73, social: 58 },
  { month: '7月', demand: 79, social: 71 },
  { month: '8月', demand: 88, social: 77 },
  { month: '9月', demand: 96, social: 84 },
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

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [selectedId, setSelectedId] = useState(1);
  const [candidates, setCandidates] = useState<Candidate[]>(DEFAULT_CANDIDATES);
  const [filter, setFilter] = useState<'全部' | Verdict>('全部');
  const [query, setQuery] = useState('');
  const [editorMode, setEditorMode] = useState<'new' | 'edit' | null>(null);
  const selected =
    candidates.find((item) => item.id === selectedId) ?? candidates[0];
  const filtered = useMemo(
    () =>
      candidates.filter(
        (item) =>
          (filter === '全部' || item.verdict === filter) &&
          item.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [filter, query],
  );
  useEffect(() => {
    void fetch('/api/auth')
      .then((response) => response.json())
      .then((result: { authenticated?: boolean }) => {
        setIsAuthenticated(result.authenticated === true);
        if (result.authenticated) void loadCandidates();
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

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
        <div className="content-grid">
          <section className="main-column">
            <div className="metrics-grid">
              <article className="metric-card metric-featured">
                <div className="metric-icon">
                  <Gauge size={20} />
                </div>
                <div>
                  <span>高潜候选</span>
                  <strong>2</strong>
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
                  <strong>24</strong>
                  <small>5 个重点类目</small>
                </div>
                <em>+12.5%</em>
              </article>
              <article className="metric-card">
                <div className="metric-icon">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <span>平均趋势增幅</span>
                  <strong>18.4%</strong>
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
                  <strong>34.7%</strong>
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
                    data={trendData}
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
            </article>
            <article className="panel candidates-panel">
              <div className="panel-head table-head">
                <div>
                  <span className="eyebrow">候选池</span>
                  <h2>产品机会排行</h2>
                </div>
                <div className="filters">
                  <Filter size={15} />
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
                </div>
                <div className="pain-tags">
                  {selected.pains.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
              <div className="selling-point">
                <span>SELLING POINT DRAFT</span>
                <p>{selected.sellingPoint}</p>
                <button>
                  生成完整文案 <ArrowUpRight size={14} />
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
    </main>
  );
}
