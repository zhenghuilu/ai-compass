const { Router } = require('express');
const {
  getAllRankings,
  getRankingsBySource,
  getSources,
  getFieldDefinitions,
  getCrawlStatus,
  triggerCrawl,
} = require('../controllers/rankingController');

const router = Router();

router.get('/rankings', getAllRankings);
router.get('/rankings/:source', getRankingsBySource);
router.get('/sources', getSources);
router.get('/fields', getFieldDefinitions);
router.get('/crawl/status', getCrawlStatus);
router.post('/crawl/trigger', triggerCrawl);

module.exports = router;
