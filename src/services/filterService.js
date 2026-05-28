const { COMMERCIAL_KEYWORDS } = require('../config');

function isCommercialArticle(article) {
  const text = `${article.title} ${article.content}`.toLowerCase();
  return COMMERCIAL_KEYWORDS.some((kw) => text.includes(kw));
}

function filterCommercialArticles(articles) {
  return articles.filter(isCommercialArticle);
}

module.exports = { isCommercialArticle, filterCommercialArticles };
