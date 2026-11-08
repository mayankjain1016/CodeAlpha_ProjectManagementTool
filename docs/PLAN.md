# TaskFlow — Project Plan

## Tech Stack
| Layer      | Choice                                   |
|------------|------------------------------------------|
| Frontend   | Vanilla HTML + CSS + JS (ES modules)     |
| Backend    | Node.js 18+, Express 4                   |
| Database   | MongoDB with Mongoose 7                  |
| Auth       | bcryptjs + jsonwebtoken (Bearer tokens)  |
| Security   | helmet, cors, express-rate-limit, compression |
| Fonts      | Google Fonts (Inter, display=swap)       |
| Deployment | Render (Web Service) + MongoDB Atlas     |

## Design Tokens
- **Colors (light):** bg `#F5F6F8`, surface `#FFFFFF`, surface-2 `#FAFBFC`, text `#0F172A`, muted `#64748B`, border `#E5E8EE`
- **Colors (dark):** bg `#0B0E14`, surface `#131822`, surface-2 `#1A2030`, text `#E8ECF4`, muted `#98A2B3`, border `#232B3B`
- **Accent:** teal `#0D9488` (scale: 50–900)
- **Priority:** high `#E5484D`, medium `#F5A524`, low `#3E9B6B`
- **Type scale:** 12 / 13 / 14 (base) / 16 / 20 / 28 px, font Inter
- **Radii:** 8 / 12 / 16 px
- **Shadows:** soft only (`0 1px 3px rgba(0,0,0,.06)`, `0 4px 12px rgba(0,0,0,.08)`)
- **Motion:** ease `cubic-bezier(.22,1,.36,1)`, durations 120 / 200 / 320 ms

## Pages
| Route               | File              | Auth   | Purpose                   |
|----------------------|-------------------|--------|---------------------------|
| `/login`             | login.html        | No     | Sign in                   |
| `/register`          | register.html     | No     | Sign up                   |
| `/dashboard`         | dashboard.html    | Yes    | Overview, project cards    |
| `/projects/:id`      | board.html        | Yes    | Kanban board               |
| `/my-tasks`          | my-tasks.html     | Yes    | All tasks assigned to me   |
| `*`                  | 404.html          | —      | Not found                  |

`/` redirects to `/dashboard` (logged in) or `/login` (guest).

## API Contract

### Auth
| Method | Endpoint              | Body / Query          | Success | Response                 |
|--------|-----------------------|-----------------------|---------|--------------------------|
| POST   | `/api/auth/register`  | `{name,email,password}` | 201   | `{token, user}`          |
| POST   | `/api/auth/login`     | `{email,password}`    | 200     | `{token, user}`          |
| GET    | `/api/auth/me`        | —                     | 200     | `{user}`                 |

### Users
| Method | Endpoint              | Query    | Success | Response                         |
|--------|-----------------------|----------|---------|----------------------------------|
| GET    | `/api/users/search`   | `?q=`    | 200     | `{users: [{id,name,email,avatarHue}]}` |

### Projects
| Method | Endpoint                             | Body / Notes             | Success | Response          |
|--------|--------------------------------------|--------------------------|---------|-------------------|
| POST   | `/api/projects`                      | `{name,description,color}` | 201   | `{project}`       |
| GET    | `/api/projects`                      | —                        | 200     | `{projects: [...]}`|
| GET    | `/api/projects/:id`                  | Members only             | 200     | `{project, tasks}` |
| PUT    | `/api/projects/:id`                  | Owner only               | 200     | `{project}`       |
| DELETE | `/api/projects/:id`                  | Owner, cascade           | 200     | `{message}`       |
| POST   | `/api/projects/:id/members`          | `{userId}`, owner only   | 200     | `{project}`       |
| DELETE | `/api/projects/:id/members/:userId`  | Owner, not self          | 200     | `{project}`       |

### Tasks
| Method | Endpoint                     | Body / Notes             | Success | Response     |
|--------|------------------------------|--------------------------|---------|--------------|
| POST   | `/api/projects/:id/tasks`    | `{title,...}`            | 201     | `{task}`     |
| GET    | `/api/tasks/mine`            | Assigned to me           | 200     | `{tasks}`    |
| GET    | `/api/tasks/:id`             | —                        | 200     | `{task, comments}` |
| PUT    | `/api/tasks/:id`             | Any member               | 200     | `{task}`     |
| PATCH  | `/api/tasks/:id/move`        | `{status, index}`        | 200     | `{task}`     |
| DELETE | `/api/tasks/:id`             | Creator or project owner | 200     | `{message}`  |

### Comments
| Method | Endpoint                        | Body         | Success | Response    |
|--------|---------------------------------|--------------|---------|-------------|
| POST   | `/api/tasks/:id/comments`       | `{text}`     | 201     | `{comment}` |
| DELETE | `/api/comments/:id`             | Author/owner | 200     | `{message}` |

### Notifications
| Method | Endpoint                          | Success | Response                        |
|--------|-----------------------------------|---------|---------------------------------|
| GET    | `/api/notifications`              | 200     | `{notifications, unreadCount}`  |
| POST   | `/api/notifications/read-all`     | 200     | `{message}`                     |

### Task response shape
```json
{
  "id": "ObjectId",
  "project": "ObjectId",
  "title": "string",
  "description": "string",
  "status": "todo | in_progress | done",
  "priority": "low | medium | high",
  "dueDate": "ISO string | null",
  "order": 0,
  "commentsCount": 0,
  "assignee": { "id": "ObjectId", "name": "string", "avatarHue": 180 },
  "createdBy": { "id": "ObjectId", "name": "string" },
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

### Error response shape
```json
{ "message": "Human readable text" }
```
Status codes: 400 (validation), 401 (not authenticated), 403 (forbidden), 404 (not found), 409 (duplicate), 429 (rate limit).

## Data Models

### User
- `name` String 2-50, required
- `email` String unique, lowercase, required
- `password` String hashed, select: false
- `avatarHue` Number 0-360, random default

### Project
- `name` String 2-60
- `description` String max 300
- `color` String enum of 8 hex presets
- `owner` ObjectId ref User
- `members` [ObjectId ref User], owner always included
- `archived` Boolean default false
- Indexes: members, owner

### Task
- `project` ObjectId ref Project, indexed
- `title` String 1-120
- `description` String max 2000
- `status` enum todo/in_progress/done
- `priority` enum low/medium/high
- `dueDate` Date optional
- `assignee` ObjectId ref User optional
- `createdBy` ObjectId ref User
- `order` Number
- `commentsCount` Number default 0
- Indexes: [project, status, order], assignee

### Comment
- `task` ObjectId ref Task, indexed
- `author` ObjectId ref User
- `text` String 1-1000

### Notification
- `recipient` ObjectId ref User, indexed
- `actor` ObjectId ref User
- `type` enum assigned/commented/added_to_project
- `project` ObjectId ref Project
- `task` ObjectId ref Task (optional)
- `read` Boolean default false

