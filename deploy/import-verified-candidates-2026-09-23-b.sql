BEGIN;

WITH verified(name, asin, category, price, rating, reviews, source_url) AS (
  VALUES
    ('Yipetor Slow Feeder Dog Bowl for Liquid Treat with Enrichment Ball', 'B0FQC9JN15', '宠物用品', '$16.99', 3.8, 1200, 'https://www.asinsight.com/report/US/slow-feed-dog-bowl'),
    ('Slow Feeder Dog Bowl and Lick Mat with Interactive Rolling Ball', 'B0GRR8NJX6', '宠物用品', '$17.99', 4.0, 164, 'https://www.asinsight.com/report/US/slow-feed-dog-bowl'),
    ('ErGear Single Monitor Arm for 13–34 Inch Screens', 'B0FQM6QB48', '电脑配件', '$19.98', 4.4, 4000, 'https://www.asinsight.com/report/US/single-monitor-stand'),
    ('HUANUO FlowLift Pro Monitor Arm for 13–32 Inch Screens', 'B0GK7FVTR4', '电脑配件', '$29.99', 4.5, 493, 'https://www.asinsight.com/report/US/single-monitor-stand'),
    ('HUANUO FlowLift Single Monitor Mount for 13–32 Inch Screens', 'B07T3KCQ94', '电脑配件', '$35.99', 4.6, 16300, 'https://www.asinsight.com/report/US/single-monitor-stand'),
    ('WALI Adjustable Monitor Stand with Under-Desk Storage', 'B094QTGHNZ', '电脑配件', '$9.99', 4.7, 15600, 'https://www.asinsight.com/report/US/monitor-stand-for-desk-with-storage'),
    ('gianotter Dual Monitor Stand Riser with Drawer', 'B0DJKSMV2T', '电脑配件', '$27.54', 4.6, 2900, 'https://www.asinsight.com/report/US/monitor-stand-for-desk-with-storage'),
    ('OPNICE 2-Tier Computer Monitor Stand Riser with Drawer', 'B0DB8F7GDN', '电脑配件', '$21.99', 4.7, 2900, 'https://www.asinsight.com/report/US/monitor-stand-for-desk-with-storage'),
    ('WESTREE Dual Monitor Stand Riser Wood and Steel', 'B09QWC568X', '电脑配件', '$28.49', 4.6, 3700, 'https://www.asinsight.com/report/US/monitor-stand-for-desk-with-storage'),
    ('BONTEC Adjustable Dual Monitor Stand Riser', 'B0C4SZ286V', '电脑配件', '$23.45', 4.6, 7800, 'https://www.asinsight.com/report/US/monitor-stand-for-desk-with-storage')
)
INSERT INTO candidates (
  name, asin, category, data_origin, market, score, verdict, trend, revenue,
  reviews, margin, price, bsr, rating, search_volume, review_growth,
  review_text, scores_json, signals_json, pains_json, selling_point, updated_at
)
SELECT
  name, asin, category, 'automated_feed', '美国站', 15, '观察', 0, '$0',
  reviews, 0, price, 0, rating, 0, 0, '', '[3,3,3,3,3]',
  json_build_array('公开 Listing 榜单核验', source_url, '核验日期 2026-09-23')::text,
  '["等待真实评论文本后提炼痛点"]', '等待 AI 生成卖点文案',
  '2026-09-23T04:00:00.000Z'
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
  search_volume, trend, revenue, margin, '2026-09-23T04:00:00.000Z'
FROM candidates
WHERE asin IN (
  'B0FQC9JN15','B0GRR8NJX6','B0FQM6QB48','B0GK7FVTR4','B07T3KCQ94',
  'B094QTGHNZ','B0DJKSMV2T','B0DB8F7GDN','B09QWC568X','B0C4SZ286V'
)
  AND market='美国站'
ON CONFLICT (candidate_id, captured_date) DO UPDATE SET
  price=EXCLUDED.price,
  bsr=EXCLUDED.bsr,
  rating=EXCLUDED.rating,
  reviews=EXCLUDED.reviews,
  captured_at=EXCLUDED.captured_at;

COMMIT;
