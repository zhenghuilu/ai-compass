const axios = require('axios');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const { logger } = require('../../utils/logger');

const RSS_URL = 'https://www.qbitai.com/feed';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function crawlQbitai() {
  logger.info('[QbitaiCrawler] Fetching RSS feed');

  const response = await axios.get(RSS_URL, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 15000,
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'item',
  });

  const parsed = parser.parse(response.data);
  const items = parsed?.rss?.channel?.item || [];

  logger.info(`[QbitaiCrawler] RSS feed returned ${items.length} articles`);

  const articles = await Promise.all(
    items.map(async (item, index) => {
      const url = item.link || '';
      const articleId = url.match(/\/\d+\/(\d+)\.html/)?.[1] || `qbitai-rss-${index}`;
      const title = (item.title || '').trim();
      const description = item.description?.['#text'] || item.description || '';

      const pubDate = item.pubDate || '';
      const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '';

      // Try to fetch full content from article page
      let content = '';
      try {
        content = await fetchArticleContent(url);
      } catch (err) {
        logger.warn(`[QbitaiCrawler] Failed to fetch article content: ${url}`);
      }

      return {
        id: `qbitai-${articleId}`,
        title,
        content: content.substring(0, 2000),
        url,
        date,
        source: 'qbitai',
        crawledAt: new Date().toISOString(),
      };
    })
  );

  return articles;
}

async function fetchArticleContent(articleUrl) {
  const response = await axios.get(articleUrl, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);
  const contentPieces = [];

  $('.article > p, .article > blockquote, .article > div:not(.article_info):not(.zhaiyao)').each((_, el) => {
    const text = $(el).text().trim();
    if (text) contentPieces.push(text);
  });

  if (contentPieces.length === 0) {
    return '';
  }

  return contentPieces.join('\n');
}

module.exports = { crawlQbitai };
