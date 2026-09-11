const express = require('express');
const router = express.Router();
const {
  createRecruiter,
  getRecruiters,
  getRecruiterById,
  toggleRecruiterStatus,
  getVoters,
  getVoterById,
  getAnalytics,
  getWardAnalytics,
  getRecruiterAnalytics,
  exportVoters,
  getAuditLogs,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All routes are protected and admin only
router.use(protect);
router.use(authorize('admin'));

router.post('/recruiters', createRecruiter);
router.get('/recruiters', getRecruiters);
router.get('/recruiters/:id', getRecruiterById);
router.patch('/recruiters/:id/status', toggleRecruiterStatus);

router.get('/voters', getVoters);
router.get('/voters/:id', getVoterById);
router.post('/voters/export', exportVoters);

router.get('/analytics', getAnalytics);
router.get('/analytics/wards', getWardAnalytics);
router.get('/analytics/recruiters', getRecruiterAnalytics);

router.get('/audit-logs', getAuditLogs);

module.exports = router;
