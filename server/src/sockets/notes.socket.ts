import { Server, Socket } from 'socket.io';

interface NoteViewer {
  socketId: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  color?: string;
}

const noteViewersMap: Map<string, Map<string, NoteViewer>> = new Map();

export function setupNotesSockets(io: Server, socket: Socket) {
  // Join a specific note room and track active co-authors / viewers
  socket.on('notes:join-note', ({ workspaceId, noteId, userId, userName, userAvatar, color }) => {
    socket.join(`note:${noteId}`);
    (socket as any).activeNoteId = noteId;

    let viewers = noteViewersMap.get(noteId);
    if (!viewers) {
      viewers = new Map();
      noteViewersMap.set(noteId, viewers);
    }

    viewers.set(socket.id, {
      socketId: socket.id,
      userId,
      userName: userName || 'Teammate',
      userAvatar,
      color: color || '#6366f1'
    });

    // Broadcast updated active viewers list for this note
    io.to(`note:${noteId}`).emit('notes:viewers-update', {
      noteId,
      viewers: Array.from(viewers.values())
    });
  });

  // Leave note room
  socket.on('notes:leave-note', ({ noteId }) => {
    const activeNoteId = noteId || (socket as any).activeNoteId;
    if (activeNoteId) {
      socket.leave(`note:${activeNoteId}`);
      delete (socket as any).activeNoteId;

      const viewers = noteViewersMap.get(activeNoteId);
      if (viewers) {
        viewers.delete(socket.id);
        if (viewers.size === 0) {
          noteViewersMap.delete(activeNoteId);
        } else {
          io.to(`note:${activeNoteId}`).emit('notes:viewers-update', {
            noteId: activeNoteId,
            viewers: Array.from(viewers.values())
          });
        }
      }
    }
  });

  // Real-time co-authoring text sync
  socket.on('notes:content-change', ({ workspaceId, noteId, content }) => {
    socket.to(`note:${noteId}`).emit('notes:content-change', {
      noteId,
      content,
      senderSocketId: socket.id
    });
  });

  // Real-time title rename
  socket.on('notes:title-change', ({ workspaceId, noteId, title }) => {
    socket.to(`workspace:${workspaceId}`).emit('notes:title-change', {
      noteId,
      title
    });
  });

  // Real-time note creation / deletion mutation broadcast to workspace room
  socket.on('notes:mutation', ({ workspaceId, action, note }) => {
    socket.to(`workspace:${workspaceId}`).emit('notes:mutation', {
      action,
      note
    });
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    const activeNoteId = (socket as any).activeNoteId;
    if (activeNoteId && noteViewersMap.has(activeNoteId)) {
      const viewers = noteViewersMap.get(activeNoteId)!;
      viewers.delete(socket.id);
      if (viewers.size === 0) {
        noteViewersMap.delete(activeNoteId);
      } else {
        io.to(`note:${activeNoteId}`).emit('notes:viewers-update', {
          noteId: activeNoteId,
          viewers: Array.from(viewers.values())
        });
      }
    }
  });
}
