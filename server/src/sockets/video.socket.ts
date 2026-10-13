import { Server, Socket } from 'socket.io';

interface CallUserInfo {
  userId: string;
  userName: string;
}

const activeCallUsers: Map<string, Map<string, CallUserInfo>> = new Map();

export function setupVideoSockets(io: Server, socket: Socket) {
  // Join video call room
  socket.on('video:join', ({ workspaceId, userId, userName }) => {
    socket.join(`video:${workspaceId}`);

    let roomCall = activeCallUsers.get(workspaceId);
    if (!roomCall) {
      roomCall = new Map();
      activeCallUsers.set(workspaceId, roomCall);
    }
    const cleanUserName = userName || 'Teammate';
    roomCall.set(socket.id, { userId, userName: cleanUserName });
    (socket as any).videoWorkspaceId = workspaceId;

    // Notify other peers in room with full user details
    socket.to(`video:${workspaceId}`).emit('video:peer-joined', {
      socketId: socket.id,
      userId,
      userName: cleanUserName
    });

    // Send existing peers list with names to newly joined user
    const existingPeers = Array.from(roomCall.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, info]) => ({
        socketId: id,
        userId: info.userId,
        userName: info.userName
      }));

    socket.emit('video:existing-peers', existingPeers);

    io.to(`workspace:${workspaceId}`).emit('video:active-count', roomCall.size);
  });

  // Relay WebRTC Offer
  socket.on('video:offer', ({ toSocketId, offer }) => {
    console.log(`[VideoSocket] 📡 Relaying offer from ${socket.id} -> ${toSocketId} (SDP size: ${offer?.sdp?.length || 0})`);
    io.to(toSocketId).emit('video:offer', {
      fromSocketId: socket.id,
      offer
    });
  });

  // Relay WebRTC Answer
  socket.on('video:answer', ({ toSocketId, answer }) => {
    console.log(`[VideoSocket] 📡 Relaying answer from ${socket.id} -> ${toSocketId} (SDP size: ${answer?.sdp?.length || 0})`);
    io.to(toSocketId).emit('video:answer', {
      fromSocketId: socket.id,
      answer
    });
  });

  // Relay WebRTC ICE Candidate
  socket.on('video:ice-candidate', ({ toSocketId, candidate }) => {
    const candidateType = candidate?.candidate ? candidate.candidate.split(' ')[7] : 'end';
    console.log(`[VideoSocket] 🧊 ICE candidate from ${socket.id} -> ${toSocketId} (type: ${candidateType})`);
    io.to(toSocketId).emit('video:ice-candidate', {
      fromSocketId: socket.id,
      candidate
    });
  });

  // Direct live video/screen frame streaming relay (bypasses all firewall/NAT/AP-isolation issues)
  socket.on('video:frame', ({ workspaceId, frame, isScreen }) => {
    socket.to(`video:${workspaceId}`).emit('video:peer-frame', {
      socketId: socket.id,
      frame,
      isScreen
    });
  });

  // Direct real-time audio chunk relay (16kHz PCM Int16)
  socket.on('video:audio-chunk', ({ workspaceId, chunk }) => {
    socket.to(`video:${workspaceId}`).emit('video:peer-audio-chunk', {
      socketId: socket.id,
      chunk
    });
  });

  // Relay Mic status toggle
  socket.on('video:toggle-mic', ({ workspaceId, isMuted }) => {
    socket.to(`video:${workspaceId}`).emit('video:peer-mic-toggle', {
      socketId: socket.id,
      isMuted
    });
  });

  // Relay Camera status toggle
  socket.on('video:toggle-cam', ({ workspaceId, isCamOff }) => {
    socket.to(`video:${workspaceId}`).emit('video:peer-cam-toggle', {
      socketId: socket.id,
      isCamOff
    });
  });

  // Relay Raise Hand status toggle
  socket.on('video:raise-hand', ({ workspaceId, isHandRaised }) => {
    socket.to(`video:${workspaceId}`).emit('video:peer-raise-hand', {
      socketId: socket.id,
      isHandRaised
    });
  });

  // Relay Screen Share status toggle
  socket.on('video:toggle-screen', ({ workspaceId, isSharingScreen }) => {
    socket.to(`video:${workspaceId}`).emit('video:peer-screen-toggle', {
      socketId: socket.id,
      isSharingScreen
    });
  });

  // Leave call
  socket.on('video:leave', ({ workspaceId }) => {
    const roomCall = activeCallUsers.get(workspaceId);
    if (roomCall) {
      roomCall.delete(socket.id);
      socket.leave(`video:${workspaceId}`);
      socket.to(`video:${workspaceId}`).emit('video:peer-left', { socketId: socket.id });
      io.to(`workspace:${workspaceId}`).emit('video:active-count', roomCall.size);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    const workspaceId = (socket as any).videoWorkspaceId;
    if (workspaceId && activeCallUsers.has(workspaceId)) {
      const roomCall = activeCallUsers.get(workspaceId)!;
      roomCall.delete(socket.id);
      socket.to(`video:${workspaceId}`).emit('video:peer-left', { socketId: socket.id });
      io.to(`workspace:${workspaceId}`).emit('video:active-count', roomCall.size);
    }
  });
}
