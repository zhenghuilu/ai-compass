const { RANKING_TOP_N } = require('../config');
const { crawlAllSources } = require('./crawlerService');
const { filterCommercialArticles } = require('./filterService');
const { clusterArticles } = require('./clusterService');
const { scoreIssues } = require('./scoringService');
const { loadScoredRankings } = require('./llmScoringService');

async function generateRankings() {
  const scored = loadScoredRankings();
  if (scored) {
    return scored;
  }

  const crawled = await crawlAllSources();
  const rankings = {};

  for (const [sourceId, result] of Object.entries(crawled)) {
    const articles = result.articles;
    const commercial = filterCommercialArticles(articles);
    const issues = clusterArticles(commercial);
    const scored = await scoreIssues(issues);

    const top10 = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, RANKING_TOP_N)
      .map((item, index) => {
        const issue = issues.find((i) => i.title === item.original_title);
        return {
          rank: index + 1,
          title: item.original_title,
          score: item.score,
          dimensions: item.dimensions || null,
          reason: item.reason,
          url: issue && issue.urls.length > 0 ? issue.urls[0] : '',
        };
      });

    rankings[sourceId] = top10;
  }

  return rankings;
}

async function generateRankingsForSource(sourceId) {
  const allRankings = await generateRankings();
  return allRankings[sourceId] || [];
}

module.exports = { generateRankings, generateRankingsForSource };
