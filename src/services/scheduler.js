const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { crawlAllSources, saveCachedArticles } = require('./crawlerService');
const { SOURCES } = require('../config/sources');
const { logger } = require('../utils/logger');
const { scoreAllSources } = require('./llmScoringService');

const CACHE_DIR = path.join(__dirname, '../../cache');
const STATUS_PATH = path.join(CACHE_DIR, 'last-crawl.json');

let crawlStatus = {
  lastCrawlTime: null,
  sources: {},
};

function loadCrawlStatus() {
  try {
    if (fs.existsSync(STATUS_PATH)) {
      const raw = fs.readFileSync(STATUS_PATH, 'utf-8');
      crawlStatus = JSON.parse(raw);
      logger.info(`[Scheduler] Loaded last crawl status`);
    }
  } catch (err) {
    logger.warn(`[Scheduler] Failed to load crawl status: ${err.message}`);
  }
}

function saveCrawlStatus() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(STATUS_PATH, JSON.stringify(crawlStatus, null, 2), 'utf-8');
  } catch (err) {
    logger.warn(`[Scheduler] Failed to save crawl status: ${err.message}`);
  }
}

async function executeCrawl() {
  logger.info('[Scheduler] === Starting scheduled crawl ===');
  const startTime = new Date().toISOString();

  const results = await crawlAllSources();

  for (const source of SOURCES) {
    const result = results[source.id] || { articles: [], sourceType: 'mock' };
    const { articles, sourceType } = result;

    // Only save to cache if data came from real crawler
    if (sourceType === 'real') {
      saveCachedArticles(source.id, articles);
    }

    const now = new Date().toISOString();
    crawlStatus.sources[source.id] = {
      status: sourceType === 'real' ? 'success' : 'fail',
      articleCount: articles.length,
      sourceType,
      lastCrawlTime: now,
    };
  }

  crawlStatus.lastCrawlTime = startTime;
  saveCrawlStatus();

  const elapsed = ((Date.now() - new Date(startTime).getTime()) / 1000).toFixed(1);
  logger.info(`[Scheduler] === Crawl finished in ${elapsed}s ===`);
}

function startScheduler() {
  loadCrawlStatus();

  cron.schedule('0 5 * * *', () => {
    executeCrawl();
  });

  cron.schedule('10 6 * * *', () => {
    scoreAllSources().catch((err) => {
      logger.error('[Scheduler] LLM scoring failed:', err.message);
    });
  });

  logger.info('[Scheduler] Cron jobs registered: crawl at 05:00, LLM scoring at 06:10');
}

function getCrawlStatus() {
  return { ...crawlStatus };
}

module.exports = { startScheduler, executeCrawl, getCrawlStatus };
