# AICompass REST API 文档

> Base URL: `http://localhost:3000`

---

## 1. 获取全部榜单

获取所有数据源的 TOP10 商业化热点榜单。

```
GET /api/v1/rankings
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "36kr": [
      {
        "rank": 1,
        "title": "刚刚，国产AI自己造了AI，全球首例！",
        "score": 68,
        "dimensions": {
          "business_impact": 30,
          "discussion_density": 10,
          "timeliness": 18,
          "authority": 8
        },
        "reason": "面壁智能发布全球首个AI编写大模型框架，商业潜力大",
        "url": "https://www.qbitai.com/2026/05/425511.html"
      }
    ],
    "leiphone": [ ... ],
    "qbitai": [ ... ],
    "tmtpost": [ ... ]
  }
}
```

### 返回说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 请求是否成功 |
| `data` | object | key 为数据源 id，value 为榜单数组 |
| `data.{sourceId}[].rank` | int (1-10) | 排名，按热度降序 |
| `data.{sourceId}[].title` | string | 热点标题（可点击跳转至原始文章） |
| `data.{sourceId}[].score` | int (0-100) | 热度分，由 LLM 综合评估 |
| `data.{sourceId}[].dimensions` | object | 四维度细分评分，`null` 表示未评分 |
| `data.{sourceId}[].dimensions.business_impact` | int (0-40) | 商业影响力，权重 40% |
| `data.{sourceId}[].dimensions.discussion_density` | int (0-30) | 讨论密度，权重 30% |
| `data.{sourceId}[].dimensions.timeliness` | int (0-20) | 时效性，权重 20% |
| `data.{sourceId}[].dimensions.authority` | int (0-10) | 信源权威性，权重 10% |
| `data.{sourceId}[].reason` | string | LLM 给出的评分理由 |
| `data.{sourceId}[].url` | string | 原始文章链接 |

---

## 2. 获取指定数据源榜单

```
GET /api/v1/rankings/:source
```

### 路径参数

| 参数 | 类型 | 说明 | 可选值 |
|------|------|------|--------|
| `source` | string | 数据源 ID | `36kr`, `leiphone`, `qbitai`, `tmtpost` |

### 成功响应

```json
{
  "success": true,
  "data": {
    "36kr": [
      {
        "rank": 1,
        "title": "DeepSeek宣布旗舰模型75%折扣永久化，点燃AI价格战",
        "score": 95,
        "reason": "多维度商业影响力突出",
        "url": "https://36kr.com/p/123456789"
      }
    ]
  }
}
```

### 错误响应（无效数据源）

```json
{
  "success": false,
  "error": "无效的数据源: invalid-source。可选值: 36kr, leiphone, qbitai, tmtpost"
}
```

---

## 3. 获取数据源列表

获取所有商业化资讯源的元信息。

```
GET /api/v1/sources
```

### 响应示例

```json
{
  "success": true,
  "data": [
    {
      "id": "36kr",
      "name": "36氪 - AI频道",
      "url": "https://36kr.com/info/AI/",
      "tag": "创投融资",
      "updateFrequency": "每日",
      "crawlRange": "近1-2周AI商业化相关内容"
    },
    {
      "id": "leiphone",
      "name": "雷峰网",
      "url": "https://www.leiphone.com",
      "tag": "AI技术产业",
      "updateFrequency": "每日",
      "crawlRange": "近1-2周AI商业化相关内容"
    },
    {
      "id": "qbitai",
      "name": "量子位",
      "url": "https://www.qbitai.com",
      "tag": "动态雷达",
      "updateFrequency": "每日",
      "crawlRange": "近1-2周AI商业化相关内容"
    },
    {
      "id": "tmtpost",
      "name": "钛媒体",
      "url": "https://www.tmtpost.com",
      "tag": "商业模式",
      "updateFrequency": "每日",
      "crawlRange": "近1-2周AI商业化相关内容"
    }
  ]
}
```

### 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 数据源唯一标识（用于 `/rankings/:source`） |
| `name` | string | 数据源展示名称 |
| `url` | string | 数据源首页地址 |
| `tag` | string | 内容定位标签 |
| `updateFrequency` | string | 更新频率（每日/每周/不定期） |
| `crawlRange` | string | 抓取范围说明 |

---

## 4. 获取字段说明

获取榜单各字段的定义和统计方法，供前端展示说明。

```
GET /api/v1/fields
```

### 响应示例

```json
{
  "success": true,
  "data": [
    {
      "field": "排名",
      "definition": "该热点在该网站近期商业化内容中的重要性顺序",
      "method": "按LLM评分从高到低排列"
    },
    {
      "field": "标题",
      "definition": "该热点资讯的核心内容摘要，可点击跳转",
      "method": "从聚类后的议题中提取代表文章标题"
    },
    {
      "field": "热度",
      "definition": "该热点在该网站商业化内容中的综合关注度（百分制）",
      "method": "LLM基于商业影响力、讨论密度、时效性、信源权威性四个维度综合评分"
    },
    {
      "field": "评分理由",
      "definition": "LLM给出该热度的判断依据",
      "method": "LLM生成的定性说明"
    },
    {
      "field": "URL",
      "definition": "该热点对应的原始文章链接",
      "method": "从该议题中选取位置分最高的文章URL"
    }
  ]
}
```

---

## 5. 获取爬取状态

返回定时任务的最近一次爬取时间和各数据源状态。

```
GET /api/v1/crawl/status
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "lastCrawlTime": "2026-05-27T05:00:00.000Z",
    "sources": {
      "36kr": { "status": "success", "articleCount": 15 },
      "leiphone": { "status": "success", "articleCount": 20 },
      "qbitai": { "status": "success", "articleCount": 10 },
      "tmtpost": { "status": "success", "articleCount": 18 }
    }
  }
}
```

### 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `lastCrawlTime` | string (ISO) | 最近一次爬取时间，`null` 表示从未爬取 |
| `sources.{id}.status` | string | 数据源状态：`success` / `empty` |
| `sources.{id}.articleCount` | int | 该源本次抓取的文章数 |

---

## 6. 手动触发爬取

立即触发一次全量数据爬取（POST 请求，异步执行）。

```
POST /api/v1/crawl/trigger
```

### 响应示例

```json
{
  "success": true,
  "message": "开始爬取数据..."
}
```

> 该接口立即返回，爬取在后台异步执行。完成后可通过 `GET /api/v1/crawl/status` 查看结果。

---

## 7. 健康检查

```
GET /health
```

### 响应示例

```json
{
  "status": "ok",
  "timestamp": "2026-05-26T05:28:13.689Z"
}
```

---

## 错误处理

### 通用错误响应格式

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 参数错误（如无效的 source） |
| 500 | 服务器内部错误 |

---

## 前端对接注意事项

1. **CORS 已开启**，前端可直接跨域调用
2. `success` 字段用于判断业务成功/失败，不要在 http 状态码上判断
3. 榜单每次请求会实时生成（含爬虫和 LLM 评分），生产环境建议加缓存
4. 榜单中 `url` 字段为原始文章链接，前端应在新标签页打开
5. 每条热点最多返回 TOP10，排序字段为 `rank`（1 到 10）
