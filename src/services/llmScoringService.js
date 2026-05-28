const axios = require('axios');
const { filterCommercialArticles } = require('./filterService');
const { clusterArticles } = require('./clusterService');
const { RANKING_TOP_N } = require('../config');
const { logger } = require('../utils/logger');

const LLM_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const LLM_MODEL = 'deepseek-v4-flash';
const MAX_RECORDS_PER_SOURCE = 10;

function getApiKey() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error('DEEPSEEK_API_KEY environment variable not set');
  }
  return key;
}

const SYSTEM_PROMPT = `你是一个专业的AI商业化资讯热度评估专家。你的任务是对一批AI商业化议题进行评分和排序。

## 评分维度（权重由高到低）

1. **商业影响力（40%）**：该议题对相关行业/公司的实质商业影响有多大？
   - 高分示例：大模型永久降价、头部公司IPO、亿级融资
   - 低分示例：小众产品的小版本更新、学术论文发布

2. **讨论密度（30%）**：有多少篇文章在讨论这个议题？（我会提供文章数量）
   - 多篇文章说明行业关注度高

3. **时效性（20%）**：议题的新鲜度
   - 近3天内的事件得分高，超过10天的得分低

4. **信源权威性（10%）**：报道该议题的信源质量
   - 36氪、机器之心等头部媒体报道权重更高

## 输出要求

对每个议题输出：
- 热度总分 (1-100的整数)
- 各维度得分：business_impact (0-40), discussion_density (0-30), timeliness (0-20), authority (0-10)
- 评分理由（一句话，说明为什么给这个分数）

输出格式为JSON对象，包含scores数组：
{
  "scores": [
    {
      "original_title": "原议题标题",
      "score": 88,
      "dimensions": {
        "business_impact": 35,
        "discussion_density": 25,
        "timeliness": 15,
        "authority": 8
      },
      "reason": "DeepSeek永久降价是2026年最重要的定价策略变化，直接影响整个行业格局"
    }
  ]
}

## 注意事项
- 分数分布应拉开差距：85分以上应该是极少数现象级议题，60-80分是本周核心热点，40-60分是常规议题
- 不要被单个爆款文章的标题党带偏，结合文章数量判断
- 评分要稳定，相同输入应给出相同输出`;

function buildUserPrompt(sourceId, issues) {
  const items = issues.map(
    (issue, i) =>
      `${i + 1}. 标题: ${issue.title}\n   文章数: ${issue.article_count}\n   内容预览: ${issue.content_preview.substring(0, 200)}`
  ).join('\n\n');

  return `请对以下来自 ${sourceId} 的 ${issues.length} 个AI商业化议题进行评分：

${items}

请为每个议题输出热度总分（1-100）和各维度得分。`;
}

function clampScore(val, min, max) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

async function callLLM(issues) {
  const apiKey = getApiKey();

  const response = await axios.post(
    LLM_API_URL,
    {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt('all', issues) },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 4096,
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  const content = response.data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  const parsed = JSON.parse(content);
  const scoredList = parsed.scores || parsed.data || (Array.isArray(parsed) ? parsed : []);

  return scoredList.map((item) => ({
    original_title: item.original_title,
    score: clampScore(item.score, 1, 100),
    dimensions: {
      business_impact: clampScore(item.dimensions?.business_impact, 0, 40),
      discussion_density: clampScore(item.dimensions?.discussion_density, 0, 30),
      timeliness: clampScore(item.dimensions?.timeliness, 0, 20),
      authority: clampScore(item.dimensions?.authority, 0, 10),
    },
    reason: item.reason || '',
  }));
}

async function scoreIssuesWithLLM(sourceId, issues) {
  logger.info(`[LLMScoring] Sending ${issues.length} issues to LLM for ${sourceId}`);

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      const result = await callLLM(issues);
      logger.info(`[LLMScoring] LLM scored ${result.length} issues for ${sourceId}`);

      if (result.length !== issues.length) {
        logger.warn(`[LLMScoring] Expected ${issues.length} results, got ${result.length}, retrying...`);
        continue;
      }
      return result;
    } catch (err) {
      logger.error(`[LLMScoring] Attempt ${attempts}/${maxAttempts} failed: ${err.message}`);
      if (attempts >= maxAttempts) throw err;
    }
  }
}

function articlesAreFromToday(articles) {
  if (!articles || articles.length === 0) return false;
  const today = new Date().toISOString().slice(0, 10);
  return articles.some((a) => {
    const crawledDate = a.crawledAt ? a.crawledAt.slice(0, 10) : '';
    return crawledDate === today;
  });
}

