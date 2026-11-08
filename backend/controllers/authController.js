/**
 * Auth controller — register, login, get current user.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { validateName, validateEmail, validatePassword } = require('../utils/validators');

/** Generate a JWT for a user id */
function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

/** Format user for API response (no password, _id -> id) */
function userResponse(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarHue: user.avatarHue,
  };
}

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const nameV = validateName(req.body.name);
  if (!nameV.valid) throw new ApiError(400, nameV.message);

  const emailV = validateEmail(req.body.email);
  if (!emailV.valid) throw new ApiError(400, emailV.message);

  const passV = validatePassword(req.body.password);
  if (!passV.valid) throw new ApiError(400, passV.message);

  // Check for existing user
  const exists = await User.findOne({ email: emailV.value });
  if (exists) throw new ApiError(409, 'An account with this email already exists');

  const user = await User.create({
    name: nameV.value,
    email: emailV.value,
    password: passV.value,
  });

  const token = signToken(user._id);
  res.status(201).json({ token, user: userResponse(user) });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const emailV = validateEmail(req.body.email);
  if (!emailV.valid) throw new ApiError(400, 'Wrong email or password');

  const passV = validatePassword(req.body.password);
  if (!passV.valid) throw new ApiError(400, 'Wrong email or password');

  const user = await User.findOne({ email: emailV.value }).select('+password');
  if (!user || !(await user.matchPassword(passV.value))) {
    throw new ApiError(401, 'Wrong email or password');
  }

  const token = signToken(user._id);
  res.status(200).json({ token, user: userResponse(user) });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.json({ user: userResponse(req.user) });
});

module.exports = { register, login, getMe };

