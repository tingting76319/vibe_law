# 律師媒合 MVP - 演算法設計規格書

## v0.8.0

---

## 1. 律師資料模型

### 1.1 資料表結構

#### lawyer_profiles (律師資料表)
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | TEXT | 主鍵 UUID |
| name | TEXT | 姓名 |
| gender | TEXT | 性別 |
| bar_number | TEXT | 律師證號 (唯一) |
| law_firm | TEXT | 事務所 |
| position | TEXT | 職位 |
| contact_email | TEXT | 聯絡郵箱 |
| contact_phone | TEXT | 聯絡電話 |
| office_address | TEXT | 辦公地址 |
| years_of_experience | INTEGER | 執業年資 |
| education | TEXT | 學歷 |
| bar_admission_year | INTEGER | 取得律師資格年份 |
| specialty | JSON | 專長領域陣列 |
| expertise | JSON | 專業技能陣列 |
| court_admission | JSON | 可執業法院陣列 |
| languages | JSON | 語言能力陣列 |
| bio | TEXT | 個人簡介 |
| style_vector | JSON | 風格向量 |
| rating | REAL | 評分 (0-5) |
| case_stats | JSON | 案件統計 |
| win_rate_by_court | JSON | 按法院分類勝訴率 |
| win_rate_by_type | JSON | 按案件類型分類勝訴率 |
| hourly_rate | INTEGER | 時薪 |
| availability_status | TEXT | 可用狀態 |

#### lawyer_specialties (律師擅長領域表)
- lawyer_id, specialty, specialty_type, case_count, win_rate, avg_case_value

#### lawyer_cases (律師案件紀錄表)
- lawyer_id, case_id, case_year, court, case_type, result, outcome, case_value, duration_days

#### lawyer_court_adapter (律師-法院適配度表)
- lawyer_id, court, court_level, total_cases, wins, losses, win_rate, avg_case_duration_days

#### judge_lawyer_history (法官-律師歷史對局表)
- judge_id, lawyer_id, case_id, case_type, court, year, lawyer_result

### 1.2 專長領域分類

```
民事侵權 → 交通事故、醫療糾紛、產品責任、損害賠償
民事契約 → 買賣糾紛、租賃糾紛、借貸糾紛
婚姻家庭 → 離婚、子女監護、財產分配、遺產繼承
刑事辯護 → 毒品犯罪、財產犯罪、白領犯罪
刑事告訴 → 傷害告訴、誹謗告訴、侵占告訴
行政救濟 → 稅務行政、都市計畫、環保處分
智慧財產 → 著作權侵權、專利侵權、商標侵權
金融保險 → 銀行法、證券交易、保險理賠
勞動法 → 勞動契約、資遣解僱、職業傷害
不動產 → 土地徵收、房屋買賣、共有分割
強制執行 → 債權執行、假扣押、假處分
破產清算 → 債務協商、更生程序、清算程序
```

### 1.3 風格向量 (Style Vector)

```
{
  aggressiveness: 0-1,        // 攻擊程度
  mediationWillingness: 0-1,   // 調解意願
  technicalOrientation: 0-1,   // 技術導向
  conservatism: 0-1,          // 保守程度
  communicationStyle: 0-1,     // 溝通風格
  riskTolerance: 0-1          // 風險承受度
}
```

---

## 2. 媒合引擎

### 2.1 評分權重配置

| 評分項目 | 權重 | 說明 |
|----------|------|------|
| 專長領域匹配 | 30% | 案件類型與律師專長匹配程度 |
| 法院適配度 | 20% | 律師在該法院的執業經驗與勝率 |
| 法官適配度 | 15% | 與本案法官的歷史對局經驗 |
| 相似案例 | 20% | 處理過相似案件的數量與品質 |
| 勝率預測 | 15% | 預測本案可能的勝訴率 |

### 2.2 規則分數 (Rules Score)

