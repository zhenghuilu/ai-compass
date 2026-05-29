const { generateRankings, generateRankingsForSource } = require('../services/rankingService');
const { SOURCES } = require('../config/sources');
const { getCrawlStatus, executeCrawl } = require('../services/scheduler');
const { scoreAllSources } = require('../services/llmScoringService');

const FIELD_DEFINITIONS = [
  {
    field: '排名',
    definition: '该热点在该网站近期商业化内容中的重要性顺序',
    method: '按LLM评分从高到低排列',
  },
  {
    field: '标题',
    definition: '该热点资讯的核心内容摘要，可点击跳转',
    method: '从聚类后的议题中提取代表文章标题',
  },
  {
    field: '热度',
    definition: '该热点在该网站商业化内容中的综合关注度（百分制）',
    method: 'LLM基于商业影响力、讨论密度、时效性、信源权威性四个维度综合评分',
  },
  {
    field: '评分理由',
    definition: 'LLM给出该热度的判断依据',
    method: 'LLM生成的定性说明',
  },
  {
    field: 'URL',
    definition: '该热点对应的原始文章链接',
    method: '从该议题中选取位置分最高的文章URL',
  },
];

async function getAllRankings(req, res, next) {
  try {
    const rankings = await generateRankings();
    res.json({ success: true, data: rankings });
  } catch (err) {
    next(err);
  }
}

async function getRankingsBySource(req, res, next) {
  try {
    const { source } = req.params;
    const validSources = SOURCES.map((s) => s.id);

    if (!validSources.includes(source)) {
      return res.status(400).json({
        success: false,
        error: `无效的数据源: ${source}。可选值: ${validSources.join(', ')}`,
      });
    }

    const rankings = await generateRankingsForSource(source);
    res.json({ success: true, data: { [source]: rankings } });
  } catch (err) {
    next(err);
  }
}

function getSources(req, res) {
  res.json({ success: true, data: SOURCES });
}

function getFieldDefinitions(req, res) {
  res.json({ success: true, data: FIELD_DEFINITIONS });
}

function getCrawlStatusHandler(req, res) {
  res.json({ success: true, data: getCrawlStatus() });
}

async function triggerCrawl(req, res, next) {
  try {
    const result = await executeCrawl();
    res.json({ success: true, message: '爬取完成', data: result });
  } catch (err) {
    next(err);
  }
}

async function triggerScore(req, res, next) {
  try {
    const result = await scoreAllSources();
    res.json({ success: true, message: '评分完成', data: result });
  } catch (err) {
    next(err);
  }
}

function getLatestUpdateTime(req, res) {
  const path = require('path');
  const fs = require('fs');
  const cacheDir = path.join(__dirname, '../../cache');

  const result = { sources: {} };
  let latest = null;

  const crawlPath = path.join(cacheDir, 'last-crawl.json');
  if (fs.existsSync(crawlPath)) {
    try {
      const crawlData = JSON.parse(fs.readFileSync(crawlPath, 'utf-8'));
      for (const [id, info] of Object.entries(crawlData.sources || {})) {
        result.sources[id] = { lastCrawlTime: info.lastCrawlTime || null, lastScoreTime: null, status: info.status };
        if (info.lastCrawlTime && (!latest || info.lastCrawlTime > latest)) {
          latest = info.lastCrawlTime;
        }
      }
    } catch (_) {}
  }

  const scorePath = path.join(cacheDir, 'scored-rankings.json');
  if (fs.existsSync(scorePath)) {
    try {
      const scoreData = JSON.parse(fs.readFileSync(scorePath, 'utf-8'));
      for (const [id, records] of Object.entries(scoreData)) {
        const lastRecord = records?.[records.length - 1];
        if (lastRecord?.scoredAt) {
          if (!result.sources[id]) result.sources[id] = { lastCrawlTime: null, lastScoreTime: null, status: null };
          result.sources[id].lastScoreTime = lastRecord.scoredAt;
          if (lastRecord.scoredAt > latest) latest = lastRecord.scoredAt;
        }
      }
    } catch (_) {}
  }

  result.latestUpdateTime = latest;
  res.json({ success: true, data: result });
}

module.exports = {
  getAllRankings, getRankingsBySource,
  getSources, getFieldDefinitions,
  getCrawlStatus: getCrawlStatusHandler,
  triggerCrawl,
  triggerScore,
  getLatestUpdateTime,
};
