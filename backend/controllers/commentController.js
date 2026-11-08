/**
 * Comment controller — add and delete comments.
 */

const Comment = require('../models/Comment');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { isValidObjectId, validateCommentText } = require('../utils/validators');

// POST /api/tasks/:id/comments
const addComment = asyncHandler(async (req, res) => {
  const taskId = req.params.id;
  if (!isValidObjectId(taskId)) throw new ApiError(400, 'Invalid task ID');

  const textV = validateCommentText(req.body.text);
  if (!textV.valid) throw new ApiError(400, textV.message);

  const task = await Task.findById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');

  // Verify membership
  const project = await Project.findById(task.project);
  if (!project || !project.members.some((m) => m.toString() === req.user._id.toString())) {
    throw new ApiError(403, 'You are not a member of this project');
  }

  const comment = await Comment.create({
    task: task._id,
    author: req.user._id,
    text: textV.value,
  });

  // Increment comment count
  await Task.findByIdAndUpdate(task._id, { $inc: { commentsCount: 1 } });

  // Notify task assignee (if not self)
  if (task.assignee && task.assignee.toString() !== req.user._id.toString()) {
    await Notification.create({
      recipient: task.assignee,
      actor: req.user._id,
      type: 'commented',
      project: task.project,
      task: task._id,
    });
  }

  // Also notify task creator if different from assignee and not self
  if (
    task.createdBy.toString() !== req.user._id.toString() &&
    (!task.assignee || task.createdBy.toString() !== task.assignee.toString())
  ) {
    await Notification.create({
      recipient: task.createdBy,
      actor: req.user._id,
      type: 'commented',
      project: task.project,
      task: task._id,
    });
  }

  const populated = await Comment.findById(comment._id)
    .populate('author', 'name email avatarHue')
    .lean();

  res.status(201).json({
    comment: {
      id: populated._id.toString(),
      task: populated.task.toString(),
      author: {
        id: populated.author._id.toString(),
        name: populated.author.name,
        email: populated.author.email,
        avatarHue: populated.author.avatarHue,
      },
      text: populated.text,
      createdAt: populated.createdAt,
    },
  });
});

// DELETE /api/comments/:id (author or project owner)
const deleteComment = asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid comment ID');

  const comment = await Comment.findById(req.params.id);
  if (!comment) throw new ApiError(404, 'Comment not found');

  const task = await Task.findById(comment.task);
  if (!task) throw new ApiError(404, 'Task not found');

  const project = await Project.findById(task.project);
  if (!project) throw new ApiError(404, 'Project not found');

  const isAuthor = comment.author.toString() === req.user._id.toString();
  const isOwner = project.owner.toString() === req.user._id.toString();
  if (!isAuthor && !isOwner) {
    throw new ApiError(403, 'Only the comment author or project owner can delete this');
  }

  await Comment.findByIdAndDelete(comment._id);
  await Task.findByIdAndUpdate(task._id, { $inc: { commentsCount: -1 } });

  res.json({ message: 'Comment deleted' });
});

module.exports = { addComment, deleteComment };

