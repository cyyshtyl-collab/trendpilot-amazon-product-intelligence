import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const candidates = sqliteTable(
  'candidates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    asin: text('asin'),
    category: text('category').notNull(),
    market: text('market').notNull(),
    score: integer('score').notNull(),
    verdict: text('verdict').notNull(),
    trend: integer('trend').notNull().default(0),
    revenue: text('revenue').notNull().default('$0'),
    reviews: integer('reviews').notNull().default(0),
    margin: integer('margin').notNull().default(0),
    price: text('price').notNull().default('$0'),
    bsr: integer('bsr').notNull().default(0),
    rating: real('rating').notNull().default(0),
    searchVolume: integer('search_volume').notNull().default(0),
    reviewGrowth: integer('review_growth').notNull().default(0),
    reviewText: text('review_text').notNull().default(''),
    scoresJson: text('scores_json').notNull(),
    signalsJson: text('signals_json').notNull(),
    painsJson: text('pains_json').notNull(),
    sellingPoint: text('selling_point').notNull().default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_candidates_score').on(table.score),
    index('idx_candidates_verdict').on(table.verdict),
    uniqueIndex('idx_candidates_asin_market').on(table.asin, table.market),
  ],
);

export const analysisRuns = sqliteTable(
  'analysis_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    requested: integer('requested').notNull(),
    succeeded: integer('succeeded').notNull(),
    fallback: integer('fallback').notNull(),
    durationMs: integer('duration_ms').notNull(),
    status: text('status').notNull(),
    errorMessage: text('error_message').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_analysis_runs_created_at').on(table.createdAt)],
);

export const candidateSnapshots = sqliteTable(
  'candidate_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    candidateId: integer('candidate_id').notNull(),
    capturedDate: text('captured_date').notNull(),
    price: text('price').notNull().default('$0'),
    bsr: integer('bsr').notNull().default(0),
    rating: real('rating').notNull().default(0),
    reviews: integer('reviews').notNull().default(0),
    reviewGrowth: integer('review_growth').notNull().default(0),
    searchVolume: integer('search_volume').notNull().default(0),
    trend: integer('trend').notNull().default(0),
    revenue: text('revenue').notNull().default('$0'),
    margin: integer('margin').notNull().default(0),
    capturedAt: text('captured_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_snapshots_candidate_date').on(
      table.candidateId,
      table.capturedDate,
    ),
    index('idx_snapshots_captured_date').on(table.capturedDate),
  ],
);

export const alertActions = sqliteTable(
  'alert_actions',
  {
    alertKey: text('alert_key').primaryKey(),
    status: text('status').notNull().default('pending'),
    note: text('note').notNull().default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_alert_actions_status').on(table.status)],
);

export const sourceRuns = sqliteTable(
  'source_runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull(),
    market: text('market').notNull(),
    status: text('status').notNull(),
    itemCount: integer('item_count').notNull().default(0),
    errorMessage: text('error_message').notNull().default(''),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at').notNull(),
  },
  (table) => [index('idx_source_runs_started_at').on(table.startedAt)],
);

export const trendSignals = sqliteTable(
  'trend_signals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    keyword: text('keyword').notNull(),
    source: text('source').notNull(),
    market: text('market').notNull(),
    trafficText: text('traffic_text').notNull().default(''),
    trafficValue: integer('traffic_value').notNull().default(0),
    publishedAt: text('published_at').notNull().default(''),
    capturedDate: text('captured_date').notNull(),
    candidateId: integer('candidate_id'),
    promotedAt: text('promoted_at'),
    aiVerdict: text('ai_verdict'),
    aiScore: integer('ai_score'),
    aiReason: text('ai_reason'),
    screenedAt: text('screened_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_trend_signals_unique').on(
      table.keyword,
      table.source,
      table.market,
      table.capturedDate,
    ),
    index('idx_trend_signals_created_at').on(table.createdAt),
  ],
);

export const weeklyReports = sqliteTable(
  'weekly_reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    weekStart: text('week_start').notNull(),
    title: text('title').notNull(),
    markdown: text('markdown').notNull(),
    trackedCount: integer('tracked_count').notNull().default(0),
    highPotentialCount: integer('high_potential_count').notNull().default(0),
    watchCount: integer('watch_count').notNull().default(0),
    alertCount: integer('alert_count').notNull().default(0),
    status: text('status').notNull().default('ready'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_weekly_reports_week_start').on(table.weekStart),
    index('idx_weekly_reports_created_at').on(table.createdAt),
  ],
);

export const appUsers = sqliteTable(
  'app_users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    passwordSalt: text('password_salt').notNull(),
    role: text('role').notNull().default('member'),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_app_users_username').on(table.username)],
);
