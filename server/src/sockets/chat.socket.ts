import { Server, Socket } from 'socket.io';
import { prisma } from '../db/client';

export function setupChatSockets(io: Server, socket: Socket) {
  // Join chat room & load chat history
  socket.on('chat:join', async ({ workspaceId }) => {
    socket.join(`chat:${workspaceId}`);
    try {
      const history = await prisma.chatMessage.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100
      });
      socket.emit('chat:history', history);
    } catch (err) {
      console.error('[Chat Socket Error]', err);
    }
  });

  // Send new chat message
  socket.on('chat:send', async ({ workspaceId, userId, content }) => {
    if (!content || !content.trim()) return;

    try {
      const msg = await prisma.chatMessage.create({
        data: {
          workspaceId,
          userId,
          content
        },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } }
      });

      io.to(`chat:${workspaceId}`).emit('chat:message', msg);
    } catch (err) {
      console.error('[Chat Send Error]', err);
    }
  });

  // Typing indicator
  socket.on('chat:typing', ({ workspaceId, userName, isTyping }) => {
    socket.to(`chat:${workspaceId}`).emit('chat:typing', { userName, isTyping });
  });
}
