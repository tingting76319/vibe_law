-- v1.6: 律師數位孿生 - 建立律師資料表

CREATE TABLE IF NOT EXISTS lawyer_profiles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  bar_number VARCHAR(50),
  specialty VARCHAR(200),
  court VARCHAR(100),
  win_rate FLOAT DEFAULT 0,
  total_cases INTEGER DEFAULT 0,
  style VARCHAR(50) DEFAULT '穩健型',
  experience_years INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_lawyer_name ON lawyer_profiles(name);
CREATE INDEX IF NOT EXISTS idx_lawyer_specialty ON lawyer_profiles(specialty);
CREATE INDEX IF NOT EXISTS idx_lawyer_court ON lawyer_profiles(court);

-- 插入範例資料
INSERT INTO lawyer_profiles (name, specialty, court, win_rate, total_cases, style, experience_years) VALUES
('陳文卿', '民事訴訟', '台北地方法院', 75, 120, '攻擊型', 15),
('梁志偉', '民事訴訟', '高雄地方法院', 68, 95, '穩健型', 12),
('林正欣', '刑事辯護', '台北地方法院', 82, 150, '攻擊型', 20),
('李明華', '家事訴訟', '台中地方法院', 70, 80, '妥協型', 10),
('王曉寧', '行政訴訟', '台北地方法院', 65, 60, '防禦型', 8)
ON CONFLICT DO NOTHING;
