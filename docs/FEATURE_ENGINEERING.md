# 特徵工程設計文件

**版本**: v0.7.0 MVP  
**模組**: 法官/法院邏輯引擎  
**作者**: Research1 (演算法設計)  
**日期**: 2026-03-03

---

## 1. 概述

本文檔定義法官與法院判決特徵的提取方法，為後續 Graph RAG 與趨勢分析提供數據基礎。

### 1.1 數據源

- `cases` 表：案件基本資料 (court, case_type, year, result, keywords, judge_id)
- `judge_profiles` 表：法官個人資料 (court, court_level, specialty, judgment_stats, style_*)
- `judge_specialties` 表：法官專長領域
- `case_judges` 表：案件-法官關聯

---

## 2. 法官判決特徵提取

### 2.1 基礎特徵 (可直接從現有欄位獲取)

| 特徵名稱 | 來源欄位 | 類型 | 說明 |
|----------|----------|------|------|
| judge_id | judge_profiles.id | string | 法官唯一識別碼 |
| name | judge_profiles.name | string | 法官姓名 |
| court | judge_profiles.court | string | 所屬法院 |
| court_level | judge_profiles.court_level | enum | 法院層級 (地方法院/高等法院/最高法院) |
| tenure_years | tenure_start | int | 任期年數 |
| total_cases | judgment_stats.totalCases | int | 總審案件數 |

### 2.2 判決風格特徵 (從 judgment_stats 解析)

```javascript
// judgment_stats JSON 結構
{
  totalCases: int,        // 總案件數
  winRate: float,         // 原告/上訴方勝率 (民事)
  convictionRate: float,  // 定罪率 (刑事)
  avgDuration: float,     // 平均審理天數
  appealUpholdRate: float // 上訴維持率
}
```

| 特徵名稱 | 計算方式 | 說明 |
|----------|----------|------|
| win_rate | winRate | 民事案件原告勝率 |
| conviction_rate | convictionRate | 刑事案件定罪率 |
| avg_case_duration | avgDuration | 平均審理天數 |
| appeal_uphold_rate | appealUpholdRate | 上訴維持率 |

### 2.3 專長領域特徵 (從 specialty 解析)

```javascript
// specialty JSON 陣列結構
["民事侵權", "醫療糾紛", "損害賠償"]
```

| 特徵名稱 | 計算方式 | 說明 |
|----------|----------|------|
| specialty_count | specialty.length | 專長領域數量 |
| specialty_types | specialty | 專長領域列表 |
| specialty_diversity | 專長領域類型數 | 跨領域程度 |

### 2.4 判決傾向特徵 (從 style_* 欄位映射)

| 特徵名稱 | 來源欄位 | 映射值 |
|----------|----------|--------|
| style_approach | style_approach | 嚴謹細緻/技術導向/程序嚴謹/專業精準/法理分析 |
| style_tendency | style_tendency | 保護被害人/平衡公共利益/量刑考量/市場秩序/公益平衡 |
| philosophy | philosophy | 法官裁判理念 |

### 2.5 計算特徵 (需從案件數據統計)

| 特徵名稱 | 計算方式 | 說明 |
|----------|----------|------|
| case_type_distribution | 統計該法官各 case_type 數量 | 案件類型分布 |
| court_distribution | 統計該法官各法院案件數 | 審理法院分布 |
| yearly_case_count | 按 year 統計案件數 | 年度案件趨勢 |
| result_pattern | 統計 result 關鍵詞頻率 | 判決結果模式 |

---

## 3. 法院判決模式分析

### 3.1 法院基礎特徵

| 特徵名稱 | 來源 | 說明 |
|----------|------|------|
| court_name | cases.court | 法院名稱 |
| court_level | 從 court_name 推斷 | 法院層級 |
| total_cases | COUNT(*) | 總案件數 |
| yearly_cases | 按 year 統計 | 年度案件數 |

### 3.2 判決結果特徵

```sql
-- 計算法院層級的判決結果分布
SELECT court, result_category, COUNT(*) as cnt
FROM cases
GROUP BY court, result_category
```

| 特徵名稱 | 計算方式 | 說明 |
|----------|----------|------|
| case_type_ratio | 各 case_type 數量/總數 | 案件類型比例 |
| win_rate_by_court | 原告勝訴數/總民事案件數 | 民事勝訴率 |
| conviction_rate_by_court | 定罪數/總刑事案件數 | 刑事定罪率 |
| avg_duration_by_court | AVG(duration) | 平均審理天數 |

