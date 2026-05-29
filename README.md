# AICompass

AI 商业化资讯热度榜单工具。聚合 36氪、雷峰网、量子位、钛媒体 等AI商业化资讯源，通过 LLM（DeepSeek）进行多维度热度评分，输出各网站 TOP10 商业化热点榜单。

## 快速开始

```bash
# 安装依赖
npm install

# 设置 DeepSeek API Key（评分用）
export DEEPSEEK_API_KEY="sk-xxxxxxxxxxxxxxxx"

# 启动服务
npm start

# 访问
open http://localhost:3000/api/v1/rankings
```

## 定时任务

| 时间 | 任务 | 说明 |
|------|------|------|
| 05:00 | 爬取数据 | 从各数据源抓取最新文章 |
| 06:10 | LLM 评分 | 对当天爬取的数据进行热度评分 |

也可手动触发：

```bash
# 手动爬取
curl -X POST http://localhost:3000/api/v1/crawl/trigger

# 手动评分
node -e "require('./src/services/llmScoringService').scoreAllSources()"

# 设置 36kr Cookie（绕过反爬）
npm run set-cookies
```

## Railway 部署

### 一键部署

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template)

### 手动部署

1. **推送代码到 GitHub**

   ```bash
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/your-username/ai-compass.git
   git push -u origin main
   ```

2. **在 Railway 创建项目**

   - 打开 https://railway.app
   - 点击 **New Project** → **Deploy from GitHub repo**
   - 选择 `ai-compass` 仓库

3. **设置环境变量**

   在 Railway Dashboard → 项目 → **Variables** 中添加：

   | 变量 | 说明 |
   |------|------|
   | `DEEPSEEK_API_KEY` | DeepSeek API Key，用于 LLM 评分 |
   | `PORT` | 端口（Railway 自动分配，无需手动设置） |

4. **部署完成**

   部署后 Railway 会自动分配域名，如 `https://ai-compass.up.railway.app`。

   验证：

   ```
   curl https://ai-compass.up.railway.app/health
   curl https://ai-compass.up.railway.app/api/v1/sources
   curl https://ai-compass.up.railway.app/api/v1/rankings
   ```

### 注意事项

- **36kr 反爬**：Railway 上的 IP 会被 36kr WAF 拦截，建议在部署后通过 `npm run set-cookies` 设置 Cookie（需本地执行，Cookie 会随代码部署保存至 `cookies/36kr.txt`）。也可以接受使用 mock 数据。
- **定时任务**：Railway 使用 UTC 时间，05:00 CST = 21:00 UTC 前一天的 21:00。如需调整时区，可修改 `src/services/scheduler.js` 中的 cron 表达式。
- **数据持久化**：`cache/` 目录保存在 Railway 的临时文件系统中，重启后会丢失。建议定期手动爬取或接受评分缓存的重置。

### Railway 配置参考

无需额外配置文件。Railway 通过 Nixpacks 自动识别 Node.js 项目，使用 `package.json` 中的 `start` 脚本启动。

默认启动命令（已配置）：`node src/server.js`

## 项目结构

```
src/
├── server.js                    # 入口
├── app.js                       # Express 配置
├── config/
│   ├── index.js                 # 全局配置
│   └── sources.js               # 数据源定义
├── services/
│   ├── crawlers/                # 各站爬虫
│   │   ├── 36krCrawler.js
│   │   ├── qbitaiCrawler.js
│   │   ├── leiphoneCrawler.js
│   │   └── tmtpostCrawler.js
│   ├── crawlerService.js        # 爬虫调度
│   ├── filterService.js         # 关键词筛选
│   ├── clusterService.js        # 标题聚类
│   ├── scoringService.js        # Mock 评分
│   ├── llmScoringService.js     # LLM 评分
│   ├── rankingService.js        # 榜单生成
│   └── scheduler.js             # 定时任务
├── controllers/
│   └── rankingController.js     # API 处理器
├── routes/
│   └── index.js                 # 路由定义
├── data/
│   └── mock.js                  # Mock 数据
└── utils/
    └── logger.js                # 日志
```

## API 文档

详见 [API.md](./API.md)。

## 使用手册

详见 [MANUAL.md](./MANUAL.md)。
