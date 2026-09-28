BEGIN;

WITH verified(name, asin, category, price, rating, reviews, source_url) AS (
  VALUES
    ('FYGRIP 6 Pack Extra Heavy Duty Large Moving Storage Bags', 'B0DGF616XN', '旅行配件', '$26.98', 4.8, 10500, 'https://www.asinsight.com/report/US/small-packing-cubes'),
    ('90L Large Storage Bags 6 Pack Foldable Closet Organizers', 'B085ZV98JM', '旅行配件', '$19.99', 4.4, 65400, 'https://www.asinsight.com/report/US/small-packing-cubes'),
    ('Fab totes 6 Pack Foldable Clothes and Blanket Storage Bags', 'B092ZDHJMN', '旅行配件', '$16.55', 4.4, 38100, 'https://www.asinsight.com/report/US/small-packing-cubes'),
    ('BAGSMART Clear Toiletry Bag 2 Pack TSA Approved', 'B0BFR2C7Y1', '旅行配件', '$8.99', 4.6, 5300, 'https://www.asinsight.com/report/US/small-packing-cubes'),
    ('Pieviev Double Layer Waterproof Cat Litter Mat 24 x 15 Inch', 'B07NJ5SR5G', '宠物用品', '$11.27', 4.4, 73300, 'https://www.asinsight.com/report/US/litter-box-mats'),
    ('Amazon Basics Odor Control Cat Litter Pee Pads 40 Count', 'B07K8RWX12', '宠物用品', '$20.71', 4.5, 45700, 'https://www.asinsight.com/report/US/litter-box-mats'),
    ('Amazon Basics Less-Mess Litter Trapping Cat Mat 24 x 35 Inch', 'B072569V1L', '宠物用品', '$12.40', 4.5, 19700, 'https://www.asinsight.com/report/US/litter-box-mats'),
    ('Powools Waterproof Small Cat Litter Trapping Mat', 'B0CP8ZHJ6V', '宠物用品', '$7.56', 4.4, 5100, 'https://www.asinsight.com/report/US/litter-box-mats'),
    ('Pieviev Double Layer Waterproof Cat Litter Mat 30 x 24 Inch', 'B01MTQNK6H', '宠物用品', '$21.24', 4.4, 73400, 'https://www.asinsight.com/report/US/litter-box-mats'),
    ('GORILLA GRIP Cushioned Cat Litter Box Mat 24 x 17 Inch', 'B07GYZPM94', '宠物用品', '$11.99', 4.5, 53500, 'https://www.asinsight.com/report/US/litter-box-mats'),
    ('URMONA Waterproof Silicone Under Sink and Pet Mat', 'B0B8VWFZLL', '宠物用品', '$10.79', 4.7, 6000, 'https://www.asinsight.com/report/US/litter-box-mats'),
    ('Drymate Waterproof Machine Washable Cat Litter Mat XL', 'B099HBMZ67', '宠物用品', '$19.99', 4.2, 10200, 'https://www.asinsight.com/report/US/litter-box-mats'),
    ('Garoopion Large Waterproof Silicone Cat Litter Mat', 'B0DBLJK2B4', '宠物用品', '$22.99', 4.5, 2800, 'https://www.asinsight.com/report/US/litter-box-mats'),
    ('Compact Honeycomb Waterproof Cat Litter Mat', 'B0DKNGKHWH', '宠物用品', '$6.99', 4.3, 24200, 'https://www.asinsight.com/report/US/cat-litter-mats'),
    ('BASIC CONCEPTS Airplane Foot Hammock', 'B07SK6ZFLM', '办公用品', '$14.95', 4.1, 10100, 'https://www.asinsight.com/report/US/under-desk-foot-rest'),
    ('BlissTrends Adjustable Foot Rest with Washable Cover', 'B0BFQX3YFY', '办公用品', '$19.99', 4.4, 8700, 'https://www.asinsight.com/report/US/under-desk-foot-rest'),
    ('CasaZenith Rocking Under Desk Foot Rest with Roller Massager', 'B0CPFTDT6P', '办公用品', '$9.99', 4.1, 2300, 'https://www.asinsight.com/report/US/under-desk-foot-rest'),
    ('No-Collapse Airplane Foot Hammock with Adjustable Strap', 'B0DRVS88XJ', '旅行配件', '$12.99', 4.3, 559, 'https://www.asinsight.com/report/US/under-desk-foot-rest'),
    ('TranquilRelax Adjustable Under Desk Foot Rest', 'B0DK4HP264', '办公用品', '$21.99', 4.6, 933, 'https://www.asinsight.com/report/US/under-desk-foot-rest'),
    ('HUANUO Adjustable Desk Footrest with Massage Surface', 'B07L3RVF7C', '办公用品', '$29.99', 4.2, 13100, 'https://www.asinsight.com/report/US/under-desk-foot-rest'),
    ('ComfiLife Adjustable Memory Foam Under Desk Foot Rest', 'B08DHMMBFF', '办公用品', '$34.19', 4.6, 13900, 'https://www.asinsight.com/report/US/under-desk-foot-rest'),
    ('2-Pack Airplane Travel Footrest Hammock', 'B0CQNWL1FV', '旅行配件', '$17.69', 4.3, 744, 'https://www.asinsight.com/report/US/under-desk-foot-rest'),
    ('Six Heights Adjustable Under Desk Foot Rest with Massage Roller', 'B0CW1ZYZ7S', '办公用品', '$19.99', 4.4, 982, 'https://www.asinsight.com/report/US/under-desk-foot-rest'),
    ('Mind Reader Height Adjustable Ergonomic Office Foot Rest', 'B01MSQDE0U', '办公用品', '$26.99', 4.2, 18800, 'https://www.asinsight.com/report/US/under-desk-foot-rest')
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
  '2026-09-23T05:00:00.000Z'
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
  search_volume, trend, revenue, margin, '2026-09-23T05:00:00.000Z'
FROM candidates
WHERE asin IN (
  'B0DGF616XN','B085ZV98JM','B092ZDHJMN','B0BFR2C7Y1','B07NJ5SR5G','B07K8RWX12',
  'B072569V1L','B0CP8ZHJ6V','B01MTQNK6H','B07GYZPM94','B0B8VWFZLL','B099HBMZ67',
  'B0DBLJK2B4','B0DKNGKHWH','B07SK6ZFLM','B0BFQX3YFY','B0CPFTDT6P','B0DRVS88XJ',
  'B0DK4HP264','B07L3RVF7C','B08DHMMBFF','B0CQNWL1FV','B0CW1ZYZ7S','B01MSQDE0U'
)
  AND market='美国站'
ON CONFLICT (candidate_id, captured_date) DO UPDATE SET
  price=EXCLUDED.price,
  bsr=EXCLUDED.bsr,
  rating=EXCLUDED.rating,
  reviews=EXCLUDED.reviews,
  captured_at=EXCLUDED.captured_at;

COMMIT;
