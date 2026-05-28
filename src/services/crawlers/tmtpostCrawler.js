const axios = require('axios');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const { logger } = require('../../utils/logger');

const RSS_URL = 'https://www.tmtpost.com/rss.xml';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function crawlTmtpost() {
  logger.info('[TmtpostCrawler] Fetching RSS feed');

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

  logger.info(`[TmtpostCrawler] RSS feed returned ${items.length} articles`);

  const articles = items.map((item, index) => {
    const url = item.link || '';
    const articleId = url.match(/(\d+)\.html$/)?.[1] || `tmtpost-${index}`;

    const description = item.description?.['#text'] || item.description || '';

    const pubDate = item.pubDate || '';
    const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '';

    return {
      id: `tmtpost-${articleId}`,
      title: (item.title || '').trim(),
      content: description,
      url,
      date,
      source: 'tmtpost',
      crawledAt: new Date().toISOString(),
    };
  });

  return articles;
}

module.exports = { crawlTmtpost };
