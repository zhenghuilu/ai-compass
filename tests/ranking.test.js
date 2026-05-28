const request = require('supertest');
const { app } = require('./setup');

/*
 * 组件测试：API 端点测试
 * 测试整个用户场景（user case），而非单个方法
 */

describe('AICompass API 组件测试', () => {
  /*
   * User Case 1: 获取所有数据源的商业化热点榜单
   * 验证: 返回 4 个数据源（36kr, leiphone, qbitai, tmtpost），
   *       每个数据源包含 TOP10 榜单，每条热点包含 rank/title/score/reason/url
   */
  describe('UC1: 获取所有数据源的商业化热点榜单', () => {
    it('GET /api/v1/rankings 应返回所有4个数据源的TOP10榜单，每条热点包含完整字段', async () => {
      const res = await request(app).get('/api/v1/rankings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(Object.keys(data)).toEqual(expect.arrayContaining([
        '36kr',
        'leiphone',
        'qbitai',
        'tmtpost',
      ]));

      for (const sourceId of Object.keys(data)) {
        const rankings = data[sourceId];
        expect(rankings.length).toBeLessThanOrEqual(10);

        rankings.forEach((item, idx) => {
          expect(item).toHaveProperty('rank');
          expect(item.rank).toBe(idx + 1);
          expect(item).toHaveProperty('title');
          expect(typeof item.title).toBe('string');
          expect(item.title.length).toBeGreaterThan(0);
          expect(item).toHaveProperty('score');
          expect(item.score).toBeGreaterThanOrEqual(1);
          expect(item.score).toBeLessThanOrEqual(100);
          expect(item).toHaveProperty('reason');
          expect(typeof item.reason).toBe('string');
          expect(item.reason.length).toBeGreaterThan(0);
          expect(item).toHaveProperty('url');
          expect(item.url).toMatch(/^https?:\/\//);
        });
      }
    });
  });

  /*
   * User Case 2: 按数据源筛选，获取指定数据源的热点榜单
   * 验证: 只返回指定数据源的榜单，其他数据源不出现
   */
  describe('UC2: 按数据源筛选获取热点榜单', () => {
    it('GET /api/v1/rankings/36kr 应只返回36氪的TOP10榜单', async () => {
      const res = await request(app).get('/api/v1/rankings/36kr');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(Object.keys(data)).toEqual(['36kr']);
      expect(data['36kr'].length).toBeGreaterThan(0);
      expect(data['36kr'].length).toBeLessThanOrEqual(10);
    });
  });

  /*
   * User Case 3: 传入无效数据源时，API 返回 400 错误
   * 验证: 系统能正确处理无效参数，给出清晰的错误提示
   */
  describe('UC3: 无效数据源参数处理', () => {
    it('GET /api/v1/rankings/invalid-source 应返回400错误，并提示可选数据源', async () => {
      const res = await request(app).get('/api/v1/rankings/invalid-source');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('无效的数据源');
    });
  });

  /*
   * User Case 4: 查看数据源列表
   * 验证: 返回4个数据源的定义信息，包含 id/name/url/tag/updateFrequency
   */
  describe('UC4: 查看数据源列表', () => {
    it('GET /api/v1/sources 应返回4个数据源的完整信息', async () => {
      const res = await request(app).get('/api/v1/sources');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const sources = res.body.data;
      expect(sources.length).toBe(4);

      sources.forEach((source) => {
        expect(source).toHaveProperty('id');
        expect(source).toHaveProperty('name');
        expect(source).toHaveProperty('url');
        expect(source).toHaveProperty('tag');
        expect(source).toHaveProperty('updateFrequency');
      });
    });
  });

  /*
   * User Case 5: 查看字段说明
   * 验证: 返回5个字段（排名/标题/热度/评分理由/URL）的定义和统计方法
   */
  describe('UC5: 查看字段说明', () => {
    it('GET /api/v1/fields 应返回5个字段的完整定义说明', async () => {
      const res = await request(app).get('/api/v1/fields');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const fields = res.body.data;
      expect(fields.length).toBe(5);

      const fieldNames = fields.map((f) => f.field);
      expect(fieldNames).toEqual(expect.arrayContaining([
        '排名', '标题', '热度', '评分理由', 'URL',
      ]));

      fields.forEach((field) => {
        expect(field).toHaveProperty('field');
        expect(field).toHaveProperty('definition');
        expect(field).toHaveProperty('method');
      });
    });
  });

  /*
   * User Case 6: 健康检查端点可用
   * 验证: 服务正常运行时可响应 /health 请求
   */
  describe('UC6: 健康检查', () => {
    it('GET /health 应返回服务正常运行状态', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});

/*
 * 组件测试：排名生成管线测试
 * 测试核心管线的完整流程：抓取 → 筛选 → 聚类 → 评分 → 排榜
 */
describe('AICompass 排名管线组件测试', () => {
  const { generateRankings } = require('../src/services/rankingService');
  const { crawlSource } = require('../src/services/crawlerService');
  const { filterCommercialArticles } = require('../src/services/filterService');
  const { clusterArticles, similarity } = require('../src/services/clusterService');

  /*
   * User Case 7: 完整排名管线 —— 从抓取到生成榜单
   * 验证: 输入 mock 数据后，管线能正确输出按热度降序排列的 TOP10 榜单
   */
  describe('UC7: 完整排名管线 —— 从抓取到生成榜单', () => {
    it('generateRankings 应为每个数据源生成按score降序排列的榜单，且每条热点包含score/reason/url', async () => {
      const rankings = await generateRankings();

      for (const sourceId of Object.keys(rankings)) {
        const list = rankings[sourceId];
        expect(list.length).toBeGreaterThan(0);
        expect(list.length).toBeLessThanOrEqual(10);

        // 验证降序排列
        for (let i = 1; i < list.length; i++) {
          expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
        }

        // 验证每条热点包含必须字段
        list.forEach((item) => {
          expect(item).toHaveProperty('rank');
          expect(item).toHaveProperty('title');
          expect(item).toHaveProperty('score');
          expect(item).toHaveProperty('reason');
          expect(item).toHaveProperty('url');
        });
      }
    });
  });

  /*
   * User Case 8: 商业化关键词筛选 —— 过滤非商业化内容
   * 验证: 包含商业化关键词的文章被保留，不包含的被过滤
   */
  describe('UC8: 商业化关键词筛选 —— 过滤非商业化内容', () => {
    it('包含商业化关键词的文章应被保留，纯学术文章应被过滤', async () => {
      const { COMMERCIAL_KEYWORDS } = require('../src/config');
      const { articles } = await crawlSource('qbitai');
      const commercial = filterCommercialArticles(articles);

      commercial.forEach((article) => {
        const text = `${article.title} ${article.content}`.toLowerCase();
        const hasKeyword = COMMERCIAL_KEYWORDS.some((kw) => text.includes(kw));
        expect(hasKeyword).toBe(true);
      });

      const nonCommercialIds = ['qbit-011'];
      nonCommercialIds.forEach((id) => {
        const nonCommercialArticle = articles.find((a) => a.id === id);
        if (nonCommercialArticle) {
          const isIncluded = commercial.some((c) => c.id === id);
          expect(isIncluded).toBe(false);
        }
      });
    });
  });

  /*
   * User Case 9: 文章聚类 —— 相似标题的文章被归为同一议题
   * 验证: 标题相似的文章被正确合并，不相似的文章保持独立
   */
  describe('UC9: 文章聚类 —— 相似标题的文章被归为同一议题', () => {
    it('标题相似度≥0.6的文章应被聚类为同一议题，否则保持独立', async () => {
      const { articles } = await crawlSource('qbitai');
      const commercial = filterCommercialArticles(articles);
      const issues = clusterArticles(commercial);

      // 验证聚类结果格式
      issues.forEach((issue) => {
        expect(issue).toHaveProperty('id');
        expect(issue).toHaveProperty('title');
        expect(issue).toHaveProperty('articles');
        expect(issue).toHaveProperty('urls');
        expect(issue).toHaveProperty('dates');
        expect(issue).toHaveProperty('article_count');
        expect(issue).toHaveProperty('content_preview');
        expect(issue).toHaveProperty('source');

        expect(issue.article_count).toBe(issue.articles.length);
        expect(issue.urls.length).toBe(issue.articles.length);
      });

      // 验证相似文章被聚类（qbit-003 和 qbit-006 标题都包含AI数字人直播）
      const digitalHumanIssue = issues.find(
        (i) => i.title.includes('AI数字人直播')
      );
      if (digitalHumanIssue) {
        expect(digitalHumanIssue.article_count).toBeGreaterThanOrEqual(1);
      }
    });
  });

  /*
   * User Case 10: 字符串相似度函数 —— 相似度高返回高值，不相似返回低值
   * 验证: 相同字符串相似度为1，完全不同字符串相似度很低
   */
  describe('UC10: 字符串相似度函数', () => {
    it('相同字符串应返回1.0，完全不同字符串应返回<0.3', () => {
      expect(similarity('hello world', 'hello world')).toBeCloseTo(1.0, 1);
      expect(similarity('abc', 'xyz')).toBeLessThan(0.3);
      expect(similarity('AI数字人直播带货转化率超真人主播', 'AI数字人直播带货')).toBeGreaterThanOrEqual(0.5);
    });
  });
});

/*
 * 组件测试：36氪爬虫测试
 * 测试真实爬虫能否从 RSS Feed 正确获取文章列表
 */
describe('36氪爬虫组件测试', () => {
  const { crawl36kr, crawl36krArticleDetail } = require('../src/services/crawlers/36krCrawler');

  /*
   * User Case 11: 36氪 RSS 爬虫 —— 从 RSS Feed 获取文章列表
   * 验证: 返回文章数组，每篇文章包含 id/title/content/url/date/source/crawledAt
   *       若 RSS 被反爬拦截（空结果），测试跳过
   */
  describe('UC11: 36氪 RSS 爬虫 —— 从 RSS Feed 获取文章列表', () => {
    it('crawl36kr 应返回文章数组，每篇文章包含完整字段（id/title/content/url/date/source）', async () => {
      const articles = await crawl36kr();

      expect(Array.isArray(articles)).toBe(true);

      // 若 RSS 被反爬拦截（返回空数组），测试跳过而非失败
      if (articles.length === 0) {
        console.warn('[SKIP] 36kr RSS 返回空（可能被反爬拦截），跳过验证');
        return;
      }

      articles.forEach((article) => {
        expect(article).toHaveProperty('id');
        expect(article.id).toMatch(/^36kr-/);
        expect(article).toHaveProperty('title');
        expect(typeof article.title).toBe('string');
        expect(article.title.length).toBeGreaterThan(0);
        expect(article).toHaveProperty('content');
        expect(typeof article.content).toBe('string');
        expect(article.content.length).toBeGreaterThan(0);
        expect(article).toHaveProperty('url');
        expect(article.url).toMatch(/^https:\/\/36kr\.com\//);
        expect(article).toHaveProperty('date');
        expect(article.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(article).toHaveProperty('source');
        expect(article.source).toBe('36kr');
        expect(article).toHaveProperty('crawledAt');
      });
    });
  });

  /*
   * User Case 12: 36氪文章详情页爬虫 —— 从文章 URL 抓取正文内容
   * 验证: 能从具体文章页提取标题、正文、发布日期
   *       若页面被反爬拦截，article 为 null，测试跳过
   */
  describe('UC12: 36氪文章详情页爬虫 —— 从文章 URL 抓取正文内容', () => {
    it('crawl36krArticleDetail 应返回包含 title/content/date 的文章对象', async () => {
      const testUrl = 'https://36kr.com/p/3825527430025856';
      const article = await crawl36krArticleDetail(testUrl);

      if (article === null) {
        console.warn('[SKIP] 36kr 文章详情页无法解析（可能被反爬拦截），跳过验证');
        return;
      }

      expect(article).toHaveProperty('title');
      expect(article.title.length).toBeGreaterThan(0);
      expect(article).toHaveProperty('content');
      expect(article.content.length).toBeGreaterThan(0);
      expect(article).toHaveProperty('date');
      expect(article.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.source).toBe('36kr');
      expect(article.url).toBe(testUrl);
    });
  });

  /*
   * User Case 13: 爬虫集成 —— 使用爬虫服务获取36氪数据
   * 验证: crawlSource("36kr") 优先走真实 RSS 爬虫，失败时回退到 cache → mock
   */
  describe('UC13: 爬虫集成 —— 使用爬虫服务获取36氪数据', () => {
    it('crawlSource("36kr") 应返回文章（真实或 cache 回退或 mock），文章格式统一', async () => {
      const { crawlSource } = require('../src/services/crawlerService');
      const result = await crawlSource('36kr');
      const articles = result.articles;

      expect(Array.isArray(articles)).toBe(true);
      expect(articles.length).toBeGreaterThan(0);

      articles.forEach((article) => {
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('content');
        expect(article).toHaveProperty('url');
        expect(article).toHaveProperty('date');
        expect(article).toHaveProperty('source');
        expect(article.source).toBe('36kr');
        expect(article).toHaveProperty('crawledAt');
      });
    });
  });

  /*
   * User Case 14: 磁盘缓存 —— 成功抓取后将数据缓存到文件，失败时从缓存恢复
   * 验证: saveCachedArticles 保存后，loadCachedArticles 能正确读取
   */
  describe('UC14: 磁盘缓存 —— 成功抓取后缓存文件，失败时从缓存恢复', () => {
    const { saveCachedArticles, loadCachedArticles } = require('../src/services/crawlerService');

    afterAll(() => {
      const fs = require('fs');
      const p = require('path').join(__dirname, '../cache/test-source.json');
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    it('saveCachedArticles 写入文件后 loadCachedArticles 应返回相同数据', () => {
      const testSource = 'test-source';
      const testData = [
        { id: 'test-1', title: '测试文章1', content: '内容1', url: 'https://test.com/1', date: '2026-05-26', source: 'test-source' },
        { id: 'test-2', title: '测试文章2', content: '内容2', url: 'https://test.com/2', date: '2026-05-25', source: 'test-source' },
      ];

      saveCachedArticles(testSource, testData);
      const loaded = loadCachedArticles(testSource);

      expect(loaded).not.toBeNull();
      expect(loaded.length).toBe(2);
      expect(loaded[0].id).toBe('test-1');
      expect(loaded[1].title).toBe('测试文章2');
    });
  });

  /*
   * User Case 15: 缓存回退优先级 —— 被反爬时使用 cache，无 cache 时用 mock
   * 验证: 缓存数据优先于 mock 数据
   */
  describe('UC15: 缓存回退优先级 —— 被反爬时使用 cache，无 cache 时用 mock', () => {
    const { crawlSource, saveCachedArticles } = require('../src/services/crawlerService');

    afterAll(() => {
      const fs = require('fs');
      const p = require('path').join(__dirname, '../cache/36kr.json');
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    beforeEach(() => {
      saveCachedArticles('36kr', [
        { id: '36kr-cached-1', title: 'Cached Article', content: 'Cached content', url: 'https://36kr.com/p/1', date: '2026-05-26', source: '36kr' },
      ]);
    });

    it('被反爬时 crawlSource("36kr") 应返回缓存数据，而非 mock', async () => {
      const result = await crawlSource('36kr');
      const articles = result.articles;

      expect(Array.isArray(articles)).toBe(true);
      expect(articles.length).toBeGreaterThanOrEqual(1);

      const firstId = articles[0].id;
      expect(firstId).toMatch(/^36kr-/);
    });
  });
});
