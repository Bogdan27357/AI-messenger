const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'prm.db');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Compatibility wrapper: makes sql.js look like better-sqlite3
// ---------------------------------------------------------------------------
class BetterSqlite3Compat {
  constructor(sqlDb) {
    this._db = sqlDb;
    this._savePath = DB_PATH;
    this._saveTimer = null;
  }

  // Schedule a debounced save so we don't write to disk on every single query
  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._saveToDisk();
    }, 500);
  }

  _saveToDisk() {
    try {
      const data = this._db.export();
      fs.writeFileSync(this._savePath, Buffer.from(data));
    } catch (e) {
      console.error('Error saving database:', e);
    }
  }

  _saveSync() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._saveToDisk();
  }

  exec(sql) {
    this._db.run(sql);
    this._scheduleSave();
    return this;
  }

  pragma(pragmaStr) {
    const parts = pragmaStr.split('=').map(s => s.trim());
    if (parts.length === 2) {
      this._db.run(`PRAGMA ${parts[0]} = ${parts[1]}`);
    } else {
      const results = this._db.exec(`PRAGMA ${pragmaStr}`);
      if (results.length > 0 && results[0].values.length > 0) {
        return results[0].values[0][0];
      }
    }
  }

  prepare(sql) {
    return new StatementCompat(this, sql);
  }

  close() {
    this._saveSync();
    this._db.close();
  }

  transaction(fn) {
    const self = this;
    return function (...args) {
      self._db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        self._db.run('COMMIT');
        self._scheduleSave();
        return result;
      } catch (e) {
        self._db.run('ROLLBACK');
        throw e;
      }
    };
  }
}

class StatementCompat {
  constructor(wrapper, sql) {
    this._wrapper = wrapper;
    this._sql = sql;
  }

  _normalizeParams(params) {
    // sql.js does not handle undefined — convert to null for COALESCE compatibility
    return params.map(p => p === undefined ? null : p);
  }

  run(...params) {
    const db = this._wrapper._db;
    const flatParams = params.flat !== undefined ? params : [params];
    const bindable = this._normalizeParams(
      flatParams.length === 1 && Array.isArray(flatParams[0]) ? flatParams[0] : flatParams
    );

    db.run(this._sql, bindable);

    const lastId = db.exec('SELECT last_insert_rowid()');
    const changes = db.getRowsModified();
    const lastInsertRowid = lastId.length > 0 ? lastId[0].values[0][0] : 0;

    this._wrapper._scheduleSave();
    return { changes, lastInsertRowid };
  }

  get(...params) {
    const db = this._wrapper._db;
    const flatParams = params.flat !== undefined ? params : [params];
    const bindable = this._normalizeParams(
      flatParams.length === 1 && Array.isArray(flatParams[0]) ? flatParams[0] : flatParams
    );

    let stmt;
    try {
      stmt = db.prepare(this._sql);
      stmt.bind(bindable);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const obj = {};
        for (let i = 0; i < cols.length; i++) {
          obj[cols[i]] = vals[i];
        }
        return obj;
      }
      return undefined;
    } finally {
      if (stmt) stmt.free();
    }
  }

  all(...params) {
    const db = this._wrapper._db;
    const flatParams = params.flat !== undefined ? params : [params];
    const bindable = this._normalizeParams(
      flatParams.length === 1 && Array.isArray(flatParams[0]) ? flatParams[0] : flatParams
    );

    let stmt;
    try {
      stmt = db.prepare(this._sql);
      stmt.bind(bindable);
      const results = [];
      while (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const obj = {};
        for (let i = 0; i < cols.length; i++) {
          obj[cols[i]] = vals[i];
        }
        results.push(obj);
      }
      return results;
    } finally {
      if (stmt) stmt.free();
    }
  }
}

// ---------------------------------------------------------------------------
// Initialize (synchronous-looking, but we block on init)
// ---------------------------------------------------------------------------
let db;

function initSync() {
  // sql.js initSqlJs returns a Promise, we need to block on it for compat
  // We use a synchronous file read + WASM initialization trick
  const SQL = require('sql.js');

  // This is a workaround: we load sql.js synchronously
  // by pre-resolving the promise during require time
  return SQL;
}

// We export a promise that resolves to the db wrapper.
// To make it transparent, we use a proxy that queues calls until ready.
let _ready = false;
let _queue = [];

const dbProxy = new Proxy({}, {
  get(target, prop) {
    if (_ready) return db[prop] && typeof db[prop] === 'function' ? db[prop].bind(db) : db[prop];

    // Return a function that queues the call
    if (['prepare', 'exec', 'pragma', 'close', 'transaction'].includes(prop)) {
      return (...args) => {
        if (_ready) {
          const val = db[prop](...args);
          return val;
        }
        throw new Error('Database not yet initialized. Await require("./database-ready") first.');
      };
    }
    return db ? db[prop] : undefined;
  }
});

// Synchronous init — load existing DB or create new one
const initPromise = initSqlJs().then(SQL => {
  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = new BetterSqlite3Compat(sqlDb);

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
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'private' CHECK(type IN ('private', 'group')),
      name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (chat_id, user_id)
    )
  `);

  db.exec(`
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
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER REFERENCES users(id),
      text TEXT DEFAULT '',
      media_url TEXT DEFAULT '',
      media_type TEXT DEFAULT '' CHECK(media_type IN ('', 'image', 'video')),
      likes_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_likes (
      post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, user_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
      author_id INTEGER REFERENCES users(id),
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      uploaded_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      document_id INTEGER REFERENCES documents(id),
      created_by INTEGER REFERENCES users(id),
      time_limit INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS test_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_answer INTEGER NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);

  db.exec(`
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
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS trainings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      start_date DATETIME,
      end_date DATETIME,
      location TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS training_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      training_id INTEGER REFERENCES trainings(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'assigned' CHECK(status IN ('assigned', 'completed')),
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
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

  db._saveSync();
  _ready = true;
  console.log('База данных инициализирована (sql.js)');

  return db;
});

// Make dbProxy thenable so `await db` works, plus expose initPromise
dbProxy._initPromise = initPromise;

module.exports = dbProxy;
module.exports.ready = initPromise;