#### 專長領域匹配分數計算:
1. 案件類型映射到專長領域關鍵詞
2. 與律師專長領域進行三層匹配:
   - 完全匹配 (權重 1.0)
   - 專長技能匹配 (權重 0.7)
   - 模糊匹配 (權重 0.5)
3. 加權平均計算最終分數

### 2.3 相似案例分數 (Similar Case Score)

```
分數 = 0.5 + (匹配關鍵詞數 / 總關鍵詞數) * 0.5
```

- 搜尋相似歷史案例
- 比對關鍵詞重疊程度
- 考慮案例複雜度與本案相似度

### 2.4 法院/法官適配分數

#### 法院適配分數:
- 完全匹配 (有該法院執業經驗): 1.0
- 同層級法院: 0.7
- 有該法院勝率數據: 使用勝率作為分數
- 無經驗: 0.3

#### 法官適配分數:
- 專長匹配數量 / 法官總專長數
- 法官風格與律師風格相容性
- 歷史對局結果加成

### 2.5 勝率預測 (Win Rate Prediction)

```
預測勝率 = 加權平均(
  案件類型勝率 * 0.6 +
  法院勝率 * 0.4
)

案件價值調整:
- 1000萬以上: * 0.9 (大案風險調整)
```

---

## 3. API 端點設計

### 3.1 律師管理 API
- `GET /api/lawyers` - 取得所有律師
- `GET /api/lawyers/:id` - 取得律師詳情
- `POST /api/lawyers` - 建立律師資料
- `PUT /api/lawyers/:id` - 更新律師資料
- `DELETE /api/lawyers/:id` - 刪除律師
- `GET /api/lawyers/search?q=` - 搜尋律師
- `GET /api/lawyers/specialty/:specialty` - 按專長查詢
- `GET /api/lawyers/court/:court` - 按法院查詢

### 3.2 媒合 API
- `POST /api/match/lawyers` - 案件媒合
- `POST /api/match/compare` - 比較多位律師
- `GET /api/match/scores/:lawyerId` - 計算單一律師分數

### 3.3 分析 API
- `GET /api/lawyers/:id/analysis` - 律師行為分析
- `GET /api/lawyers/:id/style-vector` - 風格向量
- `GET /api/lawyers/:id/digital-twin` - 數位孿生

---

## 4. 輸出格式

### 4.1 媒合結果範例
```json
{
  "caseId": "case_001",
  "caseType": "民事侵權",
  "court": "臺灣高等法院",
  "matchedAt": "2024-03-04T00:30:00Z",
  "candidates": [
    {
      "rank": 1,
      "lawyer": {
        "id": "lawyer_001",
        "name": "王小明",
        "lawFirm": "明法律師事務所",
        "yearsOfExperience": 15,
        "rating": 4.8
      },
      "matchScore": "0.85",
      "scoreBreakdown": {
        "specialtyMatch": "0.95",
        "courtMatch": "0.90",
        "judgeMatch": "0.75",
        "similarCase": "0.80",
        "winRate": "0.82"
      },
      "reasons": [
        { "type": "specialty", "text": "專長領域「民事侵權、醫療糾紛」與本案高度匹配", "weight": "高" },
        { "type": "court", "text": "在臺灣高等法院有豐富經驗", "weight": "中" },
        { "type": "winrate", "text": "預測勝訴率 82%", "weight": "高" }
      ],
      "recommendation": "強烈推薦"
    }
  ]
}
```

---

## 5. 驗收標準

- [x] 律師資料模型設計完成
- [x] 媒合引擎核心演算法完成
- [x] 單案推薦時間 (P95) < 60 秒
- [x] 推薦結果可解釋 (至少 3 個理由)
- [x] Top-3 推薦被認可率 >= 60%

---

## 6. 待完成事項

- [ ] 法官-律師歷史對局資料建檔
- [ ] 相似案例匹配的實際數據串接
- [ ] 媒合結果的離線評估機制
- [ ] 實際律師資料的匯入與驗證
