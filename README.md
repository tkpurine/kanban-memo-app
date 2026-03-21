# Kanban Memo App

A lightweight kanban-style task management app for daily activities. Manage tasks across sessions with drag-and-drop, tags, and multiple views — all from the browser.

## Features

- **Kanban board** — 4 columns: Todo, In Progress, Waiting, Done
- **List view** — compact sortable list with drag-handle reordering
- **Session management** — start/end sessions; unfinished tasks carry over automatically
- **Drag & drop** — move tasks between columns, drag tags onto tasks (powered by SortableJS)
- **Tag system** — create, rename, and delete tags; assign to tasks for organization
- **Task editing** — click to open detail modal, double-click for quick inline edit
- **Mobile-friendly** — responsive design with column tabs, bottom sheet tag drawer, and touch support
- **PWA** — installable as a Progressive Web App for mobile home screen access
- **Password protection** — optional token-based authentication
- **Dual storage** — local SQLite (default) or Turso cloud database for remote access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML / CSS / JavaScript |
| Backend | Node.js + Express |
| Database | SQLite via [@libsql/client](https://github.com/tursodatabase/libsql-client-ts) |
| Drag & Drop | [SortableJS](https://sortablejs.github.io/Sortable/) (CDN) |

## Quick Start (Local)

```bash
git clone https://github.com/tkpurine/kanban-memo-app.git
cd kanban-memo-app
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. On first launch, specify a local folder path where the SQLite database will be stored (e.g. `~/kanban-data`).

## Configuration

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `APP_PASSWORD` | Set to enable login protection | *(empty = no auth)* |
| `STORAGE_FOLDER` | Auto-set storage folder (skip folder modal) | *(empty)* |
| `TURSO_DATABASE_URL` | Turso cloud database URL | *(empty = local mode)* |
| `TURSO_AUTH_TOKEN` | Turso auth token | *(empty)* |

### Auto-configure storage folder

For convenience, set `STORAGE_FOLDER` to skip the folder selection modal on startup:

```bash
STORAGE_FOLDER=~/kanban-data npm run dev
```

## Usage

### Views

- **Board view** — drag tasks between the 4 kanban columns
- **List view** — drag the ≡ handle to reorder tasks; change status via dropdown

### Tasks

- **Add**: type in the input field and press `Cmd+Enter` (or `Ctrl+Enter`)
- **Edit**: click a task to open the detail modal, or double-click for inline editing
- **Delete**: open the detail modal and click Delete
- **Tag assignment**: drag a tag from the sidebar onto a task, or use the dropdown in the detail modal

### Tags

- **Create**: type a name in the sidebar input and click "+ Add"
- **Rename**: hover over a tag in the sidebar and click the ✎ icon
- **Delete**: open the tag edit modal and click Delete (removes from all tasks)

### Sessions

Click **+ New Session** to start fresh. Tasks not marked as Done are automatically carried over to the new session.

## Advanced: Cloud Deployment (Render + Turso)

For remote access from any device, deploy to [Render](https://render.com) with [Turso](https://turso.tech) as the cloud database. Both offer free tiers with no credit card required.

### 1. Create a Turso database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Sign up / log in
turso auth signup
turso auth login

# Create database (choose a region close to you)
turso db create kanban-memo --region aws-ap-northeast-1

# Get connection details
turso db show kanban-memo --url
turso db tokens create kanban-memo
```

### 2. Deploy to Render

1. Push your repo to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables:
   - `TURSO_DATABASE_URL` — the URL from `turso db show`
   - `TURSO_AUTH_TOKEN` — the token from `turso db tokens create`
   - `APP_PASSWORD` — set a password to protect your app
6. Deploy

> **Note**: Do NOT set `STORAGE_FOLDER` when using Turso mode. The app auto-detects Turso mode from `TURSO_DATABASE_URL` and skips the folder configuration modal.

### Architecture

```
Local mode:     Browser  →  Express  →  SQLite file (local folder)
Cloud mode:     Browser  →  Express (Render)  →  Turso (cloud SQLite)
```

The app uses [@libsql/client](https://github.com/tursodatabase/libsql-client-ts) which transparently supports both local SQLite files and Turso cloud databases with the same API.

## Project Structure

```
src/
├── client/
│   ├── index.html          # Single-page app
│   ├── css/style.css       # Apple-inspired responsive styles
│   ├── js/app.js           # Client logic, SortableJS setup
│   ├── sw.js               # Service Worker (PWA, network-first cache)
│   ├── manifest.json       # PWA manifest
│   └── icons/              # App icons
└── server/
    ├── index.js            # Express app, static serving, config
    ├── routes.js           # REST API endpoints
    ├── queries.js          # Data access layer (libSQL)
    ├── db.js               # Database initialization
    └── auth.js             # Token-based authentication
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/session/current` | Get or create current session |
| POST | `/api/session/new` | Start new session (carry over tasks) |
| POST | `/api/task` | Create a task |
| PUT | `/api/task/:id` | Update task (content, status, tags) |
| DELETE | `/api/task/:id` | Delete a task |
| PUT | `/api/tasks/order` | Reorder tasks |
| DELETE | `/api/task/:id/tags/:tagId` | Remove a tag from a task |
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create a tag |
| PUT | `/api/tags/:id` | Rename a tag |
| DELETE | `/api/tags/:id` | Delete a tag |

## Documentation

- [Specification](docs/spec.md)

## License

MIT

---

[日本語版 README はこちら](README.ja.md)
