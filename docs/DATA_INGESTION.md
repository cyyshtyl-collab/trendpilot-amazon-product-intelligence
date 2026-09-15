# 商品数据接入规范

## 1. 接入方式

系统支持两种方式：

1. 页面上传或粘贴 CSV：适合首次测试和临时数据，单次最多 1000 条，系统按批入库。
2. 自动 CSV Feed：适合长期运行，配置 HTTPS 下载地址，每 6 小时最多导入 500 条。

推荐让 Octoparse、飞书多维表格或 Airtable 输出同一份标准 CSV。更换上游渠道时，
下游趋势、AI 评分和周报无需修改。

## 2. 标准字段

| 字段 | 自动 Feed 必需 | 示例 | 说明 |
| --- | --- | --- | --- |
| `ASIN` | 是 | `B0XXXXXXXX` | 10 位字母或数字 |
| `产品名称` | 是 | `Travel Organizer` | Listing 标题或内部名称 |
| `类目` | 否 | `旅行配件` | 缺失时进入“待归类” |
| `站点` | 否 | `美国站` | 缺失默认美国站 |
| `价格` | 否 | `$29.99` | 保留货币符号 |
| `BSR` | 否 | `1250` | 大类排名 |
| `评分` | 否 | `4.4` | Amazon 星级 |
| `评论数` | 否 | `386` | 整数 |
| `关键词搜索量` | 否 | `18500` | 月度或约定周期，需保持口径一致 |
| `趋势增幅` | 否 | `24` | 百分数填 24，不填 0.24 |
| `月销售额` | 否 | `$38K` | 估算值需在来源说明中标识 |
| `毛利率` | 否 | `35` | 百分数填 35 |
| `差评内容` | 否 | `zipper broke` | 最多保留 20,000 字符 |

系统也识别常用英文别名，如 `name`、`title`、`category`、`market`、`price`、
`rating`、`reviews`、`search_volume` 和 `review_text`，以及 Octoparse 常见字段
`Product_name`、`Keyword`、`Stars`、`Rating_count`、`Current_price`。

## 3. CSV 示例

```csv
ASIN,产品名称,类目,站点,价格,BSR,评分,评论数,关键词搜索量,趋势增幅,月销售额,毛利率,差评内容
B0XXXXXXXX,Travel Organizer,旅行配件,美国站,$29.99,1250,4.4,386,18500,24,$38K,35,"zipper broke || hard to clean"
```

## 4. 更新规则

- 唯一键为 `ASIN + 站点`。
- 同一商品再次出现时更新 Listing 指标，不新增重复候选。
- 每个商品每天保存一条快照；当天重复采集会更新当天快照。
- 自动 Feed 必须使用 HTTPS，最大 5MB、500 行。
- ASIN 不合法、产品名为空或源文件不可访问时，整次任务失败并写入采集日志。

## 5. 配置自动 Feed

在 `/opt/trendpilot/app.env` 增加：

```dotenv
CANDIDATE_FEED_URL=https://example.com/export/products.csv
CANDIDATE_FEED_NAME=Octoparse Amazon US
```

然后重建应用容器。手动验证：

```bash
/opt/trendpilot/collect-candidate-feed.sh
tail -n 50 /var/log/trendpilot-automation.log
```

验证后检查页面“最近采集”、真实 ASIN 数量和某个产品的历史快照。

## 6. 数据真实性要求

- 公开产品方向只能标记为“公开趋势”，不能补造 ASIN、销量或评论。
- 价格、BSR、评分和评论数必须保留采集时间与来源。
- AI 不得生成或覆盖事实指标；AI 输出只进入评分、痛点和卖点字段。
- 不同站点、币种和搜索量周期必须明确标识，不能直接混合比较。
