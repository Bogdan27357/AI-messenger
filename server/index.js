const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const path = require('path');
const dbProxy = require('./database');

async function startServer() {
  // Wait for sql.js database to initialize
  await dbProxy.ready;

  const authRoutes = require('./routes/auth');
  const chatRoutes = require('./routes/chats');
  const messageRoutes = require('./routes/messages');
  const fileRoutes = require('./routes/files');
  const blogRoutes = require('./routes/blog');
  const adminRoutes = require('./routes/admin');
  const userRoutes = require('./routes/users');
  const notificationRoutes = require('./routes/notifications');
  const aiRoutes = require('./routes/ai');
  const { authenticateToken } = require('./middleware/auth');
  const wsHandler = require('./ws');

  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Serve logo
  app.use('/logo.png', express.static(path.join(__dirname, '..', 'logo.png')));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/chats', authenticateToken, chatRoutes);
  app.use('/api/messages', authenticateToken, messageRoutes);
  app.use('/api/files', authenticateToken, fileRoutes);
  app.use('/api/blog', authenticateToken, blogRoutes);
  app.use('/api/admin', authenticateToken, adminRoutes);
  app.use('/api/users', authenticateToken, userRoutes);
  app.use('/api/notifications', authenticateToken, notificationRoutes);
  app.use('/api/ai', authenticateToken, aiRoutes);

  // Serve frontend in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
    });
  }

  // WebSocket
  wsHandler(wss);

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ПРМ сервер запущен на порту ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Ошибка запуска сервера:', err);
  process.exit(1);
});
