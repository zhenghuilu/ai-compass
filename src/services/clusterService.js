const { TITLE_SIMILARITY_THRESHOLD, CLUSTER_MAX_ISSUES } = require('../config');
const { logger } = require('../utils/logger');

function similarity(a, b) {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0.0;

  const pairs1 = new Set();
  const pairs2 = new Set();

  for (let i = 0; i < s1.length - 1; i++) {
    pairs1.add(s1.substring(i, i + 2));
  }
  for (let i = 0; i < s2.length - 1; i++) {
    pairs2.add(s2.substring(i, i + 2));
  }

  const intersection = new Set([...pairs1].filter((x) => pairs2.has(x)));
  const union = new Set([...pairs1, ...pairs2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

function clusterArticles(articles) {
  if (articles.length === 0) return [];

  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < articles.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [articles[i]];
    assigned.add(i);

    for (let j = i + 1; j < articles.length; j++) {
      if (assigned.has(j)) continue;

      const sim = similarity(articles[i].title, articles[j].title);
      if (sim >= TITLE_SIMILARITY_THRESHOLD) {
        cluster.push(articles[j]);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  const issues = clusters
    .filter((c) => c.length > 0)
    .slice(0, CLUSTER_MAX_ISSUES)
    .map((cluster, index) => ({
      id: index + 1,
      title: cluster[0].title,
      articles: cluster,
      urls: cluster.map((a) => a.url),
      dates: cluster.map((a) => a.date),
      article_count: cluster.length,
      content_preview: cluster[0].content.substring(0, 500),
      source: cluster[0].source,
    }));

  logger.info(`[Cluster] ${articles.length} articles → ${issues.length} issues`);
  return issues;
}

module.exports = { similarity, clusterArticles };
