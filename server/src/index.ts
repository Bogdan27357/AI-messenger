import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { config } from './config';
import { setupSocket } from './socket';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import chatRoutes from './routes/chats';
import messageRoutes from './routes/messages';
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup Socket.IO
setupSocket(httpServer);

httpServer.listen(config.port, () => {
  console.log(`🚀 Server running on http://localhost:${config.port}`);
});
