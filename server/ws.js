const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');
const db = require('./database');

const clients = new Map(); // userId -> Set<ws>

function wsHandler(wss) {
  wss.on('connection', (ws, req) => {
    let userId = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'auth') {
          const decoded = jwt.verify(msg.token, JWT_SECRET);
          userId = decoded.id;
          if (!clients.has(userId)) clients.set(userId, new Set());
          clients.get(userId).add(ws);

          db.prepare('UPDATE users SET status = ? WHERE id = ?').run('online', userId);
          broadcast({ type: 'user_status', userId, status: 'online' });
        }

        if (msg.type === 'typing') {
          sendToChat(msg.chatId, { type: 'typing', chatId: msg.chatId, userId }, userId);
        }

        if (msg.type === 'message_read') {
          db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND chat_id = ?')
            .run(msg.messageId, msg.chatId);
          sendToChat(msg.chatId, { type: 'message_read', messageId: msg.messageId, chatId: msg.chatId, userId });
        }
      } catch (e) {
        // ignore invalid messages
      }
    });

    ws.on('close', () => {
      if (userId) {
        const userSockets = clients.get(userId);
        if (userSockets) {
          userSockets.delete(ws);
          if (userSockets.size === 0) {
            clients.delete(userId);
            db.prepare('UPDATE users SET status = ? WHERE id = ?').run('offline', userId);
            broadcast({ type: 'user_status', userId, status: 'offline' });
          }
        }
      }
    });
  });
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const [, sockets] of clients) {
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
}

function sendToUser(userId, data) {
  const sockets = clients.get(userId);
  if (sockets) {
    const msg = JSON.stringify(data);
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
}

function sendToChat(chatId, data, excludeUserId) {
  const members = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId);
  const msg = JSON.stringify(data);
  for (const m of members) {
    if (m.user_id === excludeUserId) continue;
    const sockets = clients.get(m.user_id);
    if (sockets) {
      for (const ws of sockets) {
        if (ws.readyState === 1) ws.send(msg);
      }
    }
  }
}

module.exports = wsHandler;
module.exports.sendToUser = sendToUser;
module.exports.sendToChat = sendToChat;
module.exports.broadcast = broadcast;
