import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || window.location.origin;
    socket = io(backendUrl, {
      autoConnect: true,
      reconnection: true,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
};
