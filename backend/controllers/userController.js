/**
 * User controller — search users.
 */

const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex } = require('../utils/validators');

// GET /api/users/search?q=
const searchUsers = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 1) {
    return res.json({ users: [] });
  }

  const escaped = escapeRegex(q);
  const regex = new RegExp(escaped, 'i');

  const users = await User.find({
    $or: [{ name: regex }, { email: regex }],
  })
    .select('name email avatarHue')
    .limit(8)
    .lean();

  const result = users.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    avatarHue: u.avatarHue,
  }));

  res.json({ users: result });
});

module.exports = { searchUsers };

