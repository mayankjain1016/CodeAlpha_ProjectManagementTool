# TaskFlow — Modern Project Management Tool

TaskFlow is a production-quality, high-velocity project management application inspired by Linear, Trello, and Asana. Designed for engineering and product teams to organize group projects, prioritize sprint tasks, collaborate in real time, and track development velocity with precision.

Developed for Task 3 of the CodeAlpha Full Stack Development Internship.

---

## Live Demo

- **URL:** [https://taskflow-codealpha.onrender.com](https://taskflow-codealpha.onrender.com) *(Render Web Service placeholder)*
- **Note on Free Tier:** The server may take 30–60 seconds to spin up on initial load if idle.

### Demo Credentials
| Role         | Email              | Password   |
|--------------|--------------------|------------|
| Lead Admin   | `demo@taskflow.in` | `Demo@123` |
| Team Member  | `priya@taskflow.in`| `Demo@123` |

---

## Screenshots

All screenshots are stored in `docs/screenshots/` and verified across multiple viewports:

### 1. Dashboard Overview
![Dashboard Overview](docs/screenshots/dashboard.png)

### 2. Interactive Kanban Board
![Kanban Board](docs/screenshots/board.png)

### 3. Task Details Drawer & Real-Time Comments
![Task Drawer](docs/screenshots/task-drawer.png)

### 4. My Tasks Aggregator
![My Tasks](docs/screenshots/my-tasks.png)

### 5. Dark Theme
![Dark Theme](docs/screenshots/dark-mode.png)

### 6. Mobile Experience (390px Viewport)
![Mobile Layout](docs/screenshots/mobile.png)

---

## Key Features

- **Split-Screen Authentication:** Clean sign in / sign up with interactive password strength indicators, password visibility toggles, and pure CSS floating board graphics.
- **Unified App Shell:** Sticky navigation sidebar with dynamic project counters, topbar with instant debounced global search, active notification popover, and theme switcher.
- **Dynamic Kanban Board:**
  - 3 columns: *To Do*, *In Progress*, and *Done*.
  - Native HTML5 Drag and Drop with animated insertion placeholders, edge auto-scrolling, and instant optimistic updates with server rollback on failure.
  - Keyboard navigation for accessibility: focus a card, press <kbd>Space</kbd> to pick up, use arrow keys to reorder or switch columns, press <kbd>Space</kbd> to drop.
  - Mobile Touch "Move to" action menu for touchscreens.
  - Inline task creation composers (press <kbd>Enter</kbd> to submit, <kbd>Esc</kbd> to cancel).
- **Deep-Linkable Task Drawer:**
  - Shareable task URLs via hash fragment (`#task=<id>`).
  - Auto-saving inline editable fields for title, description, priority, due date, and assignee.
  - Interactive comments thread with keyboard shortcuts (<kbd>Ctrl</kbd> + <kbd>Enter</kbd> to submit).
- **Group Project Administration:**
  - Role-based authorization: Owner vs Member.
  - Live member search with debounced user discovery.
  - Project color themes with 8 palette presets.
  - Danger zone with typed project name confirmation to prevent accidental deletion.
- **My Tasks View:** Centralized task aggregator grouping work into *Overdue*, *Today*, *This week*, *Later*, and *No due date* across all projects.
- **Background Notification Polling:** Automated 20-second polling (paused when tab is hidden) delivering assignment, comment, and project addition alerts without WebSocket overhead.
- **Zero Framework Footprint:** Built with vanilla HTML5, CSS3 Custom Properties, and ES Modules.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML5, CSS3 (Custom Properties & Flex/Grid), Vanilla JavaScript (ES6 Modules) |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB with Mongoose ODM |
| **Security** | Helmet (strict CSP), CORS, Express Rate Limit, bcryptjs, jsonwebtoken (JWT) |
| **Performance** | Compression, HTTP cache headers (`no-cache` for CSS/JS, `no-store` for HTML, `immutable` for assets), and server start query parameter cache-busting (`?v=timestamp`) |
| **Typography** | Inter font via Google Fonts (display=swap) with system fallbacks |
| **Testing** | Custom end-to-end API smoke test (75 assertions) & Puppeteer visual QA suite |

---

## Architecture and Project Structure

```text
CodeAlpha_ProjectManagementTool/
├── README.md
├── .gitignore
├── docs/
│   ├── PLAN.md
│   ├── PROGRESS.md
│   └── screenshots/
│       ├── board.png
│       ├── dark-mode.png
│       ├── dashboard.png
│       ├── mobile.png
│       ├── my-tasks.png
│       └── task-drawer.png
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js                  # Entry point: connects DB & starts server
│   ├── app.js                     # Express app: CSP, routes, cache headers, clean URLs
│   ├── config/
│   │   ├── db.js                  # Safe MongoDB connection
│   │   └── env.js                 # Environment validation at startup
│   ├── models/
│   │   ├── User.js                # Users with hashed passwords & avatarHue
│   │   ├── Project.js             # Projects with color presets & members
│   │   ├── Task.js                # Tasks with column order index & priority
│   │   ├── Comment.js             # Threaded comments
│   │   └── Notification.js        # User notifications
│   ├── middleware/
│   │   ├── auth.js                # JWT Bearer token protection
│   │   ├── projectAccess.js       # Membership & owner validation
│   │   ├── errorHandler.js        # Central JSON error handling
│   │   └── rateLimiters.js        # Rate limiting for auth and API
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── projectController.js
│   │   ├── taskController.js      # Move & consecutive re-index logic
│   │   ├── commentController.js
│   │   └── notificationController.js
│   ├── routes/                    # API route definitions
│   ├── utils/
│   │   ├── asyncHandler.js
│   │   ├── ApiError.js
│   │   └── validators.js          # Input validation & sanitization
│   └── scripts/
│       ├── seed.js                # Realistic demo workspace seed
│       ├── smoke-test.js          # 75-assertion self-cleaning E2E test
│       └── visual-qa.js           # Multi-viewport responsive verification
└── frontend/
    ├── pages/
    │   ├── login.html
    │   ├── register.html
    │   ├── dashboard.html
    │   ├── board.html
    │   ├── my-tasks.html
    │   ├── 404.html
    │   └── test-icons.html
    ├── css/
    │   ├── tokens.css             # Colors, typography, spacing, shadows
    │   ├── base.css               # Reset, typography, global icon size rules
    │   ├── layout.css             # Sidebar, topbar, mobile drawer
    │   ├── components.css         # Buttons, inputs, modals, toasts, cards
    │   └── board.css              # Kanban columns, drag-and-drop, drawer
    ├── js/
    │   ├── core/
    │   │   ├── api.js             # Fetch wrapper with auto /api routing
    │   │   ├── auth.js            # JWT state & route guards
    │   │   ├── theme.js           # Zero-flash light/dark theme switcher
    │   │   ├── icons.js           # 26 Lucide-style inline SVGs
    │   │   ├── avatar.js          # Hue-gradient initials avatar generator
    │   │   ├── utils.js           # XSS escaping, date formatting, count-up
    │   │   ├── toast.js           # Accessible aria-live notifications
    │   │   ├── modal.js           # Accessible modals with focus trapping
    │   │   └── shell.js           # App navigation & background notification poller
    │   ├── components/
    │   │   ├── taskCard.js        # Kanban card with drag attributes
    │   │   ├── taskDrawer.js      # Slide-out task editor with comments
    │   │   ├── projectCard.js     # Progress tracker card
    │   │   ├── memberPicker.js    # Live user search
    │   │   └── skeletons.js       # Loading place-holders
    │   └── pages/
    │       ├── login.js
    │       ├── register.js
    │       ├── dashboard.js
    │       ├── board.js
    │       └── myTasks.js
    └── assets/
        └── favicon.svg
```

---

## API Contract

All responses are formatted in JSON. Errors return `{ "message": "Human readable text" }` with standard HTTP status codes.

| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user | Public |
| `POST` | `/api/auth/login` | Login and obtain JWT token | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Authenticated |
| `GET` | `/api/users/search?q=` | Search users by name or email (max 8) | Authenticated |
| `POST` | `/api/projects` | Create a new project | Authenticated |
| `GET` | `/api/projects` | List projects where user is a member | Authenticated |
| `GET` | `/api/projects/:id` | Get project details and sorted tasks | Project Member |
| `PUT` | `/api/projects/:id` | Update project name, description, color | Project Owner |
| `DELETE`| `/api/projects/:id` | Delete project (cascades tasks & comments) | Project Owner |
| `POST` | `/api/projects/:id/members` | Add a member to project | Project Owner |
| `DELETE`| `/api/projects/:id/members/:userId` | Remove a member (unassigns their tasks) | Project Owner |
| `POST` | `/api/projects/:id/tasks` | Create a task in project | Project Member |
| `GET` | `/api/tasks/:id` | Get task details and comments thread | Project Member |
| `PUT` | `/api/tasks/:id` | Update task properties | Project Member |
| `PATCH` | `/api/tasks/:id/move` | Reorder task across columns (`{status, index}`) | Project Member |
| `DELETE`| `/api/tasks/:id` | Delete task | Task Creator or Project Owner |
| `GET` | `/api/tasks/mine` | List all tasks assigned to current user | Authenticated |
| `POST` | `/api/tasks/:id/comments` | Add comment to a task | Project Member |
| `DELETE`| `/api/comments/:id` | Delete comment | Comment Author or Project Owner |
| `GET` | `/api/notifications` | Get user notifications & unread count | Authenticated |
| `POST` | `/api/notifications/read-all`| Mark all notifications as read | Authenticated |

---

## Data Models

### User
- `name`: String, 2–50 characters, required
- `email`: String, unique, lowercase, required
- `password`: String, bcrypt hashed (salt rounds = 12), `select: false`
- `avatarHue`: Number, 0–360 (assigned randomly upon registration for deterministic gradient avatar)

### Project
- `name`: String, 2–60 characters, required
- `description`: String, max 300 characters
- `color`: Hex preset color string (`#6366F1`, `#0D9488`, `#F59E0B`, `#EF4444`, `#8B5CF6`, `#EC4899`, `#3B82F6`, `#10B981`)
- `owner`: Ref User, indexed
- `members`: [Ref User], indexed (creator is automatically added)
- `archived`: Boolean, default `false`

### Task
- `project`: Ref Project, indexed
- `title`: String, 1–120 characters, required
- `description`: String, max 2000 characters
- `status`: String enum (`todo`, `in_progress`, `done`), indexed
- `priority`: String enum (`low`, `medium`, `high`)
- `dueDate`: Date, optional
- `assignee`: Ref User, optional, indexed
- `createdBy`: Ref User, required
- `order`: Number, position index within column (0..n)
- `commentsCount`: Number, default `0`

### Comment
- `task`: Ref Task, indexed
- `author`: Ref User, required
- `text`: String, 1–1000 characters, required

### Notification
- `recipient`: Ref User, indexed
- `actor`: Ref User, required
- `type`: String enum (`assigned`, `commented`, `added_to_project`)
- `project`: Ref Project, required
- `task`: Ref Task, optional
- `read`: Boolean, default `false`

---

## Local Setup Guide

### Prerequisites
- Node.js (v18.0.0 or later)
- MongoDB instance running locally (e.g. `mongodb://localhost:27017/taskflow`) or MongoDB Atlas URI

### Installation & Launch

1. Open PowerShell and navigate to the `backend` directory:
   ```powershell
   cd backend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Configure environment variables:
   ```powershell
   Copy-Item .env.example .env
   ```
   *(Verify `PORT=5000`, `MONGO_URI`, and `JWT_SECRET` in `.env`)*

4. Seed the database with realistic demo data:
   ```powershell
   npm run seed
   ```

5. Run the automated smoke test to verify all 75 API assertions:
   ```powershell
   npm run test:smoke
   ```

6. Start the server:
   ```powershell
   npm start
   ```

7. Open your browser and visit:
   ```text
   http://localhost:5000
   ```
   Log in with `demo@taskflow.in` / `Demo@123`.

---

## Security and Production Readiness

- **Content Security Policy (CSP):** Helmet configured with fine-tuned script, font, and style directives allowing Google Fonts while preventing code injection.
- **XSS Prevention:** All user-supplied strings are escaped via `escapeHtml()` before rendering into the DOM.
- **Strict Input Validation:** Mongoose schemas and controller-level validators verify string lengths, email formats, and ObjectIds.
- **Data Isolation:** Enforced membership checks (`requireMember`) and ownership rules (`ownerOnly`) prevent unauthorized access (403 Forbidden).
- **Safe Logging:** `MONGO_URI`, JWT secrets, and user passwords are never output to logs or terminal consoles.
- **Cache Invalidation:** Express injects dynamic timestamp query parameters (`?v=<timestamp>`) into every HTML asset link and sets `Cache-Control: no-cache` for scripts and styles to guarantee instant delivery of updates upon redeployment.

---

## Deployment Guide (Render + MongoDB Atlas)

### 1. MongoDB Atlas Setup
1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Under **Database Access**, create a user with read/write privileges.
3. Under **Network Access**, add IP address `0.0.0.0/0` (allow access from anywhere).
4. Copy the connection string (format: `mongodb+srv://<username>:<password>@cluster.mongodb.net/taskflow?retryWrites=true&w=majority`).

### 2. Render Web Service Deployment
1. Log in to [render.com](https://render.com) and click **New + > Web Service**.
2. Connect your Git repository.
3. Configure the service settings:
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Under **Environment Variables**, set:
   - `NODE_ENV`: `production`
   - `MONGO_URI`: *<Your MongoDB Atlas connection string>*
   - `JWT_SECRET`: *<A secure 32+ character random secret>*
5. Click **Create Web Service**.

### 3. Seed Production Database
To initialize your production database with sample data, run the seed script once from your local machine using the remote connection string:
```powershell
$env:MONGO_URI="mongodb+srv://<username>:<password>@cluster.mongodb.net/taskflow?retryWrites=true&w=majority"
npm run seed -- --force
$env:MONGO_URI=""
```

---

## What I Learned

1. **State Consistency in Drag & Drop:** Implementing native HTML5 drag-and-drop without external libraries requires meticulous index computation and optimistic UI updates to prevent UI jitter during rapid card reordering.
2. **Deep-Linkable Single-Page Components:** Utilizing URL hash fragments (`#task=<id>`) enables shareable task states while preserving vanilla JavaScript architectural simplicity.
3. **Defense in Depth with Strict CSP:** Fine-tuning Content Security Policies with Helmet ensures that modern styling, web fonts, and dynamic module scripts coexist securely without opening vulnerabilities.
4. **Resilient Background Polling:** Leveraging page visibility APIs (`document.visibilityState`) provides reliable notification updates without unnecessary server load during user inactivity.
