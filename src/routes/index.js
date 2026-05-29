const { Router } = require('express');
const {
  getAllRankings,
  getRankingsBySource,
  getSources,
  getFieldDefinitions,
  getCrawlStatus,
  triggerCrawl,
  triggerScore,
  getLatestUpdateTime,
} = require('../controllers/rankingController');

const router = Router();

router.get('/rankings', getAllRankings);
router.get('/rankings/:source', getRankingsBySource);
router.get('/sources', getSources);
router.get('/fields', getFieldDefinitions);
router.get('/crawl/status', getCrawlStatus);
router.get('/crawl/trigger', triggerCrawl);
router.get('/score/trigger', triggerScore);
router.get('/updatetime', getLatestUpdateTime);

module.exports = router;
