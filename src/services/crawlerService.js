const path = require('path');
const fs = require('fs');
const { SOURCES } = require('../config/sources');
const { mockArticles } = require('../data/mock');
const { logger } = require('../utils/logger');
const { crawl36kr } = require('./crawlers/36krCrawler');
const { crawlQbitai } = require('./crawlers/qbitaiCrawler');
const { crawlLeiphone } = require('./crawlers/leiphoneCrawler');
const { crawlTmtpost } = require('./crawlers/tmtpostCrawler');

const CACHE_DIR = path.join(__dirname, '../../cache');

const REAL_CRAWLERS = {
  '36kr': crawl36kr,
  'qbitai': crawlQbitai,
  'leiphone': crawlLeiphone,
  'tmtpost': crawlTmtpost,
};

function getCachePath(sourceId) {
  return path.join(CACHE_DIR, `${sourceId}.json`);
}

function loadCachedArticles(sourceId) {
  const cachePath = getCachePath(sourceId);
  if (!fs.existsSync(cachePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`[Cache] Failed to read cache for ${sourceId}: ${err.message}`);
    return null;
  }
}

function saveCachedArticles(sourceId, articles) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const data = JSON.stringify(articles, null, 2);
    fs.writeFileSync(getCachePath(sourceId), data, 'utf-8');
    logger.info(`[Cache] Saved ${articles.length} articles for ${sourceId}`);
  } catch (err) {
    logger.warn(`[Cache] Failed to save cache for ${sourceId}: ${err.message}`);
  }
}

async function crawlSource(sourceId) {
  const realCrawler = REAL_CRAWLERS[sourceId];

  if (realCrawler) {
    logger.info(`[CrawlerService] Using real crawler for: ${sourceId}`);
    try {
      const articles = await realCrawler();
      if (articles.length > 0) {
        saveCachedArticles(sourceId, articles);
        return { articles, sourceType: 'real' };
      }
      logger.warn(`[CrawlerService] Real crawler returned 0 articles for ${sourceId}`);
    } catch (err) {
      logger.error(`[CrawlerService] Real crawler failed for ${sourceId}:`, err.message);
    }

    const cached = loadCachedArticles(sourceId);
    if (cached) {
      logger.info(`[CrawlerService] Using cached data for: ${sourceId} (${cached.length} articles)`);
      return {
        articles: cached.map((a) => ({ ...a, crawledAt: new Date().toISOString() })),
        sourceType: 'cache',
      };
    }

    logger.info(`[CrawlerService] No cache for ${sourceId}, falling back to mock`);
    return { articles: getMockArticles(sourceId), sourceType: 'mock' };
  }

  return { articles: getMockArticles(sourceId), sourceType: 'mock' };
}

function getMockArticles(sourceId) {
  logger.info(`[MockCrawler] Using mock data for: ${sourceId}`);
  const articles = mockArticles[sourceId];
  if (!articles) {
    logger.warn(`[MockCrawler] No mock data for source: ${sourceId}`);
    return [];
  }
  return articles.map((a) => ({
    ...a,
    crawledAt: new Date().toISOString(),
  }));
}

async function crawlAllSources() {
  const results = {};
  for (const source of SOURCES) {
    results[source.id] = await crawlSource(source.id);
  }
  return results;
}

module.exports = { crawlSource, crawlAllSources, loadCachedArticles, saveCachedArticles };
