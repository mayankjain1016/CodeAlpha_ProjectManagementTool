const express = require('express');
const { getNotifications, markAllRead, markSingleRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', getNotifications);
router.post('/read-all', markAllRead);
router.patch('/:id/read', markSingleRead);

module.exports = router;

