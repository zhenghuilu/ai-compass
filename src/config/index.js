const COMMERCIAL_KEYWORDS = [
  '融资', '估值', 'IPO', '收购', '并购',
  '订阅', 'SaaS', 'ARR', 'MRR', '变现',
  '成本', '毛利率', 'ROI', '回报率', '算力成本',
  '落地', '调用量', '商业化', '营收', '盈利',
  '智能体', 'Agent', '工作流', '自动化',
  '营销', '广告', '投放', '转化率',
  '合规', '监管', '数据安全',
];

const TITLE_SIMILARITY_THRESHOLD = 0.6;

const CLUSTER_MAX_ISSUES = 30;

const RANKING_TOP_N = 10;

module.exports = {
  COMMERCIAL_KEYWORDS,
  TITLE_SIMILARITY_THRESHOLD,
  CLUSTER_MAX_ISSUES,
  RANKING_TOP_N,
};
