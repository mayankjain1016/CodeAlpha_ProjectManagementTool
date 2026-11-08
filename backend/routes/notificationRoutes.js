const express = require('express');
const { getNotifications, markAllRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', getNotifications);
router.post('/read-all', markAllRead);

module.exports = router;

