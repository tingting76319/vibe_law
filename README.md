# Vibe Law / Legal-RAG

![CI](https://github.com/tingting76319/vibe_law/actions/workflows/ci-cd.yml/badge.svg)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

本專案為台灣法律專家知識系統 (Legal-RAG)，提供結合法官判例資料與 RAG 對話的智慧法律服務。

## ✨ 功能特色

- 🔍 **判例搜尋** - 透過關鍵字搜尋司法院公開判例
- 💬 **智慧問答** - 使用 RAG 技術回答法律問題
- 📚 **法規查詢** - 民法、刑法、行政法等法規查詢
- ⚖️ **訴訟策略** - AI 訴訟策略生成 (v0.9)
- 👨‍⚖️ **律師媒合** - 智能案件-律師匹配 (v0.8)
- 📊 **法官分析** - 法官判決趨勢分析 (v0.7)

## 🚀 快速開始

```bash
# 安裝依賴
npm install
npm install --prefix backend

# 設定環境變數
cp .env.example .env

# 啟動開發伺服器
npm run dev

# 執行測試
npm run lint
npm run test:run
```

## 📡 API 端點

### 主系統
| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | /health | 健康檢查 |

### 訴訟策略 (v0.9)
| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | /api/strategy/analyze-petition | 訴狀分析 |
| POST | /api/strategy/predict-trend | 趨勢預測 |
| POST | /api/strategy/generate-strategy | 策略生成 |

### 律師媒合 (v0.8)
| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | /api/lawyers | 律師列表 |
| GET | /api/lawyers/search | 律師搜尋 |
| POST | /api/matching/match | 案件媒合 |
| POST | /api/matching/recommend | 律師推薦 |

### 法官/法院 (v0.7)
| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | /api/judges/profile/:id | 法官檔案 |
| GET | /api/judges/trends/:id | 法官趨勢 |
| GET | /api/courts/profile/:id | 法院檔案 |
| GET | /api/courts/analysis/:id | 法院分析 |

### 法規 (v0.6)
| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | /api/laws/search | 法規搜尋 |
| GET | /api/laws/:id | 法規詳情 |

### 核心 API
| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | /api/judicial/search | 判例搜尋 |
| GET | /api/judicial/cases | 案例列表 |
| POST | /api/rag/ask | RAG 問答 |

## 📁 專案結構

```
legal-rag/
├── backend/
│   ├── src/
│   │   ├── routes/       # API 路由
│   │   ├── services/     # 業務邏輯
│   │   ├── repositories/ # 資料存取
│   │   ├── db/           # 資料庫
│   │   └── utils/        # 工具函數
│   └── tests/            # 測試
├── js/                   # 前端 JS
├── css/                  # 樣式
├── docs/                # 設計文件
└── tests/               # E2E 測試
```

## 🧪 測試

```bash
# 執行所有測試
npm run test:run

# 執行單元測試
npm --prefix backend run test

# 執行 coverage
npm --prefix backend run test:coverage
```

## 📝 版本歷史

- **v1.0.0** (2026-03-04) - 正式版發布
- **v0.9.0** - 訴訟策略 MVP
- **v0.8.0** - 律師媒合 MVP
- **v0.7.0** - 法官/法院邏輯引擎 MVP

## ⚠️ 注意事項

- 本系統僅供參考，不構成法律意見
- 使用 AI 問答功能需設定 LLM API Key
- 完整功能需要 PostgreSQL 資料庫

## 📄 License

MIT
