/**
 * Notification controller — list and mark all as read.
 */

const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/notifications
const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate('actor', 'name avatarHue')
    .populate('project', 'name color')
    .populate('task', 'title')
    .sort('-createdAt')
    .limit(50)
    .lean();

  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    read: false,
  });

  const formatted = notifications.map((n) => ({
    id: n._id.toString(),
    type: n.type,
    actor: n.actor ? { id: n.actor._id.toString(), name: n.actor.name, avatarHue: n.actor.avatarHue } : null,
    project: n.project ? { id: n.project._id.toString(), name: n.project.name, color: n.project.color } : null,
    task: n.task ? { id: n.task._id.toString(), title: n.task.title } : null,
    read: n.read,
    createdAt: n.createdAt,
  }));

  res.json({ notifications: formatted, unreadCount });
});

// POST /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { $set: { read: true } }
  );
  res.json({ message: 'All notifications marked as read' });
});

module.exports = { getNotifications, markAllRead };

