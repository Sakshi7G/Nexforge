import { Server, Socket } from 'socket.io';
import { PTYService } from '../services/pty.service';

export function setupPTYSockets(io: Server, socket: Socket) {
  // Start or join SHARED PTY session for workspace
  socket.on('pty:init', ({ workspaceId, workspaceName }: { workspaceId: string; workspaceName?: string }) => {
    const sessionId = workspaceId || 'default_pty';
    (socket as any).ptyWorkspaceId = sessionId;
    socket.join(`pty:${sessionId}`);

    console.log(`[PTYSocket] 🟢 pty:init received! Socket: ${socket.id}, Session: ${sessionId}, WorkspaceName: ${workspaceName}`);

    // Re-attach or create session without creating duplicate broadcasters
    PTYService.getOrCreateSession(
      sessionId,
      workspaceId,
      workspaceName || 'demo',
      (data) => {
        io.to(`pty:${sessionId}`).emit('pty:data', { data });
      },
      false
    );
  });

  // Receive terminal input for SHARED terminal from frontend Xterm.js
  socket.on('pty:input', ({ workspaceId, input }: { workspaceId?: string; input: string }) => {
    const sessionId = workspaceId || (socket as any).ptyWorkspaceId || 'default_pty';
    PTYService.writeInput(
      sessionId,
      input,
      workspaceId,
      undefined,
      (data) => {
        io.to(`pty:${sessionId}`).emit('pty:data', { data });
      },
      false
    );

    // If a command was submitted (Enter pressed), notify workspace to re-scan file tree for newly created files/folders/venv
    if (input && (input.includes('\r') || input.includes('\n'))) {
      setTimeout(() => {
        io.to(`workspace:${sessionId}`).emit('filetree:mutation');
      }, 2000);
    }
  });

  // Start or join PRIVATE PTY session isolated strictly to this user
  socket.on('pty:private:init', ({ workspaceId, workspaceName, userId }: { workspaceId: string; workspaceName?: string; userId?: string }) => {
    const cleanUserId = (userId || (socket as any).userId || socket.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const sessionId = `${workspaceId || 'default'}_private_${cleanUserId}`;
    (socket as any).ptyPrivateSessionId = sessionId;
    socket.join(`pty:${sessionId}`);

    console.log(`[PTYSocket] 🔒 pty:private:init received! Socket: ${socket.id}, Private Session: ${sessionId}`);

    PTYService.getOrCreateSession(
      sessionId,
      workspaceId,
      workspaceName || 'demo',
      (data) => {
        io.to(`pty:${sessionId}`).emit('pty:private:data', { data });
      },
      true
    );
  });

  // Receive terminal input for PRIVATE terminal
  socket.on('pty:private:input', ({ workspaceId, userId, input }: { workspaceId?: string; userId?: string; input: string }) => {
    const cleanUserId = (userId || (socket as any).userId || socket.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const sessionId = `${workspaceId || 'default'}_private_${cleanUserId}`;
    PTYService.writeInput(
      sessionId,
      input,
      workspaceId,
      undefined,
      (data) => {
        io.to(`pty:${sessionId}`).emit('pty:private:data', { data });
      },
      true
    );

    // Notify user to re-scan file tree if needed
    if (input && (input.includes('\r') || input.includes('\n'))) {
      setTimeout(() => {
        socket.emit('filetree:mutation');
      }, 2000);
    }
  });

  // Handle socket disconnect - leave rooms
  socket.on('disconnect', () => {
    const sessionId = (socket as any).ptyWorkspaceId;
    if (sessionId) {
      socket.leave(`pty:${sessionId}`);
    }
    const privateSessionId = (socket as any).ptyPrivateSessionId;
    if (privateSessionId) {
      socket.leave(`pty:${privateSessionId}`);
    }
  });
}
