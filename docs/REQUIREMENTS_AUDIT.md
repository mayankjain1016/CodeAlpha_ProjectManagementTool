# TaskFlow — Requirements Audit

**Task 3:** Project Management Tool (Collaborative Trello/Asana style application)  
**Internship:** CodeAlpha Full Stack Development Internship  
**Audit Date:** November 9, 2026  
**Auditor:** Principal Full-Stack Engineer & Senior Product Designer

---

## 1. Scope Compliance Matrix

| Requirement Area | Specific Requirement | Status | Evidence (Files & Endpoints) | Notes & Enhancements |
|---|---|---|---|---|
| **Authentication** | User Registration with secure password hashing | **DONE** | `backend/controllers/authController.js`<br>`POST /api/auth/register`<br>`frontend/pages/register.html` | bcryptjs with salt 10, auto avatarHue assignment, password strength meter, inline validation. Zero password hashes exposed. |
| **Authentication** | User Login & JWT Session | **DONE** | `backend/controllers/authController.js`<br>`POST /api/auth/login`<br>`frontend/pages/login.html` | JWT Bearer token generation (7d expiry), client-side session store in localStorage, quick demo credentials fill. |
| **Authentication** | Logout & Protected Routes | **DONE** | `backend/middleware/auth.js`<br>`frontend/js/core/auth.js`<br>`GET /api/auth/me` | Clean session wipe, redirect guards (`requireAuth`, `requireGuest`), 401 interceptor with auto-logout. |
| **Group Projects** | Create Group Project | **DONE** | `backend/controllers/projectController.js`<br>`POST /api/projects`<br>`frontend/pages/dashboard.html` | Supports custom name, description, 8 color themes. Creator automatically assigned as `owner` and first `member`. |
| **Group Projects** | Multi-Member Collaboration | **DONE** | `backend/models/Project.js`<br>`GET /api/projects/:id`<br>`frontend/js/pages/board.js` | Projects store `members` array of user ObjectIds with populated names, emails, and avatar gradients. |
| **Group Projects** | Discover & Invite Members | **DONE** | `backend/controllers/userController.js`<br>`GET /api/users/search?q=`<br>`POST /api/projects/:id/members` | Debounced live search querying both name and email ($or regex). Owner-only member invite with duplicate check. |
| **Group Projects** | Remove Member & Role Protection | **DONE** | `backend/controllers/projectController.js`<br>`DELETE /api/projects/:id/members/:userId` | Only project owner can remove members. Owner cannot remove self. Unassigns active tasks of removed member. |
| **Group Projects** | Project Settings & Deletion | **DONE** | `backend/controllers/projectController.js`<br>`PUT /api/projects/:id`<br>`DELETE /api/projects/:id` | Edit name, description, color. Danger zone with typed project name confirmation to delete. Cascades tasks, comments, notifications. |
| **Project Boards** | Kanban Columns (To Do, In Progress, Done) | **DONE** | `backend/models/Task.js`<br>`frontend/pages/board.html`<br>`frontend/css/board.css` | 3 distinct status columns with frosted surfaces, status indicator dots, top accent lines, count pills, and quick-add buttons. |
| **Project Boards** | Task Cards Rendering | **DONE** | `frontend/js/components/taskCard.js`<br>`frontend/css/board.css` | Cards render 3px priority stripe, medium weight title, priority badge, smart due date chip, comment counter, and assignee avatar. |
| **Project Boards** | Drag and Drop Reordering | **DONE** | `backend/controllers/taskController.js`<br>`PATCH /api/tasks/:id/move`<br>`frontend/js/pages/board.js` | Native HTML5 DnD with drop placeholders, 2deg drag tilt, optimistic UI update, server rollback, and consecutive integer order re-indexing. |
| **Project Boards** | Keyboard & Touch Reordering | **DONE** | `frontend/js/pages/board.js`<br>`frontend/css/board.css` | Accessible keyboard moves (<kbd>Space</kbd> to grab, arrows to navigate, <kbd>Space</kbd> to drop) and mobile touch "Move to" action menu. |
| **Project Boards** | Filtering & Search | **DONE** | `frontend/pages/board.html`<br>`frontend/js/pages/board.js` | Real-time filtering by task title/description text, assignee (Everyone / Me / Unassigned / specific member), and priority. Clear filters button. |
| **Task Management**| Create, Edit, Delete Tasks | **DONE** | `backend/controllers/taskController.js`<br>`POST /api/projects/:id/tasks`<br>`PUT /api/tasks/:id`<br>`DELETE /api/tasks/:id` | Any project member can create and edit tasks. Task deletion restricted to task creator or project owner. |
| **Task Management**| Task Assignment | **DONE** | `backend/controllers/taskController.js`<br>`PUT /api/tasks/:id` | Tasks assignable to any project member or unassigned. Triggers notification alert to assignee. |
| **Communication**  | Deep-Linkable Task Detail Sheet | **DONE** | `frontend/js/components/taskDrawer.js`<br>`GET /api/tasks/:id` | Slide-over drawer with deep link hash (`#task=ID`), sticky header, task key (`TF-XXXX`), copy-link shortcut, autosave on blur. |
| **Communication**  | Chronological Threaded Comments | **DONE** | `backend/controllers/commentController.js`<br>`POST /api/tasks/:id/comments`<br>`DELETE /api/comments/:id` | Comments sorted chronologically with author avatar, name, and relative time. Author or project owner can delete comments. |
| **Communication**  | Comment Notifications | **DONE** | `backend/controllers/commentController.js`<br>`backend/models/Notification.js` | Adding a comment automatically creates notification for task assignee (if assignee != author). |
| **App Navigation** | Centralized My Tasks View | **DONE** | `backend/controllers/taskController.js`<br>`GET /api/tasks/mine`<br>`frontend/pages/my-tasks.html` | Aggregates work assigned to current user across all projects into Overdue, Today, This Week, Later, and No Date. |
| **App Navigation** | Instant Global Search | **DONE** | `frontend/js/core/shell.js`<br>`frontend/css/layout.css` | Topbar search with <kbd>Ctrl K</kbd> shortcut chip querying tasks and projects across the workspace with instant jump navigation. |
| **Bonus**          | In-App Notifications | **DONE** | `backend/controllers/notificationController.js`<br>`GET /api/notifications`<br>`POST /api/notifications/read-all` | 20-second background polling with tab visibility detection, unread badge, popover feed, and "Mark all read". Added single read endpoint. |
| **Bonus**          | Real-Time Updates via WebSockets | **DONE** | `backend/socket.js`<br>`backend/server.js`<br>`frontend/js/core/socket.js` | Full-duplex WebSocket communication with JWT auth, project & user rooms, broadcast of tasks/comments/members, and fallback polling with quiet indicator. |

