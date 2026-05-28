const app = require('./app');
const { logger } = require('./utils/logger');
const { startScheduler, executeCrawl } = require('./services/scheduler');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`AICompass server running on http://localhost:${PORT}`);
  logger.info(`API base: http://localhost:${PORT}/api/v1`);

  startScheduler();
  logger.info('[Scheduler] Started. Crawl will run daily at 05:00');
});
