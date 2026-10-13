import { Server, Socket } from 'socket.io';

interface UserPresence {
  userId: string;
  userName: string;
  userAvatar?: string;
  activeFilePath?: string;
  color: string;
  cursor?: { lineNumber: number; column: number };
  selection?: any;
}

interface FileLock {
  socketId: string;
  userId: string;
  userName: string;
  filePath: string;
  lockedAt: string;
}

const userColors = ['#f43f5e', '#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899'];
const workspacePresenceMap: Map<string, Map<string, UserPresence>> = new Map();
const workspaceFileLocksMap: Map<string, Map<string, FileLock>> = new Map();

function getUserColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return userColors[Math.abs(hash) % userColors.length];
}

function getLocksArray(workspaceId: string): FileLock[] {
  const locksMap = workspaceFileLocksMap.get(workspaceId);
  return locksMap ? Array.from(locksMap.values()) : [];
}

export function setupCollabSockets(io: Server, socket: Socket) {
  // Join workspace room
  socket.on('workspace:join', ({ workspaceId, userId, userName, userAvatar }) => {
    socket.join(`workspace:${workspaceId}`);
    
    let roomPresence = workspacePresenceMap.get(workspaceId);
    if (!roomPresence) {
      roomPresence = new Map();
      workspacePresenceMap.set(workspaceId, roomPresence);
    }

    const assignedColor = getUserColor(userId || userName || socket.id);

    const userState: UserPresence = {
      userId,
      userName: userName || 'Collaborator',
      userAvatar,
      color: assignedColor
    };

    roomPresence.set(socket.id, userState);
    (socket as any).workspaceId = workspaceId;
    (socket as any).userId = userId;
    (socket as any).userName = userName || 'Collaborator';

    // Broadcast updated presence list & current file locks to the room
    io.to(`workspace:${workspaceId}`).emit('presence:update', Array.from(roomPresence.values()));
    socket.emit('file:lock-status', getLocksArray(workspaceId));
  });

const normalizePath = (p: string | null | undefined): string => {
  if (!p) return '';
  return p.replace(/\\/g, '/').replace(/^\/+/, '').trim().toLowerCase();
};

  // Private Edit: Lock File
  socket.on('file:lock-private', ({ workspaceId, filePath, userId, userName }) => {
    let roomLocks = workspaceFileLocksMap.get(workspaceId);
    if (!roomLocks) {
      roomLocks = new Map();
      workspaceFileLocksMap.set(workspaceId, roomLocks);
    }

    const normKey = normalizePath(filePath);
    const existingLock = roomLocks.get(normKey);
    // If not locked or locked by current socket, assign lock
    if (!existingLock || existingLock.socketId === socket.id) {
      roomLocks.set(normKey, {
        socketId: socket.id,
        userId: userId || (socket as any).userId || 'unknown',
        userName: userName || (socket as any).userName || 'Collaborator',
        filePath,
        lockedAt: new Date().toISOString()
      });

      io.to(`workspace:${workspaceId}`).emit('file:lock-status', getLocksArray(workspaceId));
    }
  });

  // Private Edit: Unlock File
  socket.on('file:unlock-private', ({ workspaceId, filePath, userId }: { workspaceId: string; filePath: string; userId?: string }) => {
    const roomLocks = workspaceFileLocksMap.get(workspaceId);
    if (roomLocks) {
      const normKey = normalizePath(filePath);
      const existingLock = roomLocks.get(normKey);
      if (existingLock && (existingLock.socketId === socket.id || (userId && existingLock.userId === userId))) {
        roomLocks.delete(normKey);
        if (roomLocks.size === 0) {
          workspaceFileLocksMap.delete(workspaceId);
        }
        io.to(`workspace:${workspaceId}`).emit('file:lock-status', getLocksArray(workspaceId));
      }
    }
  });

  // Private Edit: Publish Changes to Room
  socket.on('file:publish-private', ({ workspaceId, filePath, content }) => {
    // 1. Release lock for this file
    const roomLocks = workspaceFileLocksMap.get(workspaceId);
    if (roomLocks) {
      const normKey = normalizePath(filePath);
      roomLocks.delete(normKey);
      if (roomLocks.size === 0) {
        workspaceFileLocksMap.delete(workspaceId);
      }
      io.to(`workspace:${workspaceId}`).emit('file:lock-status', getLocksArray(workspaceId));
    }

    // 2. Broadcast published content to all collaborators in the workspace
    io.to(`workspace:${workspaceId}`).emit('editor:content-change', {
      filePath,
      content,
      senderId: socket.id,
      userId: (socket as any).userId,
      isPublish: true
    });
  });

  // Switch active file
  socket.on('presence:active-file', ({ workspaceId, filePath }) => {
    const roomPresence = workspacePresenceMap.get(workspaceId);
    if (roomPresence && roomPresence.has(socket.id)) {
      const userState = roomPresence.get(socket.id)!;
      userState.activeFilePath = filePath;
      io.to(`workspace:${workspaceId}`).emit('presence:update', Array.from(roomPresence.values()));
    }
  });

  // Editor content change (CRDT / real-time text sync)
  socket.on('editor:content-change', ({ workspaceId, filePath, content, changes, origin, isPublish }) => {
    const roomLocks = workspaceFileLocksMap.get(workspaceId);
    const normKey = normalizePath(filePath);
    const fileLock = roomLocks?.get(normKey);

    // If file is privately locked by ANY user and not an explicit publish, SUPPRESS broadcast to peers
    if (fileLock && !isPublish) {
      return;
    }

    // Otherwise broadcast real-time edits to peers
    socket.to(`workspace:${workspaceId}`).emit('editor:content-change', {
      filePath,
      content,
      changes,
      senderId: socket.id,
      userId: (socket as any).userId,
      isPublish
    });
  });

  // Cursor & selection movement
  socket.on('editor:cursor-move', ({ workspaceId, filePath, userId, userName, cursor, selection }) => {
    const roomLocks = workspaceFileLocksMap.get(workspaceId);
    const normKey = normalizePath(filePath);
    const fileLock = roomLocks?.get(normKey);

    // If file is privately locked by this sender, DO NOT leak cursor movement to peers
    if (fileLock && (fileLock.socketId === socket.id || (userId && fileLock.userId === userId))) {
      return;
    }

    const roomPresence = workspacePresenceMap.get(workspaceId);
    const userState = roomPresence?.get(socket.id);
    const resolvedUserId = userId || userState?.userId;
    const resolvedUserName = userName || userState?.userName || 'Teammate';
    const color = userState?.color || '#3b82f6';

    socket.to(`workspace:${workspaceId}`).emit('editor:cursor-move', {
      socketId: socket.id,
      userId: resolvedUserId,
      userName: resolvedUserName,
      color,
      filePath,
      cursor,
      selection
    });
  });

  // Live file tree mutation broadcast
  socket.on('filetree:mutation', ({ workspaceId, action, file }) => {
    socket.to(`workspace:${workspaceId}`).emit('filetree:mutation', { action, file });
  });

  // Code execution result broadcast to room
  socket.on('code:executed', ({ workspaceId, stdout, stderr, exitCode, language, filePath, runnerName }) => {
    const roomLocks = workspaceFileLocksMap.get(workspaceId);
    const normKey = normalizePath(filePath);
    const fileLock = roomLocks?.get(normKey);

    // If file being executed is privately locked by this sender, DO NOT broadcast execution output to peers
    if (fileLock && (fileLock.socketId === socket.id || ((socket as any).userId && fileLock.userId === (socket as any).userId))) {
      return;
    }

    socket.to(`workspace:${workspaceId}`).emit('code:executed', {
      stdout,
      stderr,
      exitCode,
      language,
      filePath,
      runnerName
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const workspaceId = (socket as any).workspaceId;
    if (workspaceId) {
      // Clean up presence
      if (workspacePresenceMap.has(workspaceId)) {
        const roomPresence = workspacePresenceMap.get(workspaceId)!;
        roomPresence.delete(socket.id);
        if (roomPresence.size === 0) {
          workspacePresenceMap.delete(workspaceId);
        } else {
          io.to(`workspace:${workspaceId}`).emit('presence:update', Array.from(roomPresence.values()));
        }
      }

      // Clean up any file locks held by this disconnecting socket
      if (workspaceFileLocksMap.has(workspaceId)) {
        const roomLocks = workspaceFileLocksMap.get(workspaceId)!;
        let locksChanged = false;
        for (const [filePath, lock] of roomLocks.entries()) {
          if (lock.socketId === socket.id) {
            roomLocks.delete(filePath);
            locksChanged = true;
          }
        }
        if (roomLocks.size === 0) {
          workspaceFileLocksMap.delete(workspaceId);
        }
        if (locksChanged) {
          io.to(`workspace:${workspaceId}`).emit('file:lock-status', getLocksArray(workspaceId));
        }
      }
    }
  });
}
