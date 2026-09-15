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

type CandidateField = keyof FeedCandidate;
type CsvField = CandidateField | 'sourceUrl';

const HEADER_ALIASES: Record<CsvField, string[]> = {
  name: [
    '产品名称',
    '商品名称',
    'name',
    'product name',
    'product title',
    'title',
  ],
  asin: ['asin', '产品asin', '商品asin', '产品标识'],
  sourceUrl: [
    '商品链接',
    '来源链接',
    'url',
    'source url',
    'product url',
    'page url',
    'webpage url',
    'original url',
    'original input url',
    'current page url',
  ],
  category: ['类目', '分类', 'category', 'product category'],
  market: ['站点', '市场', 'market', 'marketplace'],
  price: ['价格', '售价', 'price', 'current price', 'sale price'],
  bsr: ['bsr', '大类排名', '排名', 'best sellers rank', 'best seller rank'],
  rating: ['评分', '星级', 'rating', 'stars', 'star rating'],
  reviews: [
    '评论数',
    '评价数',
    'reviews',
    'review count',
    'rating count',
    'ratings count',
  ],
  searchVolume: ['关键词搜索量', '搜索量', 'search volume', 'keyword volume'],
  trend: ['趋势增幅', '趋势', 'trend', 'trend growth'],
  revenue: ['月销售额', '销售额', 'revenue', 'monthly revenue'],
  margin: ['毛利率', '毛利', 'margin', 'gross margin'],
  reviewText: [
    '差评内容',
    '评论文本',
    'review text',
    'reviews text',
    'negative reviews',
  ],
};

