const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(movie|movies|netflix|episode|season|actor|actress|celebrity|lyrics|song|album)\b/i, reason: '影视娱乐内容' },
  { pattern: /\b(election|president|senate|congress|politics|war|attack|shooting)\b/i, reason: '政治或突发新闻' },
  { pattern: /\b(score|standings|baseball|football|nba|nfl|mlb|match|tournament)\b/i, reason: '体育赛事信息' },
  { pattern: /\b(weather|earthquake|flood watch|storm|hurricane|forecast|near me)\b/i, reason: '天气或灾害事件' },
  { pattern: /\b(income|salary|tax|stock|crypto|price today|data breach|cloud computing)\b/i, reason: '金融或信息服务' },
  { pattern: /\b(who is|what is|how to|when is|where is)\b/i, reason: '知识问答意图' },
];

/** Rejects obvious non-product search intent before a signal can enter the product pool. */
export function productIntent(keyword: string): { allowed: boolean; reason: string } {
  const normalized = keyword.trim();
  if (normalized.length < 3) return { allowed: false, reason: '关键词过短' };
  const blocked = BLOCKED_PATTERNS.find(({ pattern }) => pattern.test(normalized));
  return blocked
    ? { allowed: false, reason: blocked.reason }
    : { allowed: true, reason: '通过基础商品意图校验' };
}
