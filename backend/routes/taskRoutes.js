const express = require('express');
const { getTask, updateTask, moveTask, deleteTask, getMyTasks } = require('../controllers/taskController');
const { addComment } = require('../controllers/commentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// "mine" must come before ":id" to avoid matching as an ObjectId
router.get('/mine', getMyTasks);

router.route('/:id').get(getTask).put(updateTask).delete(deleteTask);
router.patch('/:id/move', moveTask);
router.post('/:id/comments', addComment);

module.exports = router;

