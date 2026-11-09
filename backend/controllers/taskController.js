/**
 * Task controller — CRUD, move (reorder across columns), my tasks.
 */

const Task = require('../models/Task');
const Project = require('../models/Project');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { formatTask } = require('./projectController');
const { emitToProject, emitToUser } = require('../socket');
const {
  isValidObjectId,
  validateTaskTitle,
  validateDescription,
  validateStatus,
  validatePriority,
} = require('../utils/validators');

// POST /api/projects/:id/tasks
const createTask = asyncHandler(async (req, res) => {
  const project = req.project;

  const titleV = validateTaskTitle(req.body.title);
  if (!titleV.valid) throw new ApiError(400, titleV.message);

  const descV = validateDescription(req.body.description, 2000);
  if (!descV.valid) throw new ApiError(400, descV.message);

  const statusV = validateStatus(req.body.status);
  if (!statusV.valid) throw new ApiError(400, statusV.message);

  const priorityV = validatePriority(req.body.priority);
  if (!priorityV.valid) throw new ApiError(400, priorityV.message);

  let assignee = null;
  if (req.body.assignee) {
    if (!isValidObjectId(req.body.assignee)) throw new ApiError(400, 'Invalid assignee ID');
    const isMember = project.members.some((m) => m._id.toString() === req.body.assignee);
    if (!isMember) throw new ApiError(400, 'Assignee must be a project member');
    assignee = req.body.assignee;
  }

  let dueDate = null;
  if (req.body.dueDate) {
    dueDate = new Date(req.body.dueDate);
    if (isNaN(dueDate.getTime())) throw new ApiError(400, 'Invalid due date');
  }

  // Place at end of column
  const maxOrder = await Task.findOne({ project: project._id, status: statusV.value })
    .sort('-order')
    .select('order')
    .lean();
  const order = maxOrder ? maxOrder.order + 1 : 0;

  const task = await Task.create({
    project: project._id,
    title: titleV.value,
    description: descV.value,
    status: statusV.value,
    priority: priorityV.value,
    dueDate,
    assignee,
    createdBy: req.user._id,
    order,
  });

  // Notify assignee
  if (assignee && assignee !== req.user._id.toString()) {
    await Notification.create({
      recipient: assignee,
      actor: req.user._id,
      type: 'assigned',
      project: project._id,
      task: task._id,
    });
  }

  const populated = await Task.findById(task._id)
    .populate('assignee', 'name email avatarHue')
    .populate('createdBy', 'name')
    .lean();

  const formatted = formatTask(populated);
  emitToProject(project._id.toString(), 'task:created', formatted);
  if (assignee && assignee !== req.user._id.toString()) {
    emitToUser(assignee, 'notification:new', {
      type: 'assigned',
      project: { id: project._id.toString(), name: project.name },
      task: { id: task._id.toString(), title: task.title },
      actor: { id: req.user._id.toString(), name: req.user.name, avatarHue: req.user.avatarHue },
      createdAt: new Date().toISOString(),
    });
  }

  res.status(201).json({ task: formatted });
});

// GET /api/tasks/:id — single task with comments
const getTask = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid task ID');

  const task = await Task.findById(req.params.id)
    .populate('assignee', 'name email avatarHue')
    .populate('createdBy', 'name')
    .lean();

  if (!task) throw new ApiError(404, 'Task not found');

  // Verify membership
  const project = await Project.findById(task.project);
  if (!project || !project.members.some((m) => m.toString() === req.user._id.toString())) {
    throw new ApiError(403, 'You are not a member of this project');
  }

  const comments = await Comment.find({ task: task._id })
    .populate('author', 'name email avatarHue')
    .sort('createdAt')
    .lean();

  const formattedComments = comments.map((c) => ({
    id: c._id.toString(),
    task: c.task.toString(),
    author: {
      id: c.author._id.toString(),
      name: c.author.name,
      email: c.author.email,
      avatarHue: c.author.avatarHue,
    },
    text: c.text,
    createdAt: c.createdAt,
  }));

  res.json({ task: formatTask(task), comments: formattedComments });
});

// PUT /api/tasks/:id — edit task (any member)
const updateTask = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid task ID');

  const task = await Task.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');

  // Verify membership
  const project = await Project.findById(task.project).populate('members', '_id');
  if (!project || !project.members.some((m) => m._id.toString() === req.user._id.toString())) {
    throw new ApiError(403, 'You are not a member of this project');
  }

  if (req.body.title !== undefined) {
    const v = validateTaskTitle(req.body.title);
    if (!v.valid) throw new ApiError(400, v.message);
    task.title = v.value;
  }
  if (req.body.description !== undefined) {
    const v = validateDescription(req.body.description, 2000);
    if (!v.valid) throw new ApiError(400, v.message);
    task.description = v.value;
  }
  if (req.body.priority !== undefined) {
    const v = validatePriority(req.body.priority);
    if (!v.valid) throw new ApiError(400, v.message);
    task.priority = v.value;
  }
  if (req.body.dueDate !== undefined) {
    if (req.body.dueDate === null) {
      task.dueDate = null;
    } else {
      const d = new Date(req.body.dueDate);
      if (isNaN(d.getTime())) throw new ApiError(400, 'Invalid due date');
      task.dueDate = d;
    }
  }
  if (req.body.assignee !== undefined) {
    if (req.body.assignee === null) {
      task.assignee = null;
    } else {
      if (!isValidObjectId(req.body.assignee)) throw new ApiError(400, 'Invalid assignee ID');
      const isMember = project.members.some((m) => m._id.toString() === req.body.assignee);
      if (!isMember) throw new ApiError(400, 'Assignee must be a project member');

      const previousAssignee = task.assignee ? task.assignee.toString() : null;
      task.assignee = req.body.assignee;

      // Notify new assignee (if changed and not self)
      if (req.body.assignee !== previousAssignee && req.body.assignee !== req.user._id.toString()) {
        await Notification.create({
          recipient: req.body.assignee,
          actor: req.user._id,
          type: 'assigned',
          project: task.project,
          task: task._id,
        });
      }
    }
  }
  // Status changes via move endpoint only, but allow it here too for flexibility
  if (req.body.status !== undefined) {
    const v = validateStatus(req.body.status);
    if (!v.valid) throw new ApiError(400, v.message);
    task.status = v.value;
  }

  await task.save();

  const populated = await Task.findById(task._id)
    .populate('assignee', 'name email avatarHue')
    .populate('createdBy', 'name')
    .lean();

  const formatted = formatTask(populated);
  emitToProject(task.project.toString(), 'task:updated', formatted);

  res.json({ task: formatted });
});

