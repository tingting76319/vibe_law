# v1.6 - 律師數位孿生

## 功能目標

1. **律師勝率分析** - 律師在不同案件類型的勝率
2. **律師風格** - 律師辯護策略偏好  
3. **歷史案件** - 律師過往承辦案件

---

## API 規劃

### 新增端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/lawyers/:id` | 律師詳情 |
| GET | `/api/lawyers/:id/cases` | 律師歷史案件 |
| GET | `/api/lawyers/:id/stats` | 律師統計分析 |
| GET | `/api/lawyers/:id/style` | 律師風格分析 |

---

## 資料庫

### lawyer_profiles 表

```sql
CREATE TABLE lawyer_profiles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  bar_number VARCHAR(50),
  specialty VARCHAR(200),
  court VARCHAR(100),
  win_rate FLOAT,
  total_cases INTEGER,
  style VARCHAR(50),  -- 攻擊型、防禦型、妥協型
  experience_years INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 前端頁面

在「👔 律師媒合」中新增「⚖️ 律師數位孿生」子分頁

---

## 工作項目

1. [ ] 建立 lawyer_profiles 表
2. [ ] 新增 API 端點
3. [ ] 前端數位孿生頁面
4. [ ] 從判決書提取律師資料

---

*最後更新: 2026-03-05*
