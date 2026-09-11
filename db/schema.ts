import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const candidates = sqliteTable(
  'candidates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    category: text('category').notNull(),
    market: text('market').notNull(),
    score: integer('score').notNull(),
    verdict: text('verdict').notNull(),
    trend: integer('trend').notNull().default(0),
    revenue: text('revenue').notNull().default('$0'),
    reviews: integer('reviews').notNull().default(0),
    margin: integer('margin').notNull().default(0),
    scoresJson: text('scores_json').notNull(),
    signalsJson: text('signals_json').notNull(),
    painsJson: text('pains_json').notNull(),
    sellingPoint: text('selling_point').notNull().default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_candidates_score').on(table.score),
    index('idx_candidates_verdict').on(table.verdict),
  ],
);
