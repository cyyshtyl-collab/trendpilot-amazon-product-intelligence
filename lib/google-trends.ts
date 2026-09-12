export type GoogleTrendItem = {
  keyword: string;
  traffic: string;
  publishedAt: string;
  source: 'Google Trends';
};

export const GOOGLE_TRENDS_GEOS = new Set(['US', 'GB', 'DE', 'JP', 'CA', 'AU']);

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function field(block: string, pattern: RegExp): string {
  return decodeXml(block.match(pattern)?.[1] ?? '');
}

/** Normalizes a supported Amazon market code and safely falls back to US. */
export function normalizeTrendGeo(value?: string): string {
  const geo = (value ?? 'US').toUpperCase();
  return GOOGLE_TRENDS_GEOS.has(geo) ? geo : 'US';
}

/** Fetches the current public Google Trends RSS feed for one supported market. */
export async function fetchGoogleTrends(geo: string): Promise<GoogleTrendItem[]> {
  const safeGeo = normalizeTrendGeo(geo);
  const response = await fetch(
    `https://trends.google.com/trending/rss?geo=${encodeURIComponent(safeGeo)}`,
    { headers: { 'User-Agent': 'TrendPilot/1.0' } },
  );
  if (!response.ok) throw new Error(`上游响应 ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((match) => {
      const block = match[1];
      return {
        keyword: field(block, /<title>([\s\S]*?)<\/title>/),
        traffic: field(
          block,
          /<(?:ht:)?approx_traffic>([\s\S]*?)<\/(?:ht:)?approx_traffic>/,
        ),
        publishedAt: field(block, /<pubDate>([\s\S]*?)<\/pubDate>/),
        source: 'Google Trends' as const,
      };
    })
    .filter((item) => item.keyword);
}

/** Converts an abbreviated traffic label such as 20K+ into a sortable number. */
export function trendTrafficValue(value: string): number {
  const numeric = Number(value.replace(/[^\d.]/g, '')) || 0;
  if (/M/i.test(value)) return Math.round(numeric * 1_000_000);
  if (/K/i.test(value)) return Math.round(numeric * 1_000);
  return Math.round(numeric);
}

/** Persists one bounded collection result and its normalized market signals. */
export async function persistGoogleTrends(
  database: D1Database,
  geo: string,
  items: GoogleTrendItem[],
  startedAt: string,
): Promise<string> {
  const finishedAt = new Date().toISOString();
  const capturedDate = finishedAt.slice(0, 10);
  const statements = [
    database
      .prepare(
        'INSERT INTO source_runs (source,market,status,item_count,error_message,started_at,finished_at) VALUES (?,?,?,?,?,?,?)',
      )
      .bind('Google Trends', geo, 'success', items.length, '', startedAt, finishedAt),
    ...items.slice(0, 100).map((item) =>
      database
        .prepare(
          'INSERT INTO trend_signals (keyword,source,market,traffic_text,traffic_value,published_at,captured_date,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(keyword,source,market,captured_date) DO UPDATE SET traffic_text=excluded.traffic_text,traffic_value=excluded.traffic_value,published_at=excluded.published_at,created_at=excluded.created_at',
        )
        .bind(
          item.keyword,
          item.source,
          geo,
          item.traffic,
          trendTrafficValue(item.traffic),
          item.publishedAt,
          capturedDate,
          finishedAt,
        ),
    ),
  ];
  await database.batch(statements);
  return finishedAt;
}
