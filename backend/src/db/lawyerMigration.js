/**
 * Lawyer Tables Migration - 律師資料表
 * v0.8.0 - 律師媒合 MVP
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/legal.db');
const db = new Database(dbPath);

// 律師資料表
db.exec(`
  -- 律師資料表
  CREATE TABLE IF NOT EXISTS lawyer_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT,
    bar_number TEXT UNIQUE,
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
    hourly_rate INTEGER,
    availability_status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 律師擅長領域表
  CREATE TABLE IF NOT EXISTS lawyer_specialties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lawyer_id TEXT NOT NULL,
    specialty TEXT NOT NULL,
    specialty_type TEXT,
    case_count INTEGER DEFAULT 0,
    win_rate REAL DEFAULT 0,
    avg_case_value INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lawyer_id) REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    UNIQUE(lawyer_id, specialty)
  );

  -- 律師案件紀錄表
  CREATE TABLE IF NOT EXISTS lawyer_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lawyer_id TEXT NOT NULL,
    case_id TEXT,
    case_year INTEGER,
    case_number TEXT,
    court TEXT,
    case_type TEXT,
    case_subtype TEXT,
    opposing_counsel TEXT,
    result TEXT,
    outcome TEXT,
    case_value INTEGER DEFAULT 0,
    duration_days INTEGER,
    appeal_result TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lawyer_id) REFERENCES lawyer_profiles(id) ON DELETE CASCADE
  );

  -- 律師-法院適配度表
  CREATE TABLE IF NOT EXISTS lawyer_court_affinity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lawyer_id TEXT NOT NULL,
    court TEXT NOT NULL,
    court_level TEXT,
    total_cases INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_rate REAL DEFAULT 0,
    avg_case_duration_days INTEGER DEFAULT 0,
    avg_case_value INTEGER DEFAULT 0,
    recent_trend TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lawyer_id) REFERENCES lawyer_profiles(id) ON DELETE CASCADE,
    UNIQUE(lawyer_id, court)
  );

  -- 法官-律師歷史對局表（用於法院/法官適配分析）
  CREATE TABLE IF NOT EXISTS judge_lawyer_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    judge_id TEXT NOT NULL,
    lawyer_id TEXT NOT NULL,
    case_id TEXT,
    case_type TEXT,
    court TEXT,
    year INTEGER,
    lawyer_result TEXT,
    lawyer_role TEXT DEFAULT 'plaintiff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (judge_id) REFERENCES judge_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (lawyer_id) REFERENCES lawyer_profiles(id) ON DELETE CASCADE
  );

  -- 律師媒合記錄表
  CREATE TABLE IF NOT EXISTS lawyer_match_logs (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    user_id TEXT,
    lawyer_id TEXT NOT NULL,
    match_score REAL,
    score_breakdown TEXT,
    recommended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_feedback TEXT,
    user_rating INTEGER,
    is_accepted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_bar ON lawyer_profiles(bar_number);
  CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_firm ON lawyer_profiles(law_firm);
  CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_rating ON lawyer_profiles(rating DESC);
  CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_availability ON lawyer_profiles(availability_status);
  
  CREATE INDEX IF NOT EXISTS idx_lawyer_specialties_lawyer ON lawyer_specialties(lawyer_id);
  CREATE INDEX IF NOT EXISTS idx_lawyer_specialties_specialty ON lawyer_specialties(specialty);
  
  CREATE INDEX IF NOT EXISTS idx_lawyer_cases_lawyer ON lawyer_cases(lawyer_id);
  CREATE INDEX IF NOT EXISTS idx_lawyer_cases_court ON lawyer_cases(court);
  CREATE INDEX IF NOT EXISTS idx_lawyer_cases_type ON lawyer_cases(case_type);
  CREATE INDEX IF NOT EXISTS idx_lawyer_cases_result ON lawyer_cases(result);
  
  CREATE INDEX IF NOT EXISTS idx_lawyer_court_affinity_lawyer ON lawyer_court_affinity(lawyer_id);
  CREATE INDEX IF NOT EXISTS idx_lawyer_court_affinity_court ON lawyer_court_affinity(court);
  
  CREATE INDEX IF NOT EXISTS idx_judge_lawyer_history_judge ON judge_lawyer_history(judge_id);
  CREATE INDEX IF NOT EXISTS idx_judge_lawyer_history_lawyer ON judge_lawyer_history(lawyer_id);
  
  CREATE INDEX IF NOT EXISTS idx_lawyer_match_logs_case ON lawyer_match_logs(case_id);
  CREATE INDEX IF NOT EXISTS idx_lawyer_match_logs_lawyer ON lawyer_match_logs(lawyer_id);
`);

console.log('Lawyer tables migration completed!');
console.log('Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'lawyer%'").all().map(t => t.name));

module.exports = db;
