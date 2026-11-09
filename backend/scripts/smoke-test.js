/**
 * Smoke test — end-to-end API contract verification.
 * Starts the app on a random port, runs all tests, cleans up all created data.
 * Refuses to run against a non-local database unless ALLOW_REMOTE_TEST=1.
 * Exit code 0 = all passed, 1 = failures.
 */

require('dotenv').config();

const { validateEnv } = require('../config/env');
validateEnv();

const mongoose = require('mongoose');
const http = require('http');
const createApp = require('../app');

// Safety: refuse non-local databases unless explicitly allowed
const uri = process.env.MONGO_URI || '';
const isLocal = /localhost|127\.0\.0\.1/.test(uri);
if (!isLocal && process.env.ALLOW_REMOTE_TEST !== '1') {
  console.error('[smoke] Refusing to run against a non-local database. Set ALLOW_REMOTE_TEST=1 to override.');
  process.exit(1);
}

const PREFIX = `__smoke_${Date.now()}__`;
let BASE;
let server;
let passed = 0;
let failed = 0;
const cleanupIds = { users: [], projects: [], tasks: [], comments: [] };

// --- HTTP helper ---
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers.Authorization = `Bearer ${token}`;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}`);
    failed++;
  }
}

// --- Tests ---
async function runTests() {
  console.log('\n=== TaskFlow Smoke Test ===\n');

  // 1. Register user A
  let res = await request('POST', '/api/auth/register', {
    name: `${PREFIX}Alice`,
    email: `${PREFIX}alice@test.com`,
    password: 'TestPass123',
  });
  assert(res.status === 201, 'Register user A -> 201');
  assert(res.body.token && res.body.user, 'Register returns token and user');
  assert(res.body.user.id && res.body.user.name && res.body.user.email && res.body.user.avatarHue !== undefined, 'User shape correct');
  assert(!res.body.user.password, 'No password in response');
  const tokenA = res.body.token;
  const userA = res.body.user;
  cleanupIds.users.push(userA.id);

  // 2. Register user B
  res = await request('POST', '/api/auth/register', {
    name: `${PREFIX}Bob`,
    email: `${PREFIX}bob@test.com`,
    password: 'TestPass456',
  });
  assert(res.status === 201, 'Register user B -> 201');
  const tokenB = res.body.token;
  const userB = res.body.user;
  cleanupIds.users.push(userB.id);

  // 3. Register user C (outsider)
  res = await request('POST', '/api/auth/register', {
    name: `${PREFIX}Carol`,
    email: `${PREFIX}carol@test.com`,
    password: 'TestPass789',
  });
  const tokenC = res.body.token;
  const userC = res.body.user;
  cleanupIds.users.push(userC.id);

  // 4. Duplicate email -> 409
  res = await request('POST', '/api/auth/register', {
    name: `${PREFIX}Alice2`,
    email: `${PREFIX}alice@test.com`,
    password: 'TestPass123',
  });
  assert(res.status === 409, 'Duplicate email -> 409');
  assert(typeof res.body.message === 'string', 'Error has message field');

  // 5. Login
  res = await request('POST', '/api/auth/login', {
    email: `${PREFIX}alice@test.com`,
    password: 'TestPass123',
  });
  assert(res.status === 200, 'Login -> 200');
  assert(res.body.token && res.body.user, 'Login returns token and user');

  // 6. Wrong password
  res = await request('POST', '/api/auth/login', {
    email: `${PREFIX}alice@test.com`,
    password: 'WrongPass',
  });
  assert(res.status === 401, 'Wrong password -> 401');
  assert(res.body.message === 'Wrong email or password', 'Generic error message');

  // 7. Get me
  res = await request('GET', '/api/auth/me', null, tokenA);
  assert(res.status === 200, 'GET /api/auth/me -> 200');
  assert(res.body.user.id === userA.id, 'Returns correct user');

  // 8. No token -> 401
  res = await request('GET', '/api/auth/me');
  assert(res.status === 401, 'No token -> 401');

  // 9. Search users
  res = await request('GET', `/api/users/search?q=${PREFIX}`, null, tokenA);
  assert(res.status === 200, 'Search users -> 200');
  assert(Array.isArray(res.body.users), 'Users is array');
  assert(res.body.users.length >= 2, 'Found test users');

  // 10. Validation errors
  res = await request('POST', '/api/auth/register', { name: '', email: 'bad', password: '1' });
  assert(res.status === 400, 'Validation -> 400');

  // 11. Create project
  res = await request('POST', '/api/projects', {
    name: `${PREFIX}TestProject`,
    description: 'A test project',
    color: '#0D9488',
  }, tokenA);
  assert(res.status === 201, 'Create project -> 201');
  assert(res.body.project.id && res.body.project.name && res.body.project.color, 'Project shape correct');
  assert(res.body.project.owner.id === userA.id, 'Owner is creator');
  assert(res.body.project.members.length === 1, 'Creator is in members');
  const projectId = res.body.project.id;
  cleanupIds.projects.push(projectId);

  // 12. Get projects list
  res = await request('GET', '/api/projects', null, tokenA);
  assert(res.status === 200, 'GET /api/projects -> 200');
  assert(Array.isArray(res.body.projects), 'Projects is array');
  const found = res.body.projects.find((p) => p.id === projectId);
  assert(found && found.stats, 'Project has stats');

  // 13. Get single project
  res = await request('GET', `/api/projects/${projectId}`, null, tokenA);
  assert(res.status === 200, 'GET /api/projects/:id -> 200');
  assert(Array.isArray(res.body.tasks), 'Has tasks array');

  // 14. Non-member access -> 403
  res = await request('GET', `/api/projects/${projectId}`, null, tokenC);
  assert(res.status === 403, 'Non-member GET project -> 403');

  // 15. Add member
  res = await request('POST', `/api/projects/${projectId}/members`, { userId: userB.id }, tokenA);
  assert(res.status === 200, 'Add member -> 200');
  assert(res.body.project.members.length === 2, 'Now 2 members');

  // 16. Member B can now access
  res = await request('GET', `/api/projects/${projectId}`, null, tokenB);
  assert(res.status === 200, 'Member can access project');

  // 17. Member B cannot add members (not owner)
  res = await request('POST', `/api/projects/${projectId}/members`, { userId: userC.id }, tokenB);
  assert(res.status === 403, 'Non-owner add member -> 403');

  // 18. Member B cannot delete project
  res = await request('DELETE', `/api/projects/${projectId}`, null, tokenB);
  assert(res.status === 403, 'Non-owner delete project -> 403');

  // 19. Create task
  res = await request('POST', `/api/projects/${projectId}/tasks`, {
    title: `${PREFIX}Task1`,
    description: 'First test task',
    priority: 'high',
    status: 'todo',
  }, tokenA);
  assert(res.status === 201, 'Create task -> 201');
  const task1 = res.body.task;
  assert(task1.id && task1.title && task1.status === 'todo', 'Task shape correct');
  assert(task1.createdBy && task1.createdBy.id, 'Task has createdBy');
  assert(task1.commentsCount === 0, 'Comments count starts at 0');
  cleanupIds.tasks.push(task1.id);

  // 20. Create a second task
  res = await request('POST', `/api/projects/${projectId}/tasks`, {
    title: `${PREFIX}Task2`,
    priority: 'low',
  }, tokenA);
  assert(res.status === 201, 'Create task 2 -> 201');
  const task2 = res.body.task;
  cleanupIds.tasks.push(task2.id);

  // 21. Assign task
  res = await request('PUT', `/api/tasks/${task1.id}`, { assignee: userB.id }, tokenA);
  assert(res.status === 200, 'Assign task -> 200');
  assert(res.body.task.assignee && res.body.task.assignee.id === userB.id, 'Assignee set');

  // 22. Edit task
  res = await request('PUT', `/api/tasks/${task1.id}`, {
    title: `${PREFIX}Task1Updated`,
    priority: 'medium',
  }, tokenB);
  assert(res.status === 200, 'Edit task (member) -> 200');
  assert(res.body.task.title === `${PREFIX}Task1Updated`, 'Title updated');

  // 23. Non-member cannot edit task
  res = await request('PUT', `/api/tasks/${task1.id}`, { title: 'Hacked' }, tokenC);
  assert(res.status === 403, 'Non-member edit task -> 403');

  // 24. Move task to in_progress at index 0
  res = await request('PATCH', `/api/tasks/${task1.id}/move`, { status: 'in_progress', index: 0 }, tokenA);
  assert(res.status === 200, 'Move task -> 200');
  assert(res.body.task.status === 'in_progress', 'Status changed');
  assert(res.body.task.order === 0, 'Order is 0');

  // 25. Move task2 to in_progress at index 0 (pushes task1 to index 1)
  res = await request('PATCH', `/api/tasks/${task2.id}/move`, { status: 'in_progress', index: 0 }, tokenA);
  assert(res.status === 200, 'Move task2 -> 200');

  // 26. Verify order consistency
  res = await request('GET', `/api/projects/${projectId}`, null, tokenA);
  const inProgressTasks = res.body.tasks.filter((t) => t.status === 'in_progress').sort((a, b) => a.order - b.order);
  const ordersConsistent = inProgressTasks.every((t, i) => t.order === i);
  assert(ordersConsistent, 'Order values are 0..n consecutive');
  assert(inProgressTasks[0].id === task2.id, 'Task2 is at index 0 after move');

  // 27. Comment
  res = await request('POST', `/api/tasks/${task1.id}/comments`, { text: `${PREFIX}TestComment` }, tokenA);
  assert(res.status === 201, 'Add comment -> 201');
  assert(res.body.comment.id && res.body.comment.text && res.body.comment.author, 'Comment shape correct');
  const commentId = res.body.comment.id;
  cleanupIds.comments.push(commentId);

  // 28. Task commentsCount increased
  res = await request('GET', `/api/tasks/${task1.id}`, null, tokenA);
  assert(res.status === 200, 'GET single task -> 200');
  assert(res.body.task.commentsCount === 1, 'commentsCount is 1');
  assert(Array.isArray(res.body.comments), 'Has comments array');

  // 29. Notification created for assignee (userB) for comment
  res = await request('GET', '/api/notifications', null, tokenB);
  assert(res.status === 200, 'GET notifications -> 200');
  assert(typeof res.body.unreadCount === 'number', 'Has unreadCount');
  assert(Array.isArray(res.body.notifications), 'Has notifications array');
  const commentNotif = res.body.notifications.find(
    (n) => n.type === 'commented' && n.task && n.task.id === task1.id
  );
  assert(!!commentNotif, 'Comment notification created for assignee');

  // 30. Also check assigned notification
  const assignNotif = res.body.notifications.find(
    (n) => n.type === 'assigned' && n.task && n.task.id === task1.id
  );
  assert(!!assignNotif, 'Assigned notification created');

  // 30b. Mark single notification as read
  if (commentNotif) {
    const singleRes = await request('PATCH', `/api/notifications/${commentNotif.id}/read`, {}, tokenB);
    assert(singleRes.status === 200, 'Mark single notification read -> 200');
    assert(singleRes.body.notification && singleRes.body.notification.read === true, 'Notification read flag true');
  }

  // 31. Mark all read
  res = await request('POST', '/api/notifications/read-all', {}, tokenB);
  assert(res.status === 200, 'Mark all read -> 200');

  // 32. My tasks
  res = await request('GET', '/api/tasks/mine', null, tokenB);
  assert(res.status === 200, 'GET /api/tasks/mine -> 200');
  assert(Array.isArray(res.body.tasks), 'My tasks is array');
  const myTask = res.body.tasks.find((t) => t.id === task1.id);
  assert(!!myTask, 'Assigned task appears in my tasks');
  assert(myTask.project && myTask.project.id, 'My task has project summary');

  // 33. Delete comment (by author)
  res = await request('DELETE', `/api/comments/${commentId}`, null, tokenA);
  assert(res.status === 200, 'Delete comment -> 200');
  cleanupIds.comments = cleanupIds.comments.filter((id) => id !== commentId);

  // 34. Delete task (by creator)
  res = await request('DELETE', `/api/tasks/${task2.id}`, null, tokenA);
  assert(res.status === 200, 'Delete task -> 200');
  cleanupIds.tasks = cleanupIds.tasks.filter((id) => id !== task2.id);

  // 35. Member cannot delete task they didn't create
  res = await request('DELETE', `/api/tasks/${task1.id}`, null, tokenB);
  assert(res.status === 403, 'Non-creator member delete task -> 403');

  // 36. Owner can delete any task
  res = await request('DELETE', `/api/tasks/${task1.id}`, null, tokenA);
  assert(res.status === 200, 'Owner delete task -> 200');
  cleanupIds.tasks = cleanupIds.tasks.filter((id) => id !== task1.id);

  // 37. Remove member
  res = await request('DELETE', `/api/projects/${projectId}/members/${userB.id}`, null, tokenA);
  assert(res.status === 200, 'Remove member -> 200');
  assert(res.body.project.members.length === 1, 'Back to 1 member');

  // 38. Cannot remove owner
  res = await request('DELETE', `/api/projects/${projectId}/members/${userA.id}`, null, tokenA);
  assert(res.status === 400, 'Cannot remove owner -> 400');

  // 39. Delete project (cascade)
  // First add a task and comment for cascade test
  res = await request('POST', `/api/projects/${projectId}/tasks`, {
    title: `${PREFIX}CascadeTask`,
  }, tokenA);
  const cascadeTaskId = res.body.task.id;
  res = await request('POST', `/api/tasks/${cascadeTaskId}/comments`, {
    text: `${PREFIX}CascadeComment`,
  }, tokenA);

  res = await request('DELETE', `/api/projects/${projectId}`, null, tokenA);
  assert(res.status === 200, 'Delete project -> 200');
  cleanupIds.projects = cleanupIds.projects.filter((id) => id !== projectId);

  // 40. Cascade check — task should be gone
  res = await request('GET', `/api/tasks/${cascadeTaskId}`, null, tokenA);
  assert(res.status === 404, 'Cascaded task is deleted');

  // 41. Update project (create a new one to test)
  res = await request('POST', '/api/projects', {
    name: `${PREFIX}UpdateTest`,
    description: 'Will be updated',
    color: '#EF4444',
  }, tokenA);
  const updateProjectId = res.body.project.id;
  cleanupIds.projects.push(updateProjectId);

  res = await request('PUT', `/api/projects/${updateProjectId}`, {
    name: `${PREFIX}Updated`,
    description: 'Updated description',
  }, tokenA);
  assert(res.status === 200, 'Update project -> 200');
  assert(res.body.project.name === `${PREFIX}Updated`, 'Project name updated');

  // Clean up this project
  await request('DELETE', `/api/projects/${updateProjectId}`, null, tokenA);
  cleanupIds.projects = cleanupIds.projects.filter((id) => id !== updateProjectId);
}

// --- Cleanup ---
async function cleanup() {
  console.log('\n--- Cleanup ---');
  const User = require('../models/User');
  const Project = require('../models/Project');
  const Task = require('../models/Task');
  const Comment = require('../models/Comment');
  const Notification = require('../models/Notification');

  // Delete any remaining test data
  for (const cid of cleanupIds.comments) {
    await Comment.findByIdAndDelete(cid).catch(() => {});
  }
  for (const tid of cleanupIds.tasks) {
    await Comment.deleteMany({ task: tid }).catch(() => {});
    await Task.findByIdAndDelete(tid).catch(() => {});
  }
  for (const pid of cleanupIds.projects) {
    const taskIds = await Task.find({ project: pid }).distinct('_id').catch(() => []);
    await Comment.deleteMany({ task: { $in: taskIds } }).catch(() => {});
    await Task.deleteMany({ project: pid }).catch(() => {});
    await Notification.deleteMany({ project: pid }).catch(() => {});
    await Project.findByIdAndDelete(pid).catch(() => {});
  }
  for (const uid of cleanupIds.users) {
    await Notification.deleteMany({ $or: [{ recipient: uid }, { actor: uid }] }).catch(() => {});
    await User.findByIdAndDelete(uid).catch(() => {});
  }

  // Also catch any stragglers by prefix
  const users = await User.find({ email: { $regex: PREFIX } });
  for (const u of users) {
    await Notification.deleteMany({ recipient: u._id }).catch(() => {});
    await User.findByIdAndDelete(u._id).catch(() => {});
  }

  console.log('[smoke] Test data cleaned up');
}

// --- Main ---
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const app = createApp();
    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port;
        BASE = `http://127.0.0.1:${port}`;
        console.log(`[smoke] Server started on port ${port}`);
        resolve();
      });
    });

    await runTests();
  } catch (err) {
    console.error('\n[smoke] Unexpected error:', err.message);
    failed++;
  } finally {
    await cleanup();

    if (server) server.close();
    await mongoose.disconnect();

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();

