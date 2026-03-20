# Kanban Memo App — Specification

## 1. Overview

A kanban-style task management app that supports daily activities. Work is recorded per session and persisted to JSON files on the local filesystem.

---

## 2. System Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | HTML / CSS / JavaScript (Chrome) |
| Backend | Node.js (Express) |
| Data | JSON files (local folder) |

---

## 3. Startup Flow

1. On launch, the user specifies the JSON storage folder path via the browser UI
2. The app reads the latest session JSON from the specified folder and restores the kanban board
3. If no session exists, the app starts with an empty board

---

## 4. Screen Layout

```
+------------------------------------------------------------+----------+
|  [+ New Session]   Started: 2026-03-20 09:00 ~ Now          |          |
+------------------------------------------------------------+  Tags    |
|  [ Enter new task...                            ] [Add]     |  List    |
+---------------+---------------+---------------+-------------+          |
|    Todo       |  In Progress  |    Waiting    |    Done     |  #design |
|               |               |               |             |  #dev    |
|  [Task A]     |  [Task B]     |  [Task C]     |  [Task D]   |  #QA     |
|               |               |               |             |  [+Add]  |
+---------------+---------------+---------------+-------------+----------+
```

### Area Descriptions

- **Top bar**: New session button, session start time display
- **Task input**: Text input + Add button (fixed at top)
- **Kanban board**: 4 columns (Todo / In Progress / Waiting / Done)
- **Right sidebar**: Tag list + new tag input

---

## 5. Session Features

### 5-1. Start New Session

- Press the "New Session" button
- Backend creates a new JSON file
- Filename format: `session_YYYYMMDD_HHmmss.json`
- `startedAt` is recorded in ISO 8601 format

### 5-2. End Session & Carry Over

- Press the "New Session" button again
- `endedAt` is recorded in the current session JSON and saved
- Tasks with any status **other than "Done"** are copied to the new session
- Statuses are preserved (In Progress → In Progress, Waiting → Waiting)
- A new JSON file is created containing the carried-over tasks

---

## 6. Task Features

### 6-1. Add Task

- Enter text in the top input field and press the "Add" button
- The task is added to the "Todo" column

### 6-2. Move Task

- Drag and drop tasks between columns
- Each move triggers a JSON update via the backend

### 6-3. Tag Assignment

- Drag a tag from the right sidebar and drop it onto a task card to assign it
- Multiple tags can be assigned to a single task
- Tags can also be removed from a task card
- Each tag change triggers a JSON update

---

## 7. Tag Features

### 7-1. Tag List

- Tags are displayed in the right sidebar
- Tags are centrally managed in `tags.json` (within the storage folder)

### 7-2. Add New Tag

- New tags can be created via the input field in the sidebar
- Creating a tag appends it to `tags.json`

---

## 8. Data Structures

### 8-1. Session File: `session_YYYYMMDD_HHmmss.json`

```json
{
  "id": "session_20260320_090000",
  "startedAt": "2026-03-20T09:00:00+09:00",
  "endedAt": null,
  "tasks": [
    {
      "id": "task_20260320_090500",
      "content": "Review design document",
      "status": "todo",
      "tagIds": ["tag_001", "tag_003"],
      "createdAt": "2026-03-20T09:05:00+09:00"
    },
    {
      "id": "task_20260320_091000",
      "content": "Implement API endpoints",
      "status": "in_progress",
      "tagIds": ["tag_002"],
      "createdAt": "2026-03-20T09:10:00+09:00"
    }
  ]
}
```

### 8-2. Tag File: `tags.json`

```json
{
  "tags": [
    { "id": "tag_001", "name": "design" },
    { "id": "tag_002", "name": "dev" },
    { "id": "tag_003", "name": "QA" }
  ]
}
```

### 8-3. Status Values

| Value | Display Name |
|-------|-------------|
| `todo` | Todo |
| `in_progress` | In Progress |
| `waiting` | Waiting |
| `done` | Done |

---

## 9. API Endpoints (Node.js / Express)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/session/current` | Get current session |
| `POST` | `/api/session/new` | Create new session (ends current session and carries over tasks) |
| `PUT` | `/api/task/:id` | Update task status/tags |
| `POST` | `/api/task` | Add new task |
| `DELETE` | `/api/task/:id/tags/:tagId` | Remove a tag from a task |
| `GET` | `/api/tags` | Get tag list |
| `POST` | `/api/tags` | Add new tag |
| `POST` | `/api/config/folder` | Set storage folder path |

---

## 10. Decided Items

| Item | Decision |
|------|----------|
| Folder path input | Via browser UI dialog |
| Task ID format | Datetime-based (e.g., `task_20260320_090500`) |
| Tag removal | In scope — tags can be removed from task cards |
| Drag & drop library | To be selected during implementation (SortableJS expected) |
| Concurrent access | Single user, local use only — no locking required |

---

## 11. Future Enhancements (Deferred)

- Browse and view past sessions
- Delete tasks
- Edit/delete tags
- Add notes/detailed text to tasks
