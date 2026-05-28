const axios = require('axios');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const { logger } = require('../../utils/logger');

const RSS_URL = 'https://www.leiphone.com/feed';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function crawlLeiphone() {
  logger.info('[LeiphoneCrawler] Fetching RSS feed');

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

  logger.info(`[LeiphoneCrawler] RSS feed returned ${items.length} articles`);

  const articles = items.map((item, index) => {
    const url = item.link || '';
    const urlId = url.match(/\/([^/]+)\.html$/)?.[1] || `leiphone-${index}`;

    const rawContent = item.description?.['#text'] || item.description || '';
    const textContent = stripHtml(rawContent);

    const pubDate = item.pubDate || '';
    const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '';

    return {
      id: `leiphone-${urlId}`,
      title: (item.title || '').trim(),
      content: textContent.substring(0, 2000),
      url,
      date,
      source: 'leiphone',
      crawledAt: new Date().toISOString(),
    };
  });

  return articles;
}

module.exports = { crawlLeiphone };
