import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { ENV } from './config/env';
import { errorHandler } from './middleware/error';

import authRoutes from './routes/auth.routes';
import workspaceRoutes from './routes/workspace.routes';
import fileRoutes from './routes/file.routes';
import aiRoutes from './routes/ai.routes';
import gitRoutes from './routes/git.routes';
import executionRoutes from './routes/execution.routes';
import noteRoutes from './routes/note.routes';
import sheetRoutes from './routes/sheet.routes';

import { setupSocketIO } from './sockets';
import { DockerExecutionService } from './services/docker.service';
import { TunnelService } from './services/tunnel.service';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'NexForge Backend Server',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/workspaces', fileRoutes);
app.use('/api/workspaces', aiRoutes);
app.use('/api/workspaces', gitRoutes);
app.use('/api/workspaces', executionRoutes);
app.use('/api/workspaces', noteRoutes);
app.use('/api/workspaces', sheetRoutes);

// Global Error Handler
app.use(errorHandler);

// HTTP Server & Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  maxHttpBufferSize: 1e8 // 100MB
});

setupSocketIO(io);
app.set('io', io);

const PORT = parseInt(ENV.PORT, 10) || 5000;

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 NexForge IDE Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSockets listening on ws://localhost:${PORT}`);
  console.log(`=======================================================`);

  // Check Docker Daemon status in background
  DockerExecutionService.checkDockerAvailability();

  // Start automated Cloudflare Tunnel in background
  TunnelService.startTunnel();
});
