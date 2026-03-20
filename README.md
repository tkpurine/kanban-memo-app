# Kanban Memo App

A kanban-style task management app that supports daily activities. Work is recorded per session and persisted to JSON files on the local filesystem.

## Features

- **Kanban board** with 4 columns: Todo, In Progress, Waiting, Done
- **Session management** — start/end sessions with automatic task carry-over
- **Drag & drop** — move tasks between columns, assign tags to tasks
- **Tag system** — create and assign tags to organize tasks
- **Local JSON storage** — all data saved as JSON files in a user-specified folder

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML / CSS / JavaScript |
| Backend | Node.js (Express) |
| Data | JSON files (local folder) |

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser and specify the folder path for data storage.

## Documentation

- [Specification](docs/spec.md)

---

[日本語版 README はこちら](README.ja.md)
