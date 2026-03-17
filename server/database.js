const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'data', 'prm.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    position TEXT DEFAULT '',
    department TEXT DEFAULT 'Отдел дополнительного обслуживания',
    avatar TEXT DEFAULT '',
    role TEXT DEFAULT 'employee' CHECK(role IN ('admin', 'employee')),
    status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'away')),
    bio TEXT DEFAULT '',
    mentor_id INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT DEFAULT 'private' CHECK(type IN ('private', 'group')),
    name TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id),
    text TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    file_name TEXT DEFAULT '',
    file_type TEXT DEFAULT '',
    reply_to INTEGER REFERENCES messages(id),
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER REFERENCES users(id),
    text TEXT DEFAULT '',
    media_url TEXT DEFAULT '',
    media_type TEXT DEFAULT '' CHECK(media_type IN ('', 'image', 'video')),
    likes_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blog_likes (
    post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS blog_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id),
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    document_id INTEGER REFERENCES documents(id),
    created_by INTEGER REFERENCES users(id),
    time_limit INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS test_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    correct_answer INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS test_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id),
    status TEXT DEFAULT 'assigned' CHECK(status IN ('assigned', 'in_progress', 'completed')),
    score INTEGER DEFAULT 0,
    answers TEXT DEFAULT '',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS trainings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_date DATETIME,
    end_date DATETIME,
    location TEXT DEFAULT '',
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS training_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'assigned' CHECK(status IN ('assigned', 'completed')),
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT DEFAULT '',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create default admin user
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (username, password, full_name, position, role)
    VALUES (?, ?, ?, ?, ?)
  `).run('admin', hash, 'Администратор', 'Руководитель отдела', 'admin');

  // Create demo employees
  const demoUsers = [
    ['ivanov', 'Иванов Иван Петрович', 'Специалист по обслуживанию'],
    ['petrova', 'Петрова Мария Сергеевна', 'Специалист по обслуживанию'],
    ['sidorov', 'Сидоров Алексей Николаевич', 'Старший специалист'],
  ];
  for (const [uname, fname, pos] of demoUsers) {
    const h = bcrypt.hashSync('password123', 10);
    db.prepare(`
      INSERT INTO users (username, password, full_name, position, role)
      VALUES (?, ?, ?, ?, 'employee')
    `).run(uname, h, fname, pos);
  }
}

module.exports = db;
