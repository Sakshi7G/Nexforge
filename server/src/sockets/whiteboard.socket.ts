import { Server, Socket } from 'socket.io';
import { prisma } from '../db/client';

export function setupWhiteboardSockets(io: Server, socket: Socket) {
  // Join whiteboard room and fetch initial state
  socket.on('whiteboard:join', async ({ workspaceId }) => {
    socket.join(`whiteboard:${workspaceId}`);

    try {
      const state = await prisma.whiteboardState.findUnique({
        where: { workspaceId }
      });
      if (state && state.dataJson) {
        socket.emit('whiteboard:state', JSON.parse(state.dataJson));
      }
    } catch (err) {
      console.error('[Whiteboard Load Error]', err);
    }
  });

  // Broadcast drawing stroke
  socket.on('whiteboard:draw', ({ workspaceId, stroke }) => {
    socket.to(`whiteboard:${workspaceId}`).emit('whiteboard:draw', stroke);
  });

  // Save complete canvas JSON state
  socket.on('whiteboard:save', async ({ workspaceId, dataJson }) => {
    try {
      await prisma.whiteboardState.upsert({
        where: { workspaceId },
        update: { dataJson: JSON.stringify(dataJson) },
        create: { workspaceId, dataJson: JSON.stringify(dataJson) }
      });

      socket.to(`whiteboard:${workspaceId}`).emit('whiteboard:state', dataJson);
    } catch (err) {
      console.error('[Whiteboard Save Error]', err);
    }
  });

  // Clear canvas
  socket.on('whiteboard:clear', async ({ workspaceId }) => {
    try {
      await prisma.whiteboardState.deleteMany({ where: { workspaceId } });
      io.to(`whiteboard:${workspaceId}`).emit('whiteboard:clear');
    } catch (err) {
      console.error('[Whiteboard Clear Error]', err);
    }
  });

  // Broadcast live multiplayer cursor coordinates
  socket.on('whiteboard:cursor', ({ workspaceId, cursor }) => {
    socket.to(`whiteboard:${workspaceId}`).emit('whiteboard:cursor', {
      socketId: socket.id,
      ...cursor
    });
  });

  // Notify collaborators when cursor leaves whiteboard
  socket.on('whiteboard:cursor:leave', ({ workspaceId }) => {
    socket.to(`whiteboard:${workspaceId}`).emit('whiteboard:cursor:leave', { socketId: socket.id });
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room.startsWith('whiteboard:')) {
        socket.to(room).emit('whiteboard:cursor:leave', { socketId: socket.id });
      }
    }
  });
}
