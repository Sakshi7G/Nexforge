import { Server, Socket } from 'socket.io';
import { setupCollabSockets } from './collab.socket';
import { setupPTYSockets } from './pty.socket';
import { setupChatSockets } from './chat.socket';
import { setupWhiteboardSockets } from './whiteboard.socket';
import { setupVideoSockets } from './video.socket';
import { setupNotesSockets } from './notes.socket';

export function setupSocketIO(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket Connected] Socket ID: ${socket.id}`);

    setupCollabSockets(io, socket);
    setupPTYSockets(io, socket);
    setupChatSockets(io, socket);
    setupWhiteboardSockets(io, socket);
    setupVideoSockets(io, socket);
    setupNotesSockets(io, socket);

    socket.on('disconnect', () => {
      console.log(`[Socket Disconnected] Socket ID: ${socket.id}`);
    });
  });
}
