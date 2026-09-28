BEGIN;

WITH verified(name, asin, price, rating, reviews, source_url) AS (
  VALUES
    ('Car Seat Gap Filler Organizer of 2 – Universal Storage Pockets', 'B0G487Q431', '$6.99', 3.8, 328, 'https://www.asinsight.com/report/US/car-gap-seat-filler'),
    ('Leather Car Seat Gap Filler, 2 Pack No-Drop Seat Guard', 'B0CB36TLQP', '$9.99', 4.3, 1100, 'https://www.asinsight.com/report/US/car-seat-gap-filler'),
    ('YLXGT Car Seat Gap Filler Organizer Universal 2 Pack', 'B0F8QGB4NX', '$8.99', 4.0, 1900, 'https://www.asinsight.com/report/US/car-seat-gap-filler'),
    ('2 Pack No Drop Car Seat Gap Filler Guard', 'B0F9YTPNQP', '$9.89', 3.9, 525, 'https://www.asinsight.com/report/US/car-seat-gap-filler')
)
INSERT INTO candidates (
  name, asin, category, data_origin, market, score, verdict, trend, revenue,
  reviews, margin, price, bsr, rating, search_volume, review_growth,
  review_text, scores_json, signals_json, pains_json, selling_point, updated_at
)
SELECT
  name, asin, '汽车用品', 'automated_feed', '美国站', 15, '观察', 0, '$0',
  reviews, 0, price, 0, rating, 0, 0, '', '[3,3,3,3,3]',
  json_build_array('公开 Listing 榜单核验', source_url, '核验日期 2026-09-23')::text,
  '["等待真实评论文本后提炼痛点"]', '等待 AI 生成卖点文案',
  '2026-09-23T03:00:00.000Z'
FROM verified
ON CONFLICT (asin, market) DO UPDATE SET
  name=EXCLUDED.name,
  category=EXCLUDED.category,
  data_origin=EXCLUDED.data_origin,
  price=CASE WHEN EXCLUDED.price NOT IN ('','$0') THEN EXCLUDED.price ELSE candidates.price END,
  rating=CASE WHEN EXCLUDED.rating > 0 THEN EXCLUDED.rating ELSE candidates.rating END,
  reviews=CASE WHEN EXCLUDED.reviews > 0 THEN EXCLUDED.reviews ELSE candidates.reviews END,
  signals_json=EXCLUDED.signals_json,
  updated_at=EXCLUDED.updated_at;

INSERT INTO candidate_snapshots (
  candidate_id, captured_date, price, bsr, rating, reviews, review_growth,
  search_volume, trend, revenue, margin, captured_at
)
SELECT
  id, '2026-09-23', price, bsr, rating, reviews, review_growth,
  search_volume, trend, revenue, margin, '2026-09-23T03:00:00.000Z'
FROM candidates
WHERE asin IN ('B0G487Q431','B0CB36TLQP','B0F8QGB4NX','B0F9YTPNQP')
  AND market='美国站'
ON CONFLICT (candidate_id, captured_date) DO UPDATE SET
  price=EXCLUDED.price,
  bsr=EXCLUDED.bsr,
  rating=EXCLUDED.rating,
  reviews=EXCLUDED.reviews,
  captured_at=EXCLUDED.captured_at;

COMMIT;