// PATCH /api/tasks/:id/move { status, index }
const moveTask = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid task ID');

  const { status, index } = req.body;
  const statusV = validateStatus(status);
  if (!statusV.valid) throw new ApiError(400, statusV.message);
  if (typeof index !== 'number' || index < 0) throw new ApiError(400, 'Index must be a non-negative number');

  const task = await Task.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');

  // Verify membership
  const project = await Project.findById(task.project).populate('members', '_id');
  if (!project || !project.members.some((m) => m._id.toString() === req.user._id.toString())) {
    throw new ApiError(403, 'You are not a member of this project');
  }

  const oldStatus = task.status;
  const newStatus = statusV.value;

  if (oldStatus === newStatus) {
    // Reorder within same column
    const columnTasks = await Task.find({
      project: task.project,
      status: newStatus,
      _id: { $ne: task._id },
    }).sort('order');

    // Insert at the requested index
    const safeIndex = Math.min(index, columnTasks.length);
    columnTasks.splice(safeIndex, 0, task);

    // Re-number all
    const bulkOps = columnTasks.map((t, i) => ({
      updateOne: {
        filter: { _id: t._id },
        update: { $set: { order: i, status: newStatus } },
      },
    }));
    if (bulkOps.length) await Task.bulkWrite(bulkOps);
  } else {
    // Remove from old column and re-number it
    const oldColumnTasks = await Task.find({
      project: task.project,
      status: oldStatus,
      _id: { $ne: task._id },
    }).sort('order');

    const oldOps = oldColumnTasks.map((t, i) => ({
      updateOne: {
        filter: { _id: t._id },
        update: { $set: { order: i } },
      },
    }));

    // Insert into new column at the requested index
    const newColumnTasks = await Task.find({
      project: task.project,
      status: newStatus,
    }).sort('order');

    const safeIndex = Math.min(index, newColumnTasks.length);
    newColumnTasks.splice(safeIndex, 0, task);

    const newOps = newColumnTasks.map((t, i) => ({
      updateOne: {
        filter: { _id: t._id },
        update: { $set: { order: i, status: newStatus } },
      },
    }));

    const allOps = [...oldOps, ...newOps];
    if (allOps.length) await Task.bulkWrite(allOps);
  }

  const populated = await Task.findById(task._id)
    .populate('assignee', 'name email avatarHue')
    .populate('createdBy', 'name')
    .lean();

  const formatted = formatTask(populated);
  emitToProject(task.project.toString(), 'task:moved', {
    taskId: task._id.toString(),
    status: formatted.status,
    order: formatted.order,
    task: formatted,
  });

  res.json({ task: formatted });
});

// DELETE /api/tasks/:id (creator or project owner)
const deleteTask = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid task ID');

  const task = await Task.findById(req.params.id);
  if (!task) throw new ApiError(404, 'Task not found');

  const project = await Project.findById(task.project);
  if (!project || !project.members.some((m) => m.toString() === req.user._id.toString())) {
    throw new ApiError(403, 'You are not a member of this project');
  }

  const isCreator = task.createdBy.toString() === req.user._id.toString();
  const isOwner = project.owner.toString() === req.user._id.toString();
  if (!isCreator && !isOwner) {
    throw new ApiError(403, 'Only the task creator or project owner can delete this task');
  }

  await Comment.deleteMany({ task: task._id });
  await Notification.deleteMany({ task: task._id });
  await Task.findByIdAndDelete(task._id);

  // Re-number the column
  const remaining = await Task.find({ project: task.project, status: task.status }).sort('order');
  const ops = remaining.map((t, i) => ({
    updateOne: { filter: { _id: t._id }, update: { $set: { order: i } } },
  }));
  if (ops.length) await Task.bulkWrite(ops);

  emitToProject(task.project.toString(), 'task:deleted', { taskId: task._id.toString() });

  res.json({ message: 'Task deleted' });
});

// GET /api/tasks/mine
const getMyTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ assignee: req.user._id })
    .populate('assignee', 'name email avatarHue')
    .populate('createdBy', 'name')
    .populate('project', 'name color')
    .sort({ dueDate: 1 })
    .lean();

  const formattedTasks = tasks.map((t) => ({
    ...formatTask(t),
    project: {
      id: t.project._id.toString(),
      name: t.project.name,
      color: t.project.color,
    },
  }));

  res.json({ tasks: formattedTasks });
});

module.exports = { createTask, getTask, updateTask, moveTask, deleteTask, getMyTasks };

