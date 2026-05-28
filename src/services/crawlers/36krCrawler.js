const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const { logger } = require('../../utils/logger');

const RSS_URL = 'https://36kr.com/feed';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const CAPTCHA_INDICATORS = ['captcha', 'TTGCaptcha', 'sec_sdk', '请升级至最新版APP', '滑块验证', 'verify_center'];

const COOKIE_PATH = path.join(__dirname, '../../../cookies/36kr.txt');

function loadCookies() {
  try {
    if (fs.existsSync(COOKIE_PATH)) {
      const raw = fs.readFileSync(COOKIE_PATH, 'utf-8').trim();
      if (raw) {
        logger.info('[36krCrawler] Loaded cookies from file');
        return raw;
      }
    }
  } catch (err) {
    logger.warn(`[36krCrawler] Failed to load cookies: ${err.message}`);
  }
  return '';
}

function isCaptchaPage(html) {
  return CAPTCHA_INDICATORS.some((indicator) => html.includes(indicator));
}

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

function buildHeaders() {
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://36kr.com/',
  };
  const cookies = loadCookies();
  if (cookies) {
    headers['Cookie'] = cookies;
  }
  return headers;
}

async function crawl36kr() {
  logger.info('[36krCrawler] Fetching RSS feed');

  const response = await axios.get(RSS_URL, {
    headers: buildHeaders(),
    timeout: 15000,
  });

  const body = response.data;

  if (isCaptchaPage(body)) {
    const hasCookies = !!loadCookies();
    logger.warn(`[36krCrawler] RSS feed blocked by WAF captcha (cookies present: ${hasCookies})`);
    return [];
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'item',
  });

  const parsed = parser.parse(body);
  const items = parsed?.rss?.channel?.item || [];

  logger.info(`[36krCrawler] RSS feed returned ${items.length} articles`);

  const articles = items.map((item, index) => {
    const rawUrl = item.link?.['#text'] || item.link || '';
    const cleanUrl = rawUrl.replace(/\?f=rss$/, '');
    const articleId = cleanUrl.match(/\/p\/(\d+)/)?.[1] || cleanUrl.match(/\/newsflashes\/(\d+)/)?.[1] || `36kr-rss-${index}`;

    const rawContent = item.description?.['#text'] || item.description || '';
    const textContent = stripHtml(rawContent);

    const pubDate = item.pubDate || '';
    const date = pubDate ? new Date(pubDate).toISOString().slice(0, 10) : '';

    return {
      id: `36kr-${articleId}`,
      title: (item.title || '').trim(),
      content: textContent.substring(0, 2000),
      url: cleanUrl,
      date,
      source: '36kr',
      crawledAt: new Date().toISOString(),
    };
  });

  return articles;
}

async function crawl36krArticleDetail(articleUrl) {
  logger.info(`[36krCrawler] Fetching article detail: ${articleUrl}`);

  const response = await axios.get(articleUrl, {
    headers: buildHeaders(),
    timeout: 15000,
  });

  const body = response.data;

  if (isCaptchaPage(body)) {
    logger.warn(`[36krCrawler] Article detail blocked by WAF: ${articleUrl}`);
    return null;
  }

  const $ = cheerio.load(body);

  const title = $('h1.article-title').text().trim();
  const contentText = $('.articleDetailContent').text().trim();

  if (!title && !contentText) {
    logger.warn(`[36krCrawler] Could not parse article detail: ${articleUrl}`);
    return null;
  }

  const articleId = articleUrl.match(/\/p\/(\d+)/)?.[1] || '';
  const dateText = $('meta[property="article:published_time"]').attr('content') || '';
  const date = dateText.slice(0, 10);

  return {
    id: `36kr-${articleId}`,
    title: title || '',
    content: contentText.substring(0, 2000),
    url: articleUrl,
    date,
    source: '36kr',
    crawledAt: new Date().toISOString(),
  };
}

module.exports = { crawl36kr, crawl36krArticleDetail };