function loadCachedArticles(sourceId) {
  const path = require('path');
  const fs = require('fs');
  const cachePath = path.join(__dirname, '../../cache', `${sourceId}.json`);
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    }
  } catch (err) {
    logger.warn(`[LLMScoring] Failed to load cache for ${sourceId}: ${err.message}`);
  }
  return null;
}

function getScoredRankingsPath() {
  const path = require('path');
  return path.join(__dirname, '../../cache', 'scored-rankings.json');
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Record format: { scoredAt, crawlDate, sourceType, items: [...] }
// Append log structure: { "36kr": [record, ...], "leiphone": [record, ...] }

function loadRawAppendLog() {
  const fs = require('fs');
  const p = getScoredRankingsPath();
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch (err) {
    logger.warn(`[LLMScoring] Failed to load append log: ${err.message}`);
  }
  return {};
}

function saveRawAppendLog(log) {
  const path = require('path');
  const fs = require('fs');
  const p = getScoredRankingsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify(log, null, 2), 'utf-8');
}

// Public: returns { sourceId: items[] } from the latest record per source
function loadScoredRankings() {
  const log = loadRawAppendLog();
  const result = {};
  for (const [sourceId, records] of Object.entries(log)) {
    if (records.length > 0) {
      result[sourceId] = records[records.length - 1].items;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

// Append a new record for each source, FIFO at MAX_RECORDS_PER_SOURCE
function appendScoredRankings(newEntries) {
  // newEntries: { sourceId: items[] }
  const log = loadRawAppendLog();
  const today = getTodayStr();

  for (const [sourceId, items] of Object.entries(newEntries)) {
    if (!log[sourceId]) {
      log[sourceId] = [];
    }

    // Check if today's record already exists (dedup)
    const alreadyExists = log[sourceId].some((r) => r.crawlDate === today);
    if (alreadyExists) {
      logger.info(`[LLMScoring] ${sourceId}: today's record already exists, skipping append`);
      continue;
    }

    log[sourceId].push({
      scoredAt: new Date().toISOString(),
      crawlDate: today,
      sourceType: 'real',
      items,
    });

    // FIFO: keep at most MAX_RECORDS_PER_SOURCE
    if (log[sourceId].length > MAX_RECORDS_PER_SOURCE) {
      const removed = log[sourceId].length - MAX_RECORDS_PER_SOURCE;
      log[sourceId].splice(0, removed);
      logger.info(`[LLMScoring] ${sourceId}: trimmed ${removed} old records`);
    }

    logger.info(`[LLMScoring] ${sourceId}: appended ${items.length} items (total records: ${log[sourceId].length})`);
  }

  saveRawAppendLog(log);
}

async function scoreAllSources() {
  const { SOURCES } = require('../config/sources');
  logger.info('[LLMScoring] === Starting LLM scoring ===');

  const newEntries = {};

  for (const source of SOURCES) {
    const articles = loadCachedArticles(source.id);

    if (!articlesAreFromToday(articles)) {
      logger.info(`[LLMScoring] ${source.id}: articles not from today, skipping`);
      continue;
    }

    try {
      const commercial = filterCommercialArticles(articles);
      const issues = clusterArticles(commercial);

      if (issues.length === 0) {
        logger.warn(`[LLMScoring] ${source.id}: no issues to score, skipping`);
        continue;
      }

      const scored = await scoreIssuesWithLLM(source.id, issues);
      const top10 = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, RANKING_TOP_N)
        .map((item, index) => {
          const issue = issues.find((i) => i.title === item.original_title);
          return {
            rank: index + 1,
            title: item.original_title,
            score: item.score,
            dimensions: item.dimensions,
            reason: item.reason,
            url: issue && issue.urls.length > 0 ? issue.urls[0] : '',
          };
        });

      newEntries[source.id] = top10;
      logger.info(`[LLMScoring] ${source.id}: LLM scored ${top10.length} items`);
    } catch (err) {
      logger.error(`[LLMScoring] ${source.id}: scoring failed: ${err.message}`);
    }
  }

  if (Object.keys(newEntries).length > 0) {
    appendScoredRankings(newEntries);
  } else {
    logger.info('[LLMScoring] No sources to score');
  }

  logger.info('[LLMScoring] === LLM scoring finished ===');
  return loadScoredRankings();
}

module.exports = { scoreAllSources, loadScoredRankings };