/** Normalizes multilingual and scraper-generated column names for stable matching. */
function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[_.\-/]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Parses RFC 4180-style CSV, including escaped quotes and line breaks in cells. */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  if (quoted) throw new Error('CSV 包含未闭合的引号');
  row.push(value.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

/** Converts currency, percentages and ranked strings such as "#1,250" to a number. */
function numberValue(value: string): number {
  const match = value.replace(/[,，]/g, '').match(/-?\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Reads a canonical Amazon ASIN from either a dedicated field or a product URL. */
function asinValue(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (/^[A-Z0-9]{10}$/.test(normalized)) return normalized;
  return normalized.match(/\/(?:DP|GP\/PRODUCT)\/([A-Z0-9]{10})(?:[/?#]|$)/)?.[1] ?? '';
}

/** Rejoins scraper-split dollars and cents into a stable currency value. */
function priceValue(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return '$0';
  const currency = compact.match(/([$\uffe5¥€£])\s*(\d[\d,]*)\s*\.\s*(\d{2})/);
  if (currency) return `${currency[1]}${currency[2]}.${currency[3]}`;
  return compact;
}

/** Uses the first Amazon BSR category when the feed has no explicit category column. */
function categoryValue(explicit: string, bsrText: string): string {
  if (explicit.trim()) return explicit.trim();
  return bsrText.match(/#\s*[\d,]+\s+in\s+(.+?)(?:\s*\(|$)/i)?.[1]?.trim() ?? '待归类';
}

/** Parses a bounded UTF-8 CSV feed using Chinese, English or Octoparse headers. */
export function parseCandidateFeed(csv: string): FeedCandidate[] {
  if (new TextEncoder().encode(csv).length > MAX_FEED_BYTES)
    throw new Error('CSV 超过 5MB 限制');
  const table = parseCsv(csv);
  if (table.length < 2) throw new Error('CSV 没有产品数据');
  if (table.length - 1 > MAX_FEED_ROWS)
    throw new Error(`CSV 超过 ${MAX_FEED_ROWS} 行限制`);

  const headers = table[0].map(normalizeHeader);
  const locate = (field: CsvField): number => {
    const aliases = new Set(HEADER_ALIASES[field].map(normalizeHeader));
    return headers.findIndex((header) => aliases.has(header));
  };
  const columns = Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as CsvField[]).map((field) => [
      field,
      locate(field),
    ]),
  ) as Record<CsvField, number>;
  if (columns.name < 0 || (columns.asin < 0 && columns.sourceUrl < 0))
    throw new Error('CSV 必须包含产品名称，以及 ASIN 或商品链接');

  const read = (cells: string[], index: number, fallback = ''): string =>
    index >= 0 ? (cells[index] ?? fallback).trim() : fallback;
  const rows = table.slice(1).map((cells, rowIndex): FeedCandidate => {
    const asin =
      asinValue(read(cells, columns.asin)) ||
      asinValue(read(cells, columns.sourceUrl));
    const name = read(cells, columns.name);
    if (!name) throw new Error(`第 ${rowIndex + 2} 行缺少产品名称`);
    if (!asin) throw new Error(`第 ${rowIndex + 2} 行无法识别 Amazon ASIN`);
    const bsrText = read(cells, columns.bsr);
    return {
      name,
      asin,
      category: categoryValue(read(cells, columns.category), bsrText),
      market: read(cells, columns.market, '美国站') || '美国站',
      price: priceValue(read(cells, columns.price)),
      bsr: Math.round(numberValue(bsrText)),
      rating: numberValue(read(cells, columns.rating)),
      reviews: Math.round(numberValue(read(cells, columns.reviews))),
      searchVolume: Math.round(numberValue(read(cells, columns.searchVolume))),
      trend: numberValue(read(cells, columns.trend)),
      revenue: read(cells, columns.revenue, '$0') || '$0',
      margin: numberValue(read(cells, columns.margin)),
      reviewText: read(cells, columns.reviewText).slice(0, 20_000),
    };
  });
  return [
    ...new Map(rows.map((row) => [`${row.market}:${row.asin}`, row])).values(),
  ];
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
    await database
      .prepare(
        `INSERT INTO candidates (name,asin,category,data_origin,market,score,verdict,trend,revenue,reviews,margin,price,bsr,rating,search_volume,review_growth,review_text,scores_json,signals_json,pains_json,selling_point,updated_at)
       VALUES (?,?,?,'automated_feed',?,15,'观察',?,?,?,?,?,?,?, ?,0,?,'[3,3,3,3,3]',?,?,?,?)
       ON CONFLICT(asin,market) DO UPDATE SET name=excluded.name,category=excluded.category,data_origin=excluded.data_origin,trend=excluded.trend,revenue=excluded.revenue,reviews=excluded.reviews,margin=excluded.margin,price=excluded.price,bsr=excluded.bsr,rating=excluded.rating,search_volume=excluded.search_volume,review_text=excluded.review_text,signals_json=excluded.signals_json,updated_at=excluded.updated_at`,
      )
      .bind(
        row.name,
        row.asin,
        row.category,
        row.market,
        row.trend,
        row.revenue,
        row.reviews,
        row.margin,
        row.price,
        row.bsr,
        row.rating,
        row.searchVolume,
        row.reviewText,
        JSON.stringify([`${source} 自动采集`, `更新于 ${today}`]),
        JSON.stringify(['等待 AI 评论摘要分析']),
        '等待 AI 生成卖点文案',
        now,
      )
      .run();
    await database
      .prepare(
        `INSERT INTO candidate_snapshots (candidate_id,captured_date,price,bsr,rating,reviews,review_growth,search_volume,trend,revenue,margin,captured_at)
       SELECT id,?,?,?,?,0,?,?,?,?,?,? FROM candidates WHERE asin=? AND market=?
       ON CONFLICT(candidate_id,captured_date) DO UPDATE SET price=excluded.price,bsr=excluded.bsr,rating=excluded.rating,reviews=excluded.reviews,search_volume=excluded.search_volume,trend=excluded.trend,revenue=excluded.revenue,margin=excluded.margin,captured_at=excluded.captured_at`,
      )
      .bind(
        today,
        row.price,
        row.bsr,
        row.rating,
        row.reviews,
        row.searchVolume,
        row.trend,
        row.revenue,
        row.margin,
        now,
        row.asin,
        row.market,
      )
      .run();
  }
}
