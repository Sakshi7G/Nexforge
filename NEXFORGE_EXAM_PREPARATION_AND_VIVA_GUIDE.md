# 🎓 NEXFORGE — COMPREHENSIVE PROJECT VIVA & DEFENSE MASTER GUIDE
> **Prepared for:** Final Project Viva, Technical Presentation & Examiner Q&A  
> **Project Title:** NexForge — Cloud-Native Collaborative Engineering Environment with Gemini AI  
> **Tech Stack:** React 18, TypeScript, Node.js, Express, Socket.IO, WebRTC, Docker, node-pty, Prisma ORM, PostgreSQL, SheetJS, SimpleGit, Google Gemini AI.

---

## 📑 TABLE OF CONTENTS
1. [Executive Project Overview](#1-executive-project-overview)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Database Architecture & Schema (Prisma ORM)](#3-database-architecture--schema-prisma-orm)
4. [Feature-by-Feature Deep Dive & Logic Walkthrough](#4-feature-by-feature-deep-dive--logic-walkthrough)
   - 4.1 Authentication & Security (JWT + Bcrypt)
   - 4.2 Workspaces, Sessions & Room Management
   - 4.3 Multi-File Explorer & Disk-Database Synchronization
   - 4.4 Collaborative Monaco Code Editor & Private Lock Engine
   - 4.5 Interactive Terminal Engine (node-pty + xterm.js)
   - 4.6 Docker Execution Sandbox & Process Fallback
   - 4.7 Google Gemini AI Suite (Models, Fallbacks & Tools)
   - 4.8 WebRTC Video Conference (Google Meet Experience)
   - 4.9 Real-Time Collaborative Whiteboard
   - 4.10 Team Notes (Markdown & File Import)
   - 4.11 Collaborative Data Sheets / Spreadsheet (Formula Engine)
   - 4.12 GitHub Version Control (SimpleGit & PAT)
   - 4.13 Email Invitation System (Nodemailer + Gmail Protocol)
   - 4.14 Real-Time Team Chat
5. [Key Technical Inquiries: Gemini, Docker, Email & GitHub](#5-key-technical-inquiries-gemini-docker-email--github)
   - Why Google Gemini AI and Why this Model Architecture?
   - Why Docker and How Sandboxing Prevents Exploits?
   - How Email Invitations Actually Work Under the Hood?
   - How GitHub Integration Works Without Third-Party Plugins?
6. [Top 30 Examiner Viva Questions & Impressive Model Answers](#6-top-30-examiner-viva-questions--impressive-model-answers)
7. [Live Demo Presentation Checklist & Strategy](#7-live-demo-presentation-checklist--strategy)

---

## 1. EXECUTIVE PROJECT OVERVIEW

### What is NexForge?
NexForge is a **cloud-native, multi-tenant developer workspace** that integrates the core workflows of a modern engineering team into a single unified browser tab:
- **Code Authoring & Refactoring:** Collaborative Monaco editor with multi-cursor presence and private locking.
- **Execution & Runtime:** True interactive Linux/Windows pseudo-terminals (`node-pty`) and sandboxed Docker container runners.
- **Artificial Intelligence:** Integrated Google Gemini LLMs for contextual debugging, auto-fixing, automated code health audits, unit test generation, and intelligent spreadsheet dataset creation.
- **Communication & Ideation:** WebRTC peer-to-peer video meetings, vector whiteboard with real-time stroke streaming, and workspace chat.
- **Data & Project Management:** Real-time markdown team notes and an Excel-compatible spreadsheet with an arithmetic and statistical formula evaluation engine.
- **Source Control:** Direct GitHub Git repository synchronization, diffing, branching, and pushing.

---

## 2. END-TO-END SYSTEM ARCHITECTURE

```
                                  +------------------------------------+
                                  |         CLIENT BROWSER             |
                                  |  React 18 + Vite + TypeScript      |
                                  +------------------+-----------------+
                                                     |
                                   HTTPS REST API    |   WSS (WebSockets)
                                   (Axios JSON)      |   (Socket.IO v4)
                                                     v
                         +-----------------------------------------------+
                         |           EXPRESS + SOCKET.IO SERVER          |
                         |             Node.js Runtime / Render          |
                         +-------+-------------------+---------------+---+
                                 |                   |               |
               +-----------------+                   |               +-----------------+
               |                                     |                                 |
               v                                     v                                 v
+-----------------------------+       +-----------------------------+       +---------------------+
|    DATA PERSISTENCE LAYER   |       |    ISOLATED EXECUTION       |       |  EXTERNAL SERVICES  |
| - PostgreSQL Database       |       | - node-pty PTY processes    |       | - Google Gemini AI  |
| - Prisma ORM 5.18           |       | - Dockerode container pool  |       | - Nodemailer SMTP   |
| - Local Disk Workspaces     |       | - Process Sandbox fallback  |       | - Simple-Git GitHub |
|   (workspaces_storage/)     |       | - xterm.js ANSI streams     |       | - STUN WebRTC Mesh  |
+-----------------------------+       +-----------------------------+       +---------------------+
```

### Communication Flow:
1. **Stateless Operations (HTTP REST):** Authentication, workspace CRUD, initial note/sheet fetching, git status, and AI requests are routed through Express REST controllers protected by JWT authentication middleware (`server/src/middleware/auth.ts`).
2. **Stateful Operations (WebSockets):** File edits, cursor positions, whiteboard vectors, spreadsheet cell mutations, terminal I/O keystrokes, and WebRTC signaling pass through Socket.IO namespaces and rooms (`server/src/sockets/`).
3. **P2P Audio/Video (WebRTC):** Once signaling offers/answers and ICE candidates are exchanged over WebSockets, audio and video media streams travel directly peer-to-peer using STUN NAT traversal.

---

## 3. DATABASE ARCHITECTURE & SCHEMA (PRISMA ORM)

NexForge utilizes **Prisma ORM** connecting to a hosted **PostgreSQL** database. 

### Key Entities & Relations (`server/prisma/schema.prisma`):
- `User`: Handles identity, credentials (`passwordHash` hashed via `bcryptjs`), names, and avatars.
  - Relations: Owns multiple `Workspace`s (`@relation("OwnedWorkspaces")`); holds memberships across shared rooms (`WorkspaceMember[]`).
- `Workspace`: The core tenant container representing a collaborative room.
  - Fields: `id` (UUID), `name`, `language`, `ownerId`.
  - Cascading Relations (`onDelete: Cascade`): Deleting a workspace automatically cascades and removes its `File`s, `ChatMessage`s, `WhiteboardState`, `AISession`s, `Note`s, and `Spreadsheet`s without leaving orphaned records.
- `WorkspaceMember`: Association table mapping users to workspaces with granular permission roles (`owner`, `editor`, `viewer`).
- `File`: Stores workspace files in a nested hierarchy with parent-child pointers (`parentId` -> `children` self-relation) and tracks absolute paths (`@@unique([workspaceId, path])`).
- `ChatMessage`: Stores persistent conversation history for team chat.
- `WhiteboardState`: Stores canvas vector snapshots as serialized JSON (`dataJson`).
- `Note`: Stores markdown notes with full-text content.
- `Spreadsheet`: Stores 2D spreadsheet grids as serialized JSON matrix (`dataJson`).
- `AISession` & `AIMessage`: Stores historical conversation context and prompt metadata for AI pair-programming sessions.

---

## 4. FEATURE-BY-FEATURE DEEP DIVE & LOGIC WALKTHROUGH

### 4.1 Authentication & Security (JWT + Bcrypt)
- **Frontend File:** `client/src/components/Auth/AuthModal.tsx`, `client/src/context/AuthContext.tsx`
- **Backend File:** `server/src/routes/auth.routes.ts`, `server/src/middleware/auth.ts`
- **Implementation Logic:**
  1. **Password Hashing:** Passwords are never stored in plain text. When registering, `bcrypt.hash(password, 10)` generates a salted hash.
  2. **Token Generation:** Upon login, the server validates credentials with `bcrypt.compare()` and signs a JSON Web Token containing `{ userId: user.id, email: user.email }` using HMAC-SHA256 with a 7-day expiration.
  3. **Authorization Header:** The client stores the JWT in `localStorage` and automatically attaches `Authorization: Bearer <token>` to all HTTP requests via Axios interceptors (`client/src/api/client.ts`).
  4. **Route Protection:** Express middleware verifies the token signature. If invalid or expired, requests return HTTP 401 Unauthorized.

---

### 4.2 Workspaces, Sessions & Room Management
- **Frontend File:** `client/src/components/Session/SessionSetupPage.tsx`, `client/src/components/Header/ShareModal.tsx`
- **Backend File:** `server/src/routes/workspace.routes.ts`
- **Implementation Logic:**
  1. Users can create a workspace or join an existing workspace via unique URL room ID (`/room/:roomId` or `?room=id`).
  2. If an unauthenticated user joins via an invite link, the session setup automatically welcomes them, provisions a temporary or permanent collaborator profile, and joins the Socket.IO room `workspace:<workspaceId>`.
  3. **Role-Based Access Control (RBAC):** Users are checked against `WorkspaceMember`. Viewers are restricted from triggering file modifications, deletions, or terminal writes.

---

### 4.3 Multi-File Explorer & Disk-Database Synchronization
- **Frontend File:** `client/src/components/FileExplorer/FileTree.tsx`, `client/src/components/FileExplorer/NewItemModal.tsx`
- **Backend File:** `server/src/services/file.service.ts`, `server/src/routes/file.routes.ts`
- **Implementation Logic:**
  1. **Dual Storage Engine:** Files are stored in PostgreSQL (for fast queries, cloud backups, and metadata) and mirrored on physical server disk under `server/workspaces_storage/<workspaceId>/` (for native compilation, Git operations, and node-pty terminal execution).
  2. **File Tree Construction:** Flat database records with `parentId` and `path` are recursively transformed into an in-memory N-ary tree structure for the React file explorer sidebar.
  3. **Bi-directional Sync (`syncDiskToDb` / `syncDbToDisk`):** When files are edited in the terminal or pulled from Git, disk watchers re-synchronize the database state and broadcast `file:created`, `file:updated`, or `file:deleted` events to all connected clients.

---

### 4.4 Collaborative Monaco Code Editor & Private Lock Engine
- **Frontend File:** `client/src/components/Editor/MonacoEditorWrapper.tsx`, `client/src/components/Editor/FileTabs.tsx`
- **Backend File:** `server/src/sockets/collab.socket.ts`
- **Implementation Logic:**
  1. **Monaco Integration:** Uses `@monaco-editor/react` (the exact engine powering VS Code) with syntax highlighting, IntelliSense, code folding, and bracket matching across 50+ programming languages.
  2. **Multi-Cursor Presence:** 
     - When a user moves their cursor or highlights text, `presence:cursor` fires with `{ lineNumber, column, selection }`.
     - The server tracks active users in an in-memory `workspacePresenceMap` and broadcasts peer locations.
     - Peered clients render remote cursor widgets and CSS selection overlays using unique deterministic avatar colors (`getUserColor`).
  3. **Live Sync vs. Private Locking (Industry Innovation):**
     - **Shared Mode:** Keystrokes emit `editor:content-change` over WebSockets to synchronize text in real-time.
     - **Private Lock Mode:** To avoid code disruption during complex refactoring, a developer can click "Lock File".
     - The server registers the lock in `workspaceFileLocksMap`. Other collaborators see a banner indicating who is editing the file and are prevented from making conflicting edits.
     - Once finished, the developer clicks "Publish Changes", which atomically unlocks the file and broadcasts the authoritative version to all peers.

---

### 4.5 Interactive Terminal Engine (node-pty + xterm.js)
- **Frontend File:** `client/src/components/Terminal/TerminalPanel.tsx`
- **Backend File:** `server/src/services/pty.service.ts`, `server/src/sockets/pty.socket.ts`
- **Implementation Logic:**
  1. **True Pseudo-Terminal (PTY):** Unlike naive IDEs that merely execute shell commands via `child_process.exec`, NexForge spawns a genuine bidirectional pseudo-terminal using **`node-pty`** (`powershell.exe` on Windows or `/bin/bash` on Linux/Render).
  2. **Keystroke Streaming:** Raw terminal keystrokes (including arrow keys, `Tab` autocomplete, `Ctrl+C` SIGINT, and interactive REPL inputs like Python `input()` or bash prompts) travel via `terminal:write` directly into the PTY process input stream.
  3. **Xterm.js Rendering:** PTY ANSI escape codes, colors, and cursor movements are rendered in the browser using `@xterm/xterm` with `@xterm/addon-fit` and `@xterm/addon-web-links`.
  4. **Ring Buffer Persistence:** The server caches the latest 30,000 characters in an in-memory ring buffer. When a teammate joins or refreshes, the buffer is replayed instantly so the terminal state is never lost.
  5. **Standard Virtual Environment Workflow:** Supports standard virtual environment activation (`python -m venv venv`, `source venv/bin/activate` or `.\venv\Scripts\activate`) with standard prompt rendering.

---

### 4.6 Docker Execution Sandbox & Process Fallback
- **Frontend File:** `client/src/components/Terminal/ExecutionConsole.tsx`
- **Backend File:** `server/src/services/docker.service.ts`, `server/src/routes/execution.routes.ts`
- **Implementation Logic:**
  1. **One-Click Run:** When a user clicks "Run Code", the active file path and workspace ID are sent to `POST /api/execute`.
  2. **Language Auto-Detection:** The server analyzes file extensions (`.py` -> Python, `.ts`/`.js` -> Node.js, `.cpp` -> GCC, `.go` -> Go, `.rs` -> Rust).
  3. **Dual Execution Engine:**
     - **Primary (Docker):** If Docker daemon is reachable (`docker.ping()`), an ephemeral container is spun up (`python:3.10-alpine`, `node:18-alpine`, `gcc:latest`). The workspace directory is mounted as a read/write volume, restricted to 512MB RAM, without host networking.
     - **Fallback (Isolated Process Sandbox):** If Docker is unavailable (e.g. cloud PaaS environments like Render free tier), the system automatically executes inside a jailed child process with path boundaries and timeout guards.
  4. **Output Streaming:** `stdout` and `stderr` streams are piped in real-time to the Execution Console tab.

---

### 4.7 Google Gemini AI Suite (Models, Fallbacks & Tools)
- **Frontend Files:** `client/src/components/AI/AIChatPanel.tsx`, `AIDebuggerModal.tsx`, `AIExplainModal.tsx`, `AIReviewModal.tsx`, `AIGenTestsModal.tsx`, `AIRefactorModal.tsx`
- **Backend Files:** `server/src/services/ai.service.ts`, `server/src/routes/ai.routes.ts`
- **Implementation Logic:**
  1. **Full Suite of AI Tools:**
     - **AI Chat:** Context-aware assistant aware of the active file, cursor position, and recent terminal logs.
     - **AI Debugger:** Reads stack traces and errors, locates the faulty line, explains the root cause, and generates a one-click diff fix.
     - **AI Explain:** Analyzes selected code and outputs Overview, Step-by-Step walkthrough, and **Big-O Time & Space Complexity**.
     - **AI Code Review:** Evaluates code health with a score (0-100) and letter grade (A-F) across Bugs, Security, Performance, and Style.
     - **AI Test Generator:** Automatically writes comprehensive Jest/Mocha/PyTest unit tests with edge-case test suites.
     - **AI Sheet Generator:** Converts natural language prompts into structured JSON 2D tabular data for spreadsheets.
  2. **Model Selection & Architecture:** See Section 5 for the comprehensive breakdown of Gemini models and the resilient fallback waterfall.

---

### 4.8 WebRTC Video Conference (Google Meet Experience)
- **Frontend File:** `client/src/components/Video/GoogleMeetPanel.tsx`, `client/src/components/Video/VideoCallOverlay.tsx`
- **Backend File:** `server/src/sockets/video.socket.ts`
- **Implementation Logic:**
  1. **Full-Mesh WebRTC Topology:** Each participant creates an `RTCPeerConnection` with every other peer in the room, enabling zero-latency audio and video without needing an expensive media server.
  2. **Signaling Handshake via Socket.IO:**
     - User A joins -> Server emits `video:peer-joined` to Room.
     - User B creates an SDP Offer (`createOffer()`) -> Sends `video:offer` via server to User A.
     - User A receives offer, sets remote description, creates SDP Answer (`createAnswer()`) -> Sends `video:answer` back to User B.
     - Both peers exchange network ICE candidates (`video:ice-candidate`) via Google STUN servers (`stun:stun.l.google.com:19302`) to establish the direct P2P socket.
  3. **Dynamic Responsive Grid:** Supports 1 to 8+ simultaneous participants with dynamic CSS grid calculations (`1fr`, `repeat(2, 1fr)`, `repeat(3, 1fr)`), mute/unmute audio tracks, camera toggle, screen sharing via `navigator.mediaDevices.getDisplayMedia`, and avatar initials fallback.

---

### 4.9 Real-Time Collaborative Whiteboard
- **Frontend File:** `client/src/components/Whiteboard/WhiteboardCanvas.tsx`
- **Backend File:** `server/src/sockets/whiteboard.socket.ts`
- **Implementation Logic:**
  1. **Vector-Based Canvas Architecture:** Drawing is implemented via HTML5 Canvas 2D context using an array of mathematical geometric objects rather than a static bitmap.
  2. **Tools Supported:** Selection, Hand (infinite pan & zoom), Pen (freehand with smoothing), Highlighter (alpha transparency), Rectangle, Rounded Rect, Circle, Diamond (flowchart decisions), Database Cylinder, Line, Arrow, Sticky Notes, and Text.
  3. **Real-Time Sync:** On mouse drag/up, vector elements are broadcast via `whiteboard:draw` and `whiteboard:update`.
  4. **Peer Cursors:** Collaborators see live mouse pointer tags with teammate names moving across the canvas (`whiteboard:cursor`).
  5. **Persistence & Export:** The entire vector canvas state is serialized into PostgreSQL (`WhiteboardState.dataJson`) and can be exported as high-resolution PNG images.

---

### 4.10 Team Notes (Markdown & File Import)
- **Frontend File:** `client/src/components/Notes/NotesPanel.tsx`
- **Backend File:** `server/src/routes/note.routes.ts`, `server/src/sockets/notes.socket.ts`
- **Implementation Logic:**
  1. **Full Markdown Engine:** Real-time dual-mode editor (Edit mode & Live Render Preview mode) supporting headers, bullet lists, blockquotes, bold/italic, code blocks, and check-lists.
  2. **Debounced Auto-Save & WebSockets:** Keystrokes broadcast instantly via `notes:content-change` so teammates read notes as they are being drafted. Database persistence is debounced by 800ms to eliminate server strain.
  3. **File Import Engine:** An Import button beside `+ New` reads local `.md`, `.txt`, `.json`, `.log`, or `.csv` files using `FileReader.readAsText()`, parses the file title, saves it to the database, and broadcasts `notes:mutation` to the workspace.

---

### 4.11 Collaborative Data Sheets / Spreadsheet (Formula Engine)
- **Frontend File:** `client/src/components/Sheets/DataSheetsPanel.tsx`
- **Backend File:** `server/src/routes/sheet.routes.ts`
- **Implementation Logic:**
  1. **Tabular Matrix Engine:** Renders an interactive spreadsheet grid with row headers (1, 2, 3...) and column headers (A, B, C... AA, AB) with row/column insertion and deletion.
  2. **Custom Formula Evaluator:**
     - `=SUM(A1:A10)`: Calculates total values across arbitrary rectangular cell ranges.
     - `=AVERAGE(B1:B20)`: Calculates statistical means.
     - Dynamic Algebraic Expressions: Evaluates mathematical formulas like `=C2*D2` or `=A1+B1` by converting cell identifiers to zero-indexed matrix coordinates and safely executing arithmetic.
  3. **SheetJS (`xlsx`) File I/O:** Supports importing `.xlsx`, `.xls`, and `.csv` files directly into the active sheet, as well as exporting sheets to CSV.
  4. **AI Dataset Generator:** Clicking "AI Generate" queries Gemini (`promptType: 'generate_sheet'`) to synthesize realistic mock data (e.g. employee directories, financial ledgers, scientific samples) into table rows.

---

### 4.12 GitHub Version Control (SimpleGit & PAT)
- **Frontend File:** `client/src/components/Git/GitPanel.tsx`, `GitDiffModal.tsx`
- **Backend File:** `server/src/services/git.service.ts`, `server/src/routes/git.routes.ts`
- **Implementation Logic:**
  1. **Pure Git Operations via SimpleGit:** Operates directly on the workspace disk repository (`server/workspaces_storage/<id>`) using `simple-git`.
  2. **Core Operations:**
     - **Status:** Inspects staged, modified, unstaged, and untracked files.
     - **Stage / Unstage:** Runs `git add` and `git reset HEAD`.
     - **Commit:** Stages all changes and commits with author attribution. Supports AI-generated commit messages.
     - **Diff Modal:** Visual side-by-side or unified diff viewing using Git patch output.
  3. **Push & Pull with Authentication:**
     - Connects to remote origin repositories (`https://github.com/user/repo.git`).
     - Supports **GitHub Personal Access Tokens (PAT)** embedded in the HTTPS URL (`https://<TOKEN>@github.com/user/repo.git`) for private repository operations without needing SSH keys.
     - Intelligent Pull Engine automatically stashes dirty changes, sets `pull.rebase = false`, and prevents divergent branch aborts.

---

### 4.13 Email Invitation System (Nodemailer + Gmail Protocol)
- **Frontend File:** `client/src/components/Header/ShareModal.tsx`
- **Backend File:** `server/src/services/email.service.ts`
- **Implementation Logic:**
  1. **Dual Invitation Pathway:**
     - **Automated Backend Delivery (Nodemailer):** Transports responsive HTML invitation emails with branded gradients, direct join buttons, role badges, and workspace room links via SMTP / Gmail App Passwords.
     - **Direct Client-Side Gmail Integration:** For zero-setup environments, clicking "Send via Gmail" generates an authenticated Gmail compose web intent (`https://mail.google.com/mail/?view=cm&fs=1&to=...&su=...&body=...`) so users can dispatch invitations directly from their personal email inbox with one click.

---

### 4.14 Real-Time Team Chat
- **Frontend File:** `client/src/components/TeamChat/ChatPanel.tsx`
- **Backend File:** `server/src/sockets/chat.socket.ts`
- **Implementation Logic:**
  1. Real-time message exchange over Socket.IO room `chat:<workspaceId>`.
  2. Persistent storage in PostgreSQL (`ChatMessage` table) so message history loads automatically when teammates log in.
  3. Visual indicators for sender identities, timestamps, and active typing statuses (`chat:typing`).

---

## 5. KEY TECHNICAL INQUIRIES: GEMINI, DOCKER, EMAIL & GITHUB

### Q1: Which Google Gemini Model is used, and WHY that model only?
**Answer for Examiner:**
"In NexForge, we utilize the **Google Gemini Generative AI SDK (`@google/generative-ai`)** with a primary emphasis on the **Gemini Flash family (`gemini-2.0-flash` / `gemini-1.5-flash` / `gemini-flash-latest`)**, backed by a resilient **model fallback waterfall**:

1. **Why Gemini Flash?**
   - **Ultra-Low Latency (<1.5s response):** Developers need real-time assistance. Gemini Flash delivers near-instant response speeds essential for interactive debugging and code completion.
   - **Massive 1M+ Token Context Window:** Traditional models (like GPT-3.5 with 4k/8k tokens) fail when attempting to process multi-file projects. Gemini's million-token window allows NexForge to send the full active source file, referenced dependencies, terminal error stack traces, and Git diffs simultaneously in a single prompt.
   - **Superior Code Reasoning:** Gemini is natively multimodal and fine-tuned for software engineering benchmarks, excelling at syntax error detection, edge-case analysis, and algorithm complexity estimation.

2. **Why the Resilient Fallback Waterfall?**
   - In cloud APIs, individual models can experience temporary regional quota exhaustion (HTTP 429 Rate Limits) or version transitions.
   - NexForge implements an automated fallback chain in `server/src/services/ai.service.ts`:
     `gemini-flash-latest` ➡️ `gemini-2.0-flash` ➡️ `gemini-1.5-flash` ➡️ `gemma-4-26b` ➡️ `gemini-2.5-pro` ➡️ `Static Analysis Heuristic Engine`.
   - If any model returns a rate-limit error, the server seamlessly tries the next available model without interrupting the user's workflow."

---

### Q2: Why is Docker used, and what happens if Docker isn't installed?
**Answer for Examiner:**
"Docker is the industry gold standard for **sandboxed code execution** in web-based IDEs like GitHub Codespaces, Replit, and NexForge:
1. **Security Isolation:** Executing arbitrary user code directly on the host server is a massive security hazard. A user could run malicious scripts (`rm -rf /` or inspect `.env` files). Docker runs code in an isolated container with an isolated filesystem.
2. **Resource Boundaries:** Each Docker container is capped at **512MB RAM**, limited CPU shares, and a 15-second execution timeout, preventing infinite loops or fork bombs from starving the host server.
3. **No Network Access:** Containers run with `--network none` during student code runs, preventing malicious outbound botnet or DDoS activities.
4. **Graceful Degradation (Process Sandbox Fallback):**
   - In `server/src/services/docker.service.ts`, the server pings the Docker daemon on boot (`docker.ping()`).
   - If Docker is running (e.g., local development with Docker Desktop or a production VPS), it uses container sandboxing.
   - If Docker is absent (e.g., lightweight free cloud hosting like Render), NexForge automatically falls back to an **isolated child-process sandbox** (`spawn`) with sanitized working directories and process kill timers. This guarantees that code execution works in any deployment environment."

---

### Q3: How is Email sent, and why provide two methods?
**Answer for Examiner:**
"Email invitations in NexForge are implemented with a **dual-architecture approach**:
1. **Backend SMTP via Nodemailer (`server/src/services/email.service.ts`):** 
   - Uses an authenticated SMTP transport (configured for Gmail with secure 16-character App Passwords).
   - Generates a branded, responsive HTML template containing the workspace name, inviter details, permission level (`Editor`/`Viewer`), and a cryptographic direct room entry link.
2. **Direct Client-Side Web Intent (`client/src/components/Header/ShareModal.tsx`):**
   - If an administrator has not configured SMTP credentials, users can click **'Send via Gmail'**.
   - This opens the official Google Mail web interface with recipient, subject, and room link pre-populated via URI encoding (`mailto` / Gmail URL parameters). The user clicks send directly from their authenticated personal Gmail account with 100% deliverability."

---

### Q4: How is the GitHub feature implemented without heavy third-party plugins?
**Answer for Examiner:**
"Rather than relying on proprietary GitHub apps or third-party cloud intermediaries, NexForge implements Git version control natively on the server filesystem using **`simple-git`**:
1. **Physical Git Repositories:** Each workspace folder in `server/workspaces_storage/<workspaceId>` is initialized as a true, standard Git repository (`git.init()`).
2. **Standard Git Commands:** Our `GitService` executes standard Git binary operations:
   - `git status` ➡️ Analyzes staged, unstaged, and untracked files.
   - `git add` & `git commit` ➡️ Records snapshots with custom commit messages.
   - `git diff` ➡️ Computes line-by-line patch chunks for the visual Git Diff modal.
3. **Authentication via Personal Access Tokens (PAT):**
   - For `git push` and `git pull` with private GitHub repositories, HTTPS authentication is injected securely via the URL pattern: `https://<TOKEN>@github.com/<owner>/<repo>.git`.
   - Before pulling, the system safely stashes local modifications and configures `pull.rebase = false` to eliminate merge conflicts and branch divergence errors."

---

## 6. TOP 30 EXAMINER VIVA QUESTIONS & IMPRESSIVE MODEL ANSWERS

#### Q1: What happens if two developers edit the same line of code simultaneously?
**Answer:** "NexForge handles concurrent edits through a two-tiered strategy:
1. **Real-time broadcast:** Character changes emit instantly over WebSockets with sender IDs to avoid feedback echo loops.
2. **Private File Locking:** For extensive changes, developers can acquire an exclusive file lock. Other collaborators see an indicator that the file is locked, preventing concurrent edit collisions until the developer clicks 'Publish Changes'."

#### Q2: How does the video call work without a high-bandwidth media server?
**Answer:** "We use a **WebRTC Full-Mesh Peer-to-Peer topology**. Socket.IO is only used as a lightweight signaling server to exchange SDP offers, SDP answers, and ICE network candidates. Once the direct peer connection is negotiated via Google's public STUN servers, audio/video data packets travel directly between user browsers, requiring near-zero server CPU and bandwidth."

#### Q3: How do you prevent infinite loops in the terminal or code runner from crashing the server?
**Answer:** "In the Docker runner, containers are assigned explicit CPU shares, memory limits (512MB), and execution timeout kill timers (15 seconds). In the interactive PTY terminal, the child process runs with operating system kill signal listeners (`SIGINT` on `Ctrl+C` and `SIGKILL` on session disconnect), ensuring processes are terminated when abandoned."

#### Q4: Why did you choose PostgreSQL over MongoDB for NexForge?
**Answer:** "NexForge's data model is fundamentally relational. Workspaces belong to Users; Files belong to Workspaces and have parent-child folder hierarchies; Notes, Spreadsheets, and Chat messages all strictly belong to specific Workspaces. PostgreSQL with Prisma ORM provides foreign key constraints, ACID compliance, and cascading deletes (`onDelete: Cascade`), ensuring zero orphaned files or orphan chat records."

#### Q5: How does the custom spreadsheet formula engine evaluate `=SUM(A1:B5)`?
**Answer:** "In `client/src/components/Sheets/DataSheetsPanel.tsx`:
1. It detects strings starting with `=`.
2. It parses the formula identifier (`SUM`, `AVERAGE`) and regex-extracts the bounding cell coordinates (`A1` to `B5`).
3. It converts column characters (`A` ➡️ 0, `B` ➡️ 1) and row numbers (`1` ➡️ index 0) into 2D array coordinates.
4. It iterates over the coordinate matrix, parses numeric values while ignoring blanks, and returns the accumulated total or statistical mean."

#### Q6: How does the AI Debugger know what went wrong in the code?
**Answer:** "The AI Debugger collects contextual telemetry: the active file path, the source code in the editor, and the recent error logs or stack traces captured from the terminal console. It combines these into a structured prompt sent to Gemini, instructing it to identify the faulty line number, explain the root cause, and provide a corrected replacement block."

#### Q7: What is `node-pty`, and how is it different from `child_process.exec`?
**Answer:** "`child_process.exec` buffers output and only returns after a command finishes; it has no concept of an interactive TTY terminal. `node-pty` forks a true pseudo-terminal process with terminal emulation features (window size, cursor positioning, ANSI escape codes, colored text, interactive input prompts). This is what enables tools like `nano`, Python interactive shell, and `npm install` progress bars to render inside NexForge."

#### Q8: How is state synchronized when a new user joins an ongoing whiteboard session?
**Answer:** "When a user joins, the client requests the latest whiteboard state. The server queries the `WhiteboardState` table in PostgreSQL and returns the serialized JSON array of vector elements (`whiteboard:load-state`). The client renders the vectors onto its local HTML5 canvas."

#### Q9: How do you handle password security?
**Answer:** "We use `bcryptjs` with a salt round factor of 10. Passwords are never stored in plain text. Even if the database were compromised, the salted one-way hash cannot be reversed."

#### Q10: How do you handle Cross-Origin Resource Sharing (CORS)?
**Answer:** "Express and Socket.IO servers are configured with dynamic CORS origins accepting requests from the frontend client domain (e.g. `localhost:5173` in development or the production Vercel URL), allowing credentials, headers (`Authorization`, `Content-Type`), and HTTP methods (`GET`, `POST`, `PUT`, `DELETE`)."

#### Q11: What is the purpose of the `.gitignore` created by GitService?
**Answer:** "When `GitService.initRepo()` runs, it automatically writes a default `.gitignore` containing `node_modules/`, `*.log`, `.env`, and `dist/`. This prevents sensitive configuration files and large dependency trees from being accidentally committed."

#### Q12: How are files organized on disk inside the server?
**Answer:** "Under `server/workspaces_storage/<workspaceId>/`. Each workspace has its own isolated directory named after its UUID, ensuring complete filesystem separation between different teams."

#### Q13: How does the Xterm.js terminal adapt to different screen sizes?
**Answer:** "We use `@xterm/addon-fit`. On window resize or panel drag, the fit addon calculates the available DOM width and height in pixels, determines the character column and row capacity, and sends a `terminal:resize` socket event to resize the server-side PTY process accordingly."

#### Q14: How does the Import File feature in Team Notes work?
**Answer:** "It uses the HTML5 `FileReader` API. When a user selects a file (`.md`, `.txt`, `.json`), `readAsText()` reads the character stream. The frontend strips the file extension to generate the note title, populates the body, saves it to PostgreSQL via `POST /api/workspaces/:id/notes`, and broadcasts `notes:mutation` to all active workspace participants."

#### Q15: How does the spreadsheet handle Excel (.xlsx) files?
**Answer:** "We use SheetJS (`xlsx`). For import, the file is read as an `ArrayBuffer` via `FileReader`, parsed using `XLSX.read()`, and the primary worksheet is converted into a 2D JSON array (`XLSX.utils.sheet_to_json({ header: 1 })`). For export, the 2D array is converted back to an Excel sheet or CSV string."

#### Q16: What happens if Gemini API key runs out of quota?
**Answer:** "The server handles HTTP 429 quota errors by cycling through fallback models. If all external API calls fail, the server triggers a built-in heuristic mock generator (`generateMockAIResponse`), returning a formatted static code analysis message so the user's workflow is never interrupted."

#### Q17: How does WebRTC punch through NATs and firewalls?
**Answer:** "Using **STUN (Session Traversal Utilities for NAT)** servers (`stun:stun.l.google.com:19302`). STUN allows each peer to discover its public IP address and port mapping, which are then exchanged as ICE candidates."

#### Q18: What is the role of Prisma Client?
**Answer:** "Prisma Client is an auto-generated, type-safe database client. It provides compile-time TypeScript type verification for all database queries, eliminating SQL injection vulnerabilities and runtime schema mismatch bugs."

#### Q19: How are chat messages persisted and ordered?
**Answer:** "Chat messages are written to the `ChatMessage` table in PostgreSQL with timestamps (`createdAt: DateTime @default(now())`). When a user enters a room, messages are fetched ordered by `createdAt ASC`."

#### Q20: How do you prevent unauthorized users from editing files?
**Answer:** "The server checks the user's role in `WorkspaceMember`. If the user has a `viewer` role, the server rejects file mutation REST requests with HTTP 403 Forbidden and drops `editor:content-change` socket events."

#### Q21: What is the difference between WebSockets and HTTP in your project?
**Answer:** "HTTP is a stateless, request-response protocol ideal for CRUD operations (login, fetching file lists, creating workspaces). WebSockets provide a persistent, full-duplex TCP connection with low latency overhead, essential for live collaborative code typing, cursor movements, and terminal streaming."

#### Q22: How does the AI Code Review grade code?
**Answer:** "The Gemini prompt instructs the LLM to inspect the active file across four specific criteria: Bugs & Logic risks, Security vulnerabilities, Performance bottlenecks, and Code Style. It synthesizes these into a numeric health score (0-100) and letter grade (A through F)."

#### Q23: Why do we need `pull.rebase = false` in GitService?
**Answer:** "In Git version 2.27+, pulling without specifying a reconciliation strategy fails if branches have diverged. Setting `pull.rebase = false` enforces standard merge commit reconciliation, ensuring pulls complete smoothly in automated IDE environments."

#### Q24: What is the role of Monaco Editor Wrapper?
**Answer:** "It encapsulates the Monaco editor instance, managing theme switching (dark/light), font scaling, language mode mapping based on file extensions, remote cursor decorations, and debounced change event handlers."

#### Q25: How are temporary and guest users handled?
**Answer:** "When an unauthenticated user joins via a shared room link, the setup modal assigns them a guest collaborator identity and generates a session token so they can participate in chat, whiteboard, and code review immediately."

#### Q26: Can NexForge run Python code that imports third-party libraries?
**Answer:** "Yes. In the interactive PTY terminal, users can run `pip install <package>` or create a virtual environment (`python -m venv venv`), which installs packages locally into the workspace disk directory."

#### Q27: How does screen sharing work in the video panel?
**Answer:** "It invokes `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`. The resulting screen video track replaces the webcam video track in the active `RTCPeerConnection` via `sender.replaceTrack()`."

#### Q28: How do you prevent XSS attacks in the Team Notes markdown preview?
**Answer:** "The custom markdown renderer does not use unsafe `dangerouslySetInnerHTML`. Instead, it parses markdown syntax line-by-line into native React JSX elements (`<h1>`, `<p>`, `<li>`, `<blockquote>`), ensuring that any raw `<script>` tags are rendered as plain text."

#### Q29: How does the server clean up resources when a user disconnects?
**Answer:** "Socket.IO `disconnect` listeners clean up user presence entries from `workspacePresenceMap`, release any active file locks held by the disconnected socket ID, remove the peer from video rooms, terminate unneeded PTY streams, and broadcast updated presence counts to remaining teammates."

#### Q30: What is the ultimate value proposition of NexForge?
**Answer:** "NexForge eliminates context switching for software engineering teams. Instead of juggling separate windows for VS Code, Zoom, Google Docs, Excel, Postman, and GitHub, NexForge integrates the entire development lifecycle into a single collaborative cloud environment."

---

## 7. LIVE DEMO PRESENTATION CHECKLIST & STRATEGY

### Suggested 5-Minute Presentation Flow:
1. **Minute 1 — Introduction & Authentication:**
   - Log in, highlight JWT authentication and customizable user avatar.
   - Show workspace dashboard and create a new project room.
2. **Minute 2 — Code Collaboration & Terminal:**
   - Open a multi-file project. Open the interactive terminal.
   - Run a Python or Node.js script. Highlight the PTY execution and interactive prompt.
3. **Minute 3 — Gemini AI Suite:**
   - Open a code file with an intentional bug.
   - Click **AI Debugger**: Show root cause analysis and the instant fix.
   - Click **AI Code Review**: Show the health score, security audit, and complexity breakdown.
4. **Minute 4 — WebRTC Video & Whiteboard:**
   - Open the **Google Meet Video Panel** and **Whiteboard Canvas**.
   - Demonstrate vector drawing, peer cursors, and audio/video controls.
5. **Minute 5 — Team Notes & Spreadsheet:**
   - Open **Team Notes**: Show Markdown preview and import a file.
   - Open **Data Sheets**: Show `=SUM()` formula evaluation and the AI dataset generator.
   - Conclude with architecture summary (Docker, WebSockets, PostgreSQL, Gemini).

---
*Good luck with your presentation and defense! You have an industry-grade, feature-complete platform.*
