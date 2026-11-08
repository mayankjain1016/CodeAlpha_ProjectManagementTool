/**
 * Project controller — CRUD, member management.
 */

const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  isValidObjectId,
  validateProjectName,
  validateDescription,
  validateProjectColor,
} = require('../utils/validators');

/** Populate helper for a project */
const MEMBER_FIELDS = 'name email avatarHue';
async function populateProject(project) {
  return project.populate([
    { path: 'owner', select: MEMBER_FIELDS },
    { path: 'members', select: MEMBER_FIELDS },
  ]);
}

// POST /api/projects
const createProject = asyncHandler(async (req, res) => {
  const nameV = validateProjectName(req.body.name);
  if (!nameV.valid) throw new ApiError(400, nameV.message);

  const descV = validateDescription(req.body.description, 300);
  if (!descV.valid) throw new ApiError(400, descV.message);

  const colorV = validateProjectColor(req.body.color);
  if (!colorV.valid) throw new ApiError(400, colorV.message);

  let project = await Project.create({
    name: nameV.value,
    description: descV.value,
    color: colorV.value,
    owner: req.user._id,
    members: [req.user._id],
  });

  project = await populateProject(project);
  res.status(201).json({ project });
});

// GET /api/projects — all projects the user is a member of
const getProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({ members: req.user._id })
    .populate('owner', MEMBER_FIELDS)
    .populate('members', MEMBER_FIELDS)
    .sort('-updatedAt')
    .lean();

  // Aggregate task stats per project
  const projectIds = projects.map((p) => p._id);
  const stats = await Task.aggregate([
    { $match: { project: { $in: projectIds } } },
    {
      $group: {
        _id: '$project',
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$dueDate', null] },
                  { $lt: ['$dueDate', new Date()] },
                  { $ne: ['$status', 'done'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const statsMap = {};
  stats.forEach((s) => {
    statsMap[s._id.toString()] = { total: s.total, done: s.done, overdue: s.overdue };
  });

  const result = projects.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    description: p.description,
    color: p.color,
    owner: { id: p.owner._id.toString(), name: p.owner.name, email: p.owner.email, avatarHue: p.owner.avatarHue },
    members: p.members.map((m) => ({ id: m._id.toString(), name: m.name, email: m.email, avatarHue: m.avatarHue })),
    stats: statsMap[p._id.toString()] || { total: 0, done: 0, overdue: 0 },
    updatedAt: p.updatedAt,
  }));

  res.json({ projects: result });
});

// GET /api/projects/:id — single project with tasks
const getProject = asyncHandler(async (req, res) => {
  // req.project is already populated by requireMember middleware
  const project = req.project;

  const tasks = await Task.find({ project: project._id })
    .populate('assignee', 'name email avatarHue')
    .populate('createdBy', 'name')
    .sort({ status: 1, order: 1 })
    .lean();

  const formattedTasks = tasks.map(formatTask);

  res.json({
    project: formatProjectDoc(project),
    tasks: formattedTasks,
  });
});

// PUT /api/projects/:id (owner only — ownerOnly middleware runs before this)
const updateProject = asyncHandler(async (req, res) => {
  const project = req.project;

  if (req.body.name !== undefined) {
    const v = validateProjectName(req.body.name);
    if (!v.valid) throw new ApiError(400, v.message);
    project.name = v.value;
  }
  if (req.body.description !== undefined) {
    const v = validateDescription(req.body.description, 300);
    if (!v.valid) throw new ApiError(400, v.message);
    project.description = v.value;
  }
  if (req.body.color !== undefined) {
    const v = validateProjectColor(req.body.color);
    if (!v.valid) throw new ApiError(400, v.message);
    project.color = v.value;
  }

  await project.save();
  await populateProject(project);
  res.json({ project: formatProjectDoc(project) });
});

// DELETE /api/projects/:id (owner only)
const deleteProject = asyncHandler(async (req, res) => {
  const project = req.project;

  // Cascade: get all task IDs for comment deletion
  const taskIds = await Task.find({ project: project._id }).distinct('_id');
  await Comment.deleteMany({ task: { $in: taskIds } });
  await Task.deleteMany({ project: project._id });
  await Notification.deleteMany({ project: project._id });
  await Project.findByIdAndDelete(project._id);

  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:id/members (owner only)
const addMember = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId || !isValidObjectId(userId)) throw new ApiError(400, 'Valid user ID is required');

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const project = req.project;

  if (project.members.some((m) => m._id.toString() === userId)) {
    throw new ApiError(409, 'User is already a member');
  }

  project.members.push(userId);
  await project.save();

  // Notify the added user (unless it's the owner adding themselves, which shouldn't happen)
  if (userId !== req.user._id.toString()) {
    await Notification.create({
      recipient: userId,
      actor: req.user._id,
      type: 'added_to_project',
      project: project._id,
    });
  }

  await populateProject(project);
  res.json({ project: formatProjectDoc(project) });
});

// DELETE /api/projects/:id/members/:userId (owner only, cannot remove owner)
const removeMember = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!isValidObjectId(userId)) throw new ApiError(400, 'Invalid user ID');

  const project = req.project;

  if (project.owner._id.toString() === userId) {
    throw new ApiError(400, 'Cannot remove the project owner');
  }

  const idx = project.members.findIndex((m) => m._id.toString() === userId);
  if (idx === -1) throw new ApiError(404, 'User is not a member');

  project.members.splice(idx, 1);

  // Unassign that user's tasks in this project
  await Task.updateMany(
    { project: project._id, assignee: userId },
    { $set: { assignee: null } }
  );

  await project.save();
  await populateProject(project);
  res.json({ project: formatProjectDoc(project) });
});

/* ---- Helpers ---- */

function formatProjectDoc(project) {
  const p = project.toJSON ? project.toJSON() : project;
  return {
    id: (p.id || p._id).toString(),
    name: p.name,
    description: p.description,
    color: p.color,
    archived: p.archived,
    owner: typeof p.owner === 'object'
      ? { id: (p.owner.id || p.owner._id).toString(), name: p.owner.name, email: p.owner.email, avatarHue: p.owner.avatarHue }
      : p.owner,
    members: (p.members || []).map((m) =>
      typeof m === 'object'
        ? { id: (m.id || m._id).toString(), name: m.name, email: m.email, avatarHue: m.avatarHue }
        : m
    ),
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
  };
}

function formatTask(t) {
  return {
    id: (t.id || t._id).toString(),
    project: t.project.toString ? t.project.toString() : t.project,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    order: t.order,
    commentsCount: t.commentsCount,
    assignee: t.assignee
      ? { id: (t.assignee.id || t.assignee._id).toString(), name: t.assignee.name, avatarHue: t.assignee.avatarHue }
      : null,
    createdBy: t.createdBy
      ? { id: (t.createdBy.id || t.createdBy._id).toString(), name: t.createdBy.name }
      : null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  addMember,
  removeMember,
  formatTask,
};