### 3.3 法院差異特徵

| 特徵名稱 | 說明 |
|----------|------|
| court_bias_index | 法院偏向程度 (傾向原告/被告/均衡) |
| settlement_rate | 和解率 |
| appeal_rate | 上訴率 |

---

## 4. 案由分布統計

### 4.1 案由基礎統計

```sql
-- 案由分布統計 SQL
SELECT 
  case_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT court) as court_count,
  COUNT(DISTINCT judge_id) as judge_count
FROM cases
GROUP BY case_type
```

| 統計維度 | 說明 |
|----------|------|
| case_type_count | 各案由案件總數 |
| court_distribution | 各案由涉及法院數 |
| judge_distribution | 各案由審理法官數 |
| yearly_distribution | 各案由年度趨勢 |

### 4.2 案由-結果關聯

| 特徵名稱 | 計算方式 |
|----------|----------|
| result_by_case_type | 各案由的判決結果分布 |
| win_rate_by_case_type | 各案由原告勝訴率 |
| avg_settlement_by_case_type | 各案由和解率 |

### 4.3 案由-法院關聯

| 特徵名稱 | 計算方式 |
|----------|----------|
| court_preference_by_case | 各案由偏好的法院 |
| case_type_court_matrix | 案由-法院矩陣 (熱力圖數據) |

### 4.4 案由-法官專長匹配

| 特徵名稱 | 計算方式 |
|----------|----------|
| matching_judge_count | 各案由具備相關專長的法官數 |
| specialty_coverage | 專長覆蓋率 |

---

## 5. 特徵提取管線

### 5.1 數據流程

```
案件資料載入 → 資料清洗 → 特徵提取 → 特徵儲存 → API 提供
```

### 5.2 特徵表設計

```sql
-- 法官特徵表
CREATE TABLE judge_features (
  judge_id TEXT PRIMARY KEY,
  court TEXT,
  court_level TEXT,
  tenure_years INT,
  total_cases INT,
  win_rate FLOAT,
  conviction_rate FLOAT,
  avg_case_duration FLOAT,
  appeal_uphold_rate FLOAT,
  specialty_count INT,
  specialty_types JSON,
  style_approach TEXT,
  style_tendency TEXT,
  case_type_distribution JSON,
  yearly_trend JSON,
  updated_at DATETIME
);

-- 法院特徵表
CREATE TABLE court_features (
  court TEXT PRIMARY KEY,
  court_level TEXT,
  total_cases INT,
  case_type_ratio JSON,
  win_rate FLOAT,
  conviction_rate FLOAT,
  avg_duration FLOAT,
  yearly_cases JSON,
  updated_at DATETIME
);

-- 案由特徵表
CREATE TABLE case_type_features (
  case_type TEXT PRIMARY KEY,
  total_count INT,
  court_count INT,
  judge_count INT,
  yearly_distribution JSON,
  result_distribution JSON,
  win_rate FLOAT,
  updated_at DATETIME
);
```

---

## 6. API 設計

### 6.1 法官特徵 API

```
GET /api/judges/:judgeId/features
Response: {
  judge_id, name, court, court_level,
  judgment_features: { win_rate, conviction_rate, ... },
  style_features: { approach, tendency, philosophy },
  specialty_features: { specialties, count, diversity },
  trend_features: { case_type_dist, yearly_trend }
}
```

### 6.2 法院特徵 API

```
GET /api/courts/:court/features
Response: {
  court, court_level,
  statistics: { total_cases, win_rate, conviction_rate, avg_duration },
  distribution: { case_type_ratio, yearly_cases },
  comparison: { vs_national_avg }
}
```

### 6.3 案由分析 API

```
GET /api/case-types/:caseType/analysis
Response: {
  case_type, statistics,
  court_distribution,
  judge_expertise_match,
  trends: { yearly, result_pattern }
}
```

---

## 7. 驗收標準

- [ ] 法官特徵可從現有數據完整提取
- [ ] 法院特徵計算準確率 >= 95%
- [ ] 案由分布統計覆蓋所有 case_type
- [ ] 特徵提取腳本執行時間 < 30秒 (10000筆案件)
- [ ] API 響應時間 P95 < 500ms

---

## 8. 待後續優化

- 法官判決書文本語義特徵 (NLP embedding)
- 時間序列趨勢預測
- 跨法院案件遷移分析
- 案件複雜度評估
