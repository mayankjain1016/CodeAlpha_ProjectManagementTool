/**
 * Middleware to check project membership and ownership.
 * Loads the project and attaches it to req.project.
 */

const Project = require('../models/Project');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { isValidObjectId } = require('../utils/validators');

/**
 * Requires the user to be a member of the project identified by :id.
 */
const requireMember = asyncHandler(async (req, _res, next) => {
  const projectId = req.params.id || req.params.projectId;
  if (!isValidObjectId(projectId)) throw new ApiError(400, 'Invalid project ID');

  const project = await Project.findById(projectId).populate('members', 'name email avatarHue').populate('owner', 'name email avatarHue');
  if (!project) throw new ApiError(404, 'Project not found');

  const isMember = project.members.some((m) => m._id.toString() === req.user._id.toString());
  if (!isMember) throw new ApiError(403, 'You are not a member of this project');

  req.project = project;
  next();
});

/**
 * Requires the user to be the owner of the project (must run after requireMember).
 */
const requireOwner = (_req, _res, next) => {
  // This is a function factory — but we use it as plain middleware that expects
  // req.project to already be set by requireMember.
  return (req, _res2, next2) => {
    if (req.project.owner._id.toString() !== req.user._id.toString()) {
      return next2(new ApiError(403, 'Only the project owner can do this'));
    }
    next2();
  };
};

// Simpler version: a single middleware that checks ownership on req.project
const ownerOnly = (req, _res, next) => {
  if (!req.project) return next(new ApiError(500, 'Project not loaded'));
  if (req.project.owner._id.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'Only the project owner can do this'));
  }
  next();
};

module.exports = { requireMember, ownerOnly };

