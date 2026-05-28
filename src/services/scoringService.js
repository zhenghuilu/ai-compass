const { logger } = require('../utils/logger');

async function scoreIssues(issues) {
  logger.info(`[MockScoring] Scoring ${issues.length} issues`);

  return issues.map((issue, index) => {
    const mockScore = Math.max(1, Math.min(100, 95 - index * 8 + Math.floor(Math.random() * 5)));

    const reasons = [
      '多维度商业影响力突出，多篇文章集中报道，时效性极佳',
      '商业化信号明确，行业关注度高，具备较强的示范效应',
      '商业模式创新显著，多家媒体跟进报道，市场反响积极',
      '融资事件反映资本市场对AI赛道的持续看好，数据表现扎实',
      '成本结构优化推动商业化进程，行业普适性较强',
      '产品商业化落地初见成效，用户增长数据亮眼',
      '行业趋势明确，但具体商业影响需进一步观察',
      '合规政策变化对行业有中长期影响，短期影响有限',
      '技术进展显著，但商业化路径尚未完全清晰',
      '常规商业化动态，关注度中等，可持续跟踪',
    ];

    const dims = {
      business_impact: Math.round(mockScore * 0.4),
      discussion_density: Math.round(mockScore * 0.3),
      timeliness: Math.round(mockScore * 0.2),
      authority: Math.round(mockScore * 0.1),
    };

    return {
      original_title: issue.title,
      score: mockScore,
      dimensions: dims,
      reason: reasons[index % reasons.length],
    };
  });
}

module.exports = { scoreIssues };
