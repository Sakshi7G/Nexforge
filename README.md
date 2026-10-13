# NexForge — AI-Powered Real-Time Collaborative IDE

NexForge is a full-stack real-time collaborative IDE featuring multi-user CRDT document sync, remote presence cursors, interactive PTY terminals, containerized Docker execution sandboxes, WebRTC video calling, synced whiteboard, team chat, Git version control, and a broad Google Gemini AI assistant suite.

---

## Core Features

1. **Authentication & Accounts**: JWT authentication, bcrypt password hashing, session tokens, customizable user avatars.
2. **Workspaces & Database**: Roles (`owner`, `editor`, `viewer`), SQLite / PostgreSQL via Prisma ORM, persistent workspaces.
3. **Multi-file Support**: Multi-depth nested file trees, CRUD operations, disk mirror synchronization under `workspaces_storage/`.
4. **Real-time Collaboration**: Socket.IO CRDT real-time text sync, multi-user remote cursors, live presence, instant file-tree synchronization.
5. **Terminal**: Interactive PTY terminal stream connected directly to frontend `Xterm.js`.
6. **Docker Code Execution**: Resource-capped Docker containers (CPU/memory caps, no host network) for Node.js, Python, C++, Go, Rust (with process runner fallback).
7. **Gemini AI Assistant Suite**:
   - Contextual AI Chat (file & terminal aware)
   - AI Debugger (stack trace analysis & 1-click diff fix)
   - Inline Code Explanation & Refactoring
   - AI Code Review (bugs, security, performance)
   - Unit Test Generator & JSDoc Generator
   - Auto-Fix for compile/runtime errors
   - AI Git Commit Message Generator
8. **Workspace Team Chat**: Real-time team chat with persistence and typing indicators.
9. **Synced Whiteboard**: Interactive HTML5 canvas with real-time vector stroke broadcasting, tools, and state persistence.
10. **WebRTC Video Call**: P2P audio/video calls with backend Socket.IO signaling.
11. **Git Integration**: `simple-git` operations (init, status, commit, log history, diff).

---

## Local Quickstart Guide

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Configure Environment Variables
Create `.env` in `server/`:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=nexforge_super_secret_jwt_key
DATABASE_URL="file:./dev.db"
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Generate Database Schema
```bash
cd server
npx prisma generate
npx prisma db push
```

### 4. Run Development Servers
In root directory:
```bash
# Terminal 1: Run Backend Server
npm run dev:server

# Terminal 2: Run Frontend Client
npm run dev:client
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

---

## Production Docker Deployment

```bash
docker-compose up --build -d
```
