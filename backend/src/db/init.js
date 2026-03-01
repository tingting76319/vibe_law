const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/legal.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    court TEXT,
    year INTEGER,
    case_number TEXT,
    type TEXT,
    title TEXT,
    summary TEXT,
    content TEXT,
    result TEXT,
    related_laws TEXT,
    keywords TEXT,
    date TEXT,
    embedding BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS queries (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    question TEXT NOT NULL,
    answer TEXT,
    citations TEXT,
    model_used TEXT,
    response_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS citations (
    id TEXT PRIMARY KEY,
    query_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    relevance_score REAL,
    chunk_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES queries(id),
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS judge_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    court TEXT,
    position TEXT,
    tenure_start TEXT,
    tenure_end TEXT,
    specialty TEXT,
    bio TEXT,
    judgment_stats TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS eval_runs (
    id TEXT PRIMARY KEY,
    eval_name TEXT NOT NULL,
    dataset TEXT,
    model TEXT,
    metrics TEXT,
    results TEXT,
    status TEXT DEFAULT 'pending',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    chunk_index INTEGER,
    chunk_text TEXT NOT NULL,
    embedding BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE INDEX IF NOT EXISTS idx_cases_court ON cases(court);
  CREATE INDEX IF NOT EXISTS idx_cases_year ON cases(year);
  CREATE INDEX IF NOT EXISTS idx_cases_type ON cases(type);
  CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id);
  CREATE INDEX IF NOT EXISTS idx_citations_query ON citations(query_id);
  CREATE INDEX IF NOT EXISTS idx_embeddings_case ON embeddings(case_id);
`);

console.log('Database initialized successfully!');
console.log('Tables created:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name));

module.exports = db;
