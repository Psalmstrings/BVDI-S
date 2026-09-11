const express = require('express');
const router = express.Router();
const {
  getProfile,
  registerVoter,
  getMyVoters,
  getVoterById,
} = require('../controllers/recruiterController');
const { protect, authorize } = require('../middleware/auth');

// All routes protected and recruiter only
router.use(protect);
router.use(authorize('recruiter'));

router.get('/profile', getProfile);
router.post('/voters', registerVoter);
router.get('/voters', getMyVoters);
router.get('/voters/:id', getVoterById);

module.exports = router;
