/**
 * Database Connection - 資料庫連線
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../../data/legal.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// 啟用外鍵約束
db.pragma('foreign_keys = ON');

// 資料表建立
db.exec(`
  -- 使用者表
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 案例表
  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    court TEXT NOT NULL,
    year INTEGER NOT NULL,
    case_number TEXT,
    case_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    result TEXT,
    related_laws TEXT,
    keywords TEXT,
    judge_id TEXT,
    date TEXT,
    embedding BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (judge_id) REFERENCES judge_profiles(id) ON DELETE SET NULL
  );

  -- 查詢日誌表
  CREATE TABLE IF NOT EXISTS queries (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    question TEXT NOT NULL,
    answer TEXT,
    citations TEXT,
    model_used TEXT,
    response_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- 引用表（用於 RAG）
  CREATE TABLE IF NOT EXISTS citations (
    id TEXT PRIMARY KEY,
    query_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    relevance_score REAL,
    chunk_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  -- 法官資料表（正規化）
  CREATE TABLE IF NOT EXISTS judge_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    court TEXT NOT NULL,
    court_level TEXT,
    position TEXT,
    tenure_start TEXT,
    tenure_end TEXT,
    specialty TEXT,
    bio TEXT,
    judgment_stats TEXT,
    style_approach TEXT,
    style_tendency TEXT,
    philosophy TEXT,
    expertise TEXT,
    notable_cases TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 法官擅長領域表（正規化）
  CREATE TABLE IF NOT EXISTS judge_specialties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    judge_id TEXT NOT NULL,
    specialty TEXT NOT NULL,
    specialty_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (judge_id) REFERENCES judge_profiles(id) ON DELETE CASCADE,
    UNIQUE(judge_id, specialty)
  );

  -- 法官判決統計表
  CREATE TABLE IF NOT EXISTS judge_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    judge_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    total_cases INTEGER DEFAULT 0,
    civil_cases INTEGER DEFAULT 0,
    criminal_cases INTEGER DEFAULT 0,
    administrative_cases INTEGER DEFAULT 0,
    plaintiff_win INTEGER DEFAULT 0,
    defendant_win INTEGER DEFAULT 0,
    partial_win INTEGER DEFAULT 0,
    dismissed INTEGER DEFAULT 0,
    appeal_rate REAL DEFAULT 0,
    reversal_rate REAL DEFAULT 0,
    avg_case_duration_days INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (judge_id) REFERENCES judge_profiles(id) ON DELETE CASCADE,
    UNIQUE(judge_id, year)
  );

  -- 評估執行表
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

  -- 向量嵌入表
  CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    chunk_index INTEGER,
    chunk_text TEXT NOT NULL,
    embedding BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  -- 快取表
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 案例-法官關聯表
  CREATE TABLE IF NOT EXISTS case_judges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT NOT NULL,
    judge_id TEXT NOT NULL,
    role TEXT DEFAULT 'presiding',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (judge_id) REFERENCES judge_profiles(id) ON DELETE CASCADE,
    UNIQUE(case_id, judge_id)
  );

  -- ===================== v0.8.0 律師相關表 =====================

  -- 律師資料表（主要律師表）
  CREATE TABLE IF NOT EXISTS lawyers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT,
    email TEXT,
    phone TEXT,
    office TEXT,
    bar_number TEXT UNIQUE NOT NULL,
    experience_years INTEGER DEFAULT 0,
    education TEXT,
    expertise TEXT,
    bio TEXT,
    case_history TEXT,
    success_rate REAL DEFAULT 0,
    rating REAL DEFAULT 0,
    hourly_rate REAL,
    available INTEGER DEFAULT 1,
    verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 律師專業領域表
  CREATE TABLE IF NOT EXISTS lawyer_specialties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lawyer_id TEXT NOT NULL,
    specialty TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lawyer_id) REFERENCES lawyers(id) ON DELETE CASCADE,
    UNIQUE(lawyer_id, specialty)
  );

  -- 案件-律師匹配記錄表
  CREATE TABLE IF NOT EXISTS case_lawyer_matches (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    user_id TEXT,
    lawyer_id TEXT,
    score REAL,
    match_results TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ===================== v0.8.0 律師媒合專用表 =====================

  -- 律師詳細資料表（lawyer_profiles）
  CREATE TABLE IF NOT EXISTS lawyer_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT,
    bar_number TEXT UNIQUE NOT NULL,
    law_firm TEXT,
    position TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    office_address TEXT,
    years_of_experience INTEGER DEFAULT 0,
    education TEXT,
    bar_admission_year INTEGER,
    specialty TEXT,
    expertise TEXT,
    court_admission TEXT,
    languages TEXT,
    bio TEXT,
    style_vector TEXT,
    rating REAL DEFAULT 0,
    case_stats TEXT,
    win_rate_by_court TEXT,
    win_rate_by_type TEXT,
    hourly_rate REAL,
    availability_status TEXT DEFAULT 'available',
    success_rate REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 案件資料表（用於律師媒合）
  CREATE TABLE IF NOT EXISTS cases_for_matching (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    case_type TEXT,
    title TEXT,
    summary TEXT,
    keywords TEXT,
    description TEXT,
    risk_level TEXT,
    risk_report TEXT,
    preferred_court TEXT,
    budget_min REAL,
    budget_max REAL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 索引建立（效能優化）
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_cases_court ON cases(court);
  CREATE INDEX IF NOT EXISTS idx_cases_year ON cases(year);
  CREATE INDEX IF NOT EXISTS idx_cases_type ON cases(case_type);
  CREATE INDEX IF NOT EXISTS idx_cases_judge ON cases(judge_id);
  CREATE INDEX IF NOT EXISTS idx_cases_date ON cases(date);
  
  CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id);
  CREATE INDEX IF NOT EXISTS idx_queries_created ON queries(created_at);
  
  CREATE INDEX IF NOT EXISTS idx_citations_query ON citations(query_id);
  CREATE INDEX IF NOT EXISTS idx_citations_case ON citations(case_id);
  
  CREATE INDEX IF NOT EXISTS idx_judge_profiles_court ON judge_profiles(court);
  CREATE INDEX IF NOT EXISTS idx_judge_profiles_name ON judge_profiles(name);
  
  CREATE INDEX IF NOT EXISTS idx_judge_specialties_judge ON judge_specialties(judge_id);
  CREATE INDEX IF NOT EXISTS idx_judge_specialties_specialty ON judge_specialties(specialty);
  
  CREATE INDEX IF NOT EXISTS idx_judge_statistics_judge ON judge_statistics(judge_id);
  CREATE INDEX IF NOT EXISTS idx_judge_statistics_year ON judge_statistics(year);
  
  CREATE INDEX IF NOT EXISTS idx_embeddings_case ON embeddings(case_id);
  
  CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
  
  CREATE INDEX IF NOT EXISTS idx_case_judges_case ON case_judges(case_id);
  CREATE INDEX IF NOT EXISTS idx_case_judges_judge ON case_judges(judge_id);

  -- v0.8.0 律師索引
  CREATE INDEX IF NOT EXISTS idx_lawyers_bar ON lawyers(bar_number);
  CREATE INDEX IF NOT EXISTS idx_lawyers_name ON lawyers(name);
  CREATE INDEX IF NOT EXISTS idx_lawyers_expertise ON lawyers(expertise);
  CREATE INDEX IF NOT EXISTS idx_lawyers_available ON lawyers(available);
  
  CREATE INDEX IF NOT EXISTS idx_lawyer_specialties_lawyer ON lawyer_specialties(lawyer_id);
  CREATE INDEX IF NOT EXISTS idx_lawyer_specialties_specialty ON lawyer_specialties(specialty);
  
  CREATE INDEX IF NOT EXISTS idx_case_lawyer_matches_case ON case_lawyer_matches(case_id);
  CREATE INDEX IF NOT EXISTS idx_case_lawyer_matches_lawyer ON case_lawyer_matches(lawyer_id);
  CREATE INDEX IF NOT EXISTS idx_case_lawyer_matches_user ON case_lawyer_matches(user_id);

  -- v0.8.0 lawyer_profiles 索引
  CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_bar ON lawyer_profiles(bar_number);
  CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_name ON lawyer_profiles(name);
  CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_firm ON lawyer_profiles(law_firm);
  CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_rating ON lawyer_profiles(rating);
  CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_status ON lawyer_profiles(availability_status);

  -- v0.8.0 cases_for_matching 索引
  CREATE INDEX IF NOT EXISTS idx_cases_matching_user ON cases_for_matching(user_id);
  CREATE INDEX IF NOT EXISTS idx_cases_matching_type ON cases_for_matching(case_type);
  CREATE INDEX IF NOT EXISTS idx_cases_matching_status ON cases_for_matching(status);
`);

console.log('Database initialized successfully!');
console.log('Tables created:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name));

module.exports = db;
