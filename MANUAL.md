# AICompass 使用手册

---

## 一、启动服务

```bash
# 设置 DeepSeek API Key（评分用）
export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxx"

# 启动
npm start
```

服务启动后，访问 `http://localhost:3000`。

### 定时任务（仅本地开发有效）

```
05:00 — 爬取所有数据源（需服务 24 小时运行）
06:10 — LLM 评分（需服务 24 小时运行）
```

> 部署到 Railway 时，`node-cron` 因实例休眠无法可靠触发，请改用 Railway Cron Jobs（见第六节）。

---

## 二、设置 36kr Cookie

36kr 有 WAF 反爬，需要手动从浏览器复制 Cookie 才能爬取。

### 操作步骤

```
1. 用 Chrome 打开 https://36kr.com/feed
2. 完成滑块验证（如果弹出）
3. 按 F12 打开 DevTools
4. 切换到 Network（网络）标签页
5. 刷新页面
6. 点击第一个请求（通常是 feed 请求）
7. 在 Request Headers 中找到 cookie: 这一行
8. 右键 → Copy value
```

### 运行设置命令

```bash
npm run set-cookies
```

按提示粘贴刚才复制的内容，脚本会自动验证 Cookie 是否有效。

### Cookie 过期

Cookie 有效期不定（通常几小时到几天），如果发现 36kr 返回的都是 mock 数据，说明 Cookie 过期了，重新跑一次 `npm run set-cookies` 即可。

---

## 三、手动运行爬取

```bash
# 方法一：通过 API 触发（同步等待返回）
curl http://localhost:3000/api/v1/crawl/trigger

# 方法二：直接运行脚本
node -e "require('./src/services/scheduler').executeCrawl()"
```

爬取结果：
- 数据保存在 `cache/{sourceId}.json`
- 状态记录在 `cache/last-crawl.json`
- 可通过 `GET /api/v1/crawl/status` 查看

### 查看爬取状态

```bash
curl http://localhost:3000/api/v1/crawl/status
```

返回示例：
```json
{
  "success": true,
  "data": {
    "lastCrawlTime": "2026-05-28T08:30:46.331Z",
    "sources": {
      "36kr":    { "status": "success", "articleCount": 30, "sourceType": "real" },
      "leiphone":{ "status": "success", "articleCount": 20, "sourceType": "real" },
      "qbitai":  { "status": "success", "articleCount": 10, "sourceType": "real" },
      "tmtpost": { "status": "success", "articleCount": 18, "sourceType": "real" }
    }
  }
}
```

`sourceType` 说明：
- `real` — 真实爬虫成功
- `cache` — 使用历史缓存
- `mock` — 使用 mock 数据

---

## 四、手动运行 LLM 评分

```bash
# 方法一：通过 API 触发（同步等待返回）
curl http://localhost:3000/api/v1/score/trigger

# 方法二：直接运行脚本
node -e "require('./src/services/llmScoringService').scoreAllSources()"
```

评分逻辑：
1. 读取 `cache/{sourceId}.json` 中的爬取数据
2. 检查数据是否当天爬取的（判断 `crawledAt` 是否为今天）
3. 是 → 关键词筛选 → 聚类 → 发送给 DeepSeek → 保存评分
4. 否 → 跳过该源，保留上次评分结果

评分结果保存在 `cache/scored-rankings.json`，采用追加记录方式，每源最多保留 10 条。

### 查看评分结果

```bash
curl http://localhost:3000/api/v1/rankings
```

返回数据包含 `dimensions` 字段：
```json
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
```

---

## 五、Railway 部署定时任务

Railway 免费版实例在无请求 30 分钟后会休眠，`node-cron` 无法可靠触发。改用 Railway 内置的 **Cron Jobs**，它会在指定时间唤醒实例并发起 HTTP 请求。

### 配置步骤

进入 Railway Dashboard → 项目 → **Cron Jobs**，添加两条：

| 频率 (UTC) | 对应 CST | 端点（GET） |
|-----------|---------|------------|
| `0 21 * * *` | 每日 05:00 | `https://你的域名.up.railway.app/api/v1/crawl/trigger` |
| `10 22 * * *` | 每日 06:10 | `https://你的域名.up.railway.app/api/v1/score/trigger` |

### 验证

Cron Jobs 配置后，到达指定时间 Railway 会发起 GET 请求，任务完成后返回 JSON 结果。

也可以手动测试：

```bash
curl https://你的域名.up.railway.app/api/v1/crawl/trigger
curl https://你的域名.up.railway.app/api/v1/score/trigger
```

---

## 六、常见问题

### 36kr 一直返回 mock 数据

Cookie 过期了，重新 `npm run set-cookies`。

### 评分结果为 null

检查是否设置了 `DEEPSEEK_API_KEY` 环境变量。

### 某个源没有数据

查看 `GET /api/v1/crawl/status` 确认爬取状态。如果是 mock 且无缓存，说明该源不可用，等待后续爬虫更新。

### Railway 上定时任务没触发

是否配置了 Cron Jobs？`node-cron` 在 Railway 不可靠，请按第五节的步骤在 Dashboard 中配置。

---

## 七、数据文件说明

| 文件 | 用途 |
|------|------|
| `cache/36kr.json` | 36kr 爬取原始数据 |
| `cache/leiphone.json` | 雷峰网爬取原始数据 |
| `cache/qbitai.json` | 量子位爬取原始数据 |
| `cache/tmtpost.json` | 钛媒体爬取原始数据 |
| `cache/last-crawl.json` | 爬取时间和各源状态 |
| `cache/scored-rankings.json` | LLM 评分结果（追加记录） |

### 评分记录格式（scored-rankings.json）

每个源维护一个记录列表，每次评分追加一条：

```json
{
  "36kr": [
    {
      "scoredAt": "2026-05-28T08:30:00.000Z",
      "crawlDate": "2026-05-28",
      "sourceType": "real",
      "items": [ ...TOP10 条目... ]
    }
  ]
}
```

超过 10 条时自动删除最旧记录（FIFO）。

---

## 八、API 一览

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/rankings` | 获取全部榜单 |
| GET | `/api/v1/rankings/:source` | 获取指定源榜单 |
| GET | `/api/v1/sources` | 获取数据源列表 |
| GET | `/api/v1/fields` | 获取字段说明 |
| GET | `/api/v1/crawl/status` | 查看爬取状态 |
| GET | `/api/v1/crawl/trigger` | 手动触发爬取 |
| GET | `/api/v1/score/trigger` | 手动触发评分 |
| GET | `/api/v1/updatetime` | 获取各源更新时间 |
| GET | `/health` | 健康检查 |
