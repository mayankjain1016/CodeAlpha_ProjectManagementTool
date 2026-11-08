/**
 * Input validation helpers.
 * All return { valid, message } for consistency.
 */

const mongoose = require('mongoose');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
}

function validateName(name) {
  if (!name || typeof name !== 'string') return { valid: false, message: 'Name is required' };
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return { valid: false, message: 'Name must be 2-50 characters' };
  return { valid: true, value: trimmed };
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return { valid: false, message: 'Email is required' };
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return { valid: false, message: 'Invalid email address' };
  return { valid: true, value: trimmed };
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return { valid: false, message: 'Password is required' };
  if (password.length < 6) return { valid: false, message: 'Password must be at least 6 characters' };
  if (password.length > 128) return { valid: false, message: 'Password is too long' };
  return { valid: true, value: password };
}

function validateProjectName(name) {
  if (!name || typeof name !== 'string') return { valid: false, message: 'Project name is required' };
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return { valid: false, message: 'Project name must be 2-60 characters' };
  return { valid: true, value: trimmed };
}

const PROJECT_COLORS = ['#6366F1', '#0D9488', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#10B981'];

function validateProjectColor(color) {
  if (!color || typeof color !== 'string') return { valid: false, message: 'Color is required' };
  if (!PROJECT_COLORS.includes(color.toUpperCase() === color ? color : color.toUpperCase())) {
    // Also accept lowercase
    const upper = color.toUpperCase();
    if (!PROJECT_COLORS.map((c) => c.toUpperCase()).includes(upper)) {
      return { valid: false, message: 'Invalid project color' };
    }
    return { valid: true, value: PROJECT_COLORS.find((c) => c.toUpperCase() === upper) };
  }
  return { valid: true, value: color };
}

function validateTaskTitle(title) {
  if (!title || typeof title !== 'string') return { valid: false, message: 'Task title is required' };
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 120) return { valid: false, message: 'Task title must be 1-120 characters' };
  return { valid: true, value: trimmed };
}

function validateDescription(desc, maxLen = 2000) {
  if (desc === undefined || desc === null) return { valid: true, value: '' };
  if (typeof desc !== 'string') return { valid: false, message: 'Description must be a string' };
  const trimmed = desc.trim();
  if (trimmed.length > maxLen) return { valid: false, message: `Description must be at most ${maxLen} characters` };
  return { valid: true, value: trimmed };
}

const TASK_STATUSES = ['todo', 'in_progress', 'done'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];

function validateStatus(status) {
  if (!status) return { valid: true, value: 'todo' };
  if (!TASK_STATUSES.includes(status)) return { valid: false, message: 'Status must be todo, in_progress or done' };
  return { valid: true, value: status };
}

function validatePriority(priority) {
  if (!priority) return { valid: true, value: 'medium' };
  if (!TASK_PRIORITIES.includes(priority)) return { valid: false, message: 'Priority must be low, medium or high' };
  return { valid: true, value: priority };
}

function validateCommentText(text) {
  if (!text || typeof text !== 'string') return { valid: false, message: 'Comment text is required' };
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 1000) return { valid: false, message: 'Comment must be 1-1000 characters' };
  return { valid: true, value: trimmed };
}

/** Escape a string for use in a RegExp */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  isValidObjectId,
  validateName,
  validateEmail,
  validatePassword,
  validateProjectName,
  validateProjectColor,
  validateTaskTitle,
  validateDescription,
  validateStatus,
  validatePriority,
  validateCommentText,
  escapeRegex,
  PROJECT_COLORS,
  TASK_STATUSES,
  TASK_PRIORITIES,
};

