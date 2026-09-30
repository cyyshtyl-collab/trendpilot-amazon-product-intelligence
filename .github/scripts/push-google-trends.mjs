import { sign } from 'node:crypto';

const endpoint = process.env.TREND_PILOT_TRENDS_ENDPOINT;
const privateKey = process.env.TREND_PILOT_TRENDS_SIGNING_KEY;
if (!endpoint || !privateKey) throw new Error('Missing signed-ingest configuration');

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function field(block, pattern) {
  return decodeXml(block.match(pattern)?.[1] ?? '');
}

const response = await fetch('https://trends.google.com/trending/rss?geo=US', {
  headers: { 'User-Agent': 'TrendPilot-GitHub-Collector/1.0' },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`Google Trends responded ${response.status}`);
const xml = await response.text();
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  .map((match) => ({
    keyword: field(match[1], /<title>([\s\S]*?)<\/title>/),
    traffic: field(
      match[1],
      /<(?:ht:)?approx_traffic>([\s\S]*?)<\/(?:ht:)?approx_traffic>/,
    ),
    publishedAt: field(match[1], /<pubDate>([\s\S]*?)<\/pubDate>/),
    source: 'Google Trends',
  }))
  .filter((item) => item.keyword && item.traffic && item.publishedAt)
  .slice(0, 100);
if (!items.length) throw new Error('Google Trends feed contained no usable items');

const body = JSON.stringify({ geo: 'US', fetchedAt: new Date().toISOString(), items });
const timestamp = String(Date.now());
const signature = sign(
  null,
  Buffer.from(`${timestamp}.${body}`),
  privateKey.replace(/\\n/g, '\n'),
).toString('base64');
const ingest = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-TrendPilot-Timestamp': timestamp,
    'X-TrendPilot-Signature': signature,
  },
  body,
  signal: AbortSignal.timeout(30_000),
});
const result = await ingest.text();
if (!ingest.ok) throw new Error(`TrendPilot responded ${ingest.status}: ${result}`);
console.log(result);
