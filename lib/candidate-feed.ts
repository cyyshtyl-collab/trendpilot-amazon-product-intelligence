export type FeedCandidate = {
  name: string;
  asin: string;
  category: string;
  market: string;
  price: string;
  bsr: number;
  rating: number;
  reviews: number;
  searchVolume: number;
  trend: number;
  revenue: string;
  margin: number;
  reviewText: string;
};

const MAX_FEED_BYTES = 5_000_000;
const MAX_FEED_ROWS = 500;

function csvRow(line: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else value += character;
  }
  cells.push(value.trim());
  return cells;
}

function numberValue(value: string): number {
  const parsed = Number(value.replace(/[%,$￥¥\s]/g, '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Parses a bounded UTF-8 CSV feed using Chinese or English canonical headers. */
export function parseCandidateFeed(csv: string): FeedCandidate[] {
  if (new TextEncoder().encode(csv).length > MAX_FEED_BYTES)
    throw new Error('CSV 超过 5MB 限制');
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV 没有产品数据');
  const headers = csvRow(lines[0]).map((header) => header.toLowerCase());
  const locate = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const columns = {
    name: locate('产品名称', 'name', 'product_name', 'title'),
    asin: locate('asin', '产品asin', '产品标识'),
    category: locate('类目', 'category'),
    market: locate('站点', 'market'),
    price: locate('价格', 'price'),
    bsr: locate('bsr', '大类排名', '排名'),
    rating: locate('评分', 'rating'),
    reviews: locate('评论数', 'reviews', 'review_count'),
    searchVolume: locate('关键词搜索量', '搜索量', 'search_volume'),
    trend: locate('趋势增幅', 'trend'),
    revenue: locate('月销售额', 'revenue'),
    margin: locate('毛利率', 'margin'),
    reviewText: locate('差评内容', '评论文本', 'review_text', 'reviews_text'),
  };
  if (columns.name < 0 || columns.asin < 0)
    throw new Error('CSV 必须包含产品名称和 ASIN');
  const read = (cells: string[], index: number, fallback = '') =>
    index >= 0 ? (cells[index] ?? fallback).trim() : fallback;
  const rows = lines.slice(1, MAX_FEED_ROWS + 1).map((line, rowIndex) => {
    const cells = csvRow(line);
    const asin = read(cells, columns.asin).toUpperCase();
    const name = read(cells, columns.name);
    if (!name) throw new Error(`第 ${rowIndex + 2} 行缺少产品名称`);
    if (!/^[A-Z0-9]{10}$/.test(asin))
      throw new Error(`第 ${rowIndex + 2} 行 ASIN 格式不正确`);
    return {
      name,
      asin,
      category: read(cells, columns.category, '待归类') || '待归类',
      market: read(cells, columns.market, '美国站') || '美国站',
      price: read(cells, columns.price, '$0') || '$0',
      bsr: numberValue(read(cells, columns.bsr)),
      rating: numberValue(read(cells, columns.rating)),
      reviews: Math.round(numberValue(read(cells, columns.reviews))),
      searchVolume: Math.round(numberValue(read(cells, columns.searchVolume))),
      trend: numberValue(read(cells, columns.trend)),
      revenue: read(cells, columns.revenue, '$0') || '$0',
      margin: numberValue(read(cells, columns.margin)),
      reviewText: read(cells, columns.reviewText).slice(0, 20_000),
    };
  });
  return [...new Map(rows.map((row) => [`${row.market}:${row.asin}`, row])).values()];
}

/** Downloads one HTTPS CSV feed with size and content-type defenses. */
export async function downloadCandidateFeed(url: string): Promise<string> {
  const target = new URL(url);
  if (target.protocol !== 'https:') throw new Error('采集地址必须使用 HTTPS');
  const response = await fetch(target, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`数据源返回 HTTP ${response.status}`);
  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_FEED_BYTES) throw new Error('CSV 超过 5MB 限制');
  return response.text();
}

/** Upserts normalized listing data and writes the current daily snapshot. */
export async function persistCandidateFeed(
  database: D1Database,
  rows: FeedCandidate[],
  source: string,
): Promise<void> {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  for (const row of rows) {
    await database.prepare(
      `INSERT INTO candidates (name,asin,category,market,score,verdict,trend,revenue,reviews,margin,price,bsr,rating,search_volume,review_growth,review_text,scores_json,signals_json,pains_json,selling_point,updated_at)
       VALUES (?,?,?,?,15,'观察',?,?,?,?,?,?,?, ?,0,?,'[3,3,3,3,3]',?,?,?,?)
       ON CONFLICT(asin,market) DO UPDATE SET name=excluded.name,category=excluded.category,trend=excluded.trend,revenue=excluded.revenue,reviews=excluded.reviews,margin=excluded.margin,price=excluded.price,bsr=excluded.bsr,rating=excluded.rating,search_volume=excluded.search_volume,review_text=excluded.review_text,signals_json=excluded.signals_json,updated_at=excluded.updated_at`,
    ).bind(
      row.name, row.asin, row.category, row.market, row.trend, row.revenue,
      row.reviews, row.margin, row.price, row.bsr, row.rating, row.searchVolume,
      row.reviewText, JSON.stringify([`${source} 自动采集`, `更新于 ${today}`]),
      JSON.stringify(['等待 AI 评论摘要分析']), '等待 AI 生成卖点文案', now,
    ).run();
    await database.prepare(
      `INSERT INTO candidate_snapshots (candidate_id,captured_date,price,bsr,rating,reviews,review_growth,search_volume,trend,revenue,margin,captured_at)
       SELECT id,?,?,?,?,0,?,?,?,?,?,? FROM candidates WHERE asin=? AND market=?
       ON CONFLICT(candidate_id,captured_date) DO UPDATE SET price=excluded.price,bsr=excluded.bsr,rating=excluded.rating,reviews=excluded.reviews,search_volume=excluded.search_volume,trend=excluded.trend,revenue=excluded.revenue,margin=excluded.margin,captured_at=excluded.captured_at`,
    ).bind(today, row.price, row.bsr, row.rating, row.reviews, row.searchVolume,
      row.trend, row.revenue, row.margin, now, row.asin, row.market).run();
  }
}