---

## 2. Gap Analysis & Resolved Fixes

During the audit, the following functional gaps and improvements were identified and addressed:

1. **Single Notification Mark as Read Endpoint:**  
   *Gap:* Previously only `POST /api/notifications/read-all` existed. Clicking an individual notification did not persist read state on the backend.  
   *Resolution:* Added `PATCH /api/notifications/:id/read` in `backend/controllers/notificationController.js` and wired it into `notificationRoutes.js`.

2. **Project Breadcrumbs & Command Palette in Shell:**  
   *Enhancement:* Upgraded topbar with context-aware breadcrumbs (`Workspace / Project Name`) and a full command palette (`Ctrl+K`) supporting page navigation, project search, and quick actions.

3. **Compact Mode View Toggle for Board:**  
   *Enhancement:* Added a persistent view mode toggle (Comfortable vs Compact) saved per user in `localStorage`.

4. **Task Timeline & Audit Events:**  
   *Enhancement:* Enriched the task drawer comments section with system activity events (status changes, moves, assignment updates) alongside user comments.

---

## 3. Verification & Compliance Conclusion

All core requirements from Task 3 of the CodeAlpha internship are **100% DONE** and verified. The architecture adheres to all constraints: vanilla HTML/CSS/ES6 on the frontend, Express + MongoDB backend with strict security headers (Helmet CSP, rate limiting), zero logged secrets, no emojis in UI chrome, fixed-dimension SVG icons, and verified responsiveness across 1920px, 1366px, 768px, and 390px viewports.
