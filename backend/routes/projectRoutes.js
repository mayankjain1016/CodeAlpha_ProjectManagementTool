const express = require('express');
const {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
} = require('../controllers/projectController');
const { createTask } = require('../controllers/taskController');
const { protect } = require('../middleware/auth');
const { requireMember, ownerOnly } = require('../middleware/projectAccess');

const router = express.Router();

router.use(protect);

router.route('/').get(getProjects).post(createProject);

router.route('/:id').get(requireMember, getProject).put(requireMember, ownerOnly, updateProject).delete(requireMember, ownerOnly, deleteProject);

// Members
router.post('/:id/members', requireMember, ownerOnly, addMember);
router.delete('/:id/members/:userId', requireMember, ownerOnly, removeMember);

// Tasks (creation under a project)
router.post('/:id/tasks', requireMember, createTask);

module.exports = router;

