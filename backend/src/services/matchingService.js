/**
 * 案件-律師匹配服務 - Matching Service
 * v0.8.0 - 律師媒合 MVP
 */
const Lawyer = require('../models/lawyer');
const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

// 輔助函數：將關鍵字轉換為字串
function normalizeKeywords(keywords) {
  if (!keywords) return '';
  if (Array.isArray(keywords)) {
    return keywords.join(' ');
  }
  return String(keywords);
}

const MatchingService = {
  // 案件-律師匹配
  matchCaseToLawyers(caseData, options = {}) {
    const { limit = 10, minMatchScore = 0.3 } = options;
    
    // 取得所有可用律師
    const lawyers = Lawyer.findAll(100, 0);
    const availableLawyers = lawyers.filter(l => l.availability_status === 'available');
    
    // 計算每個律師的匹配度
    const scoredLawyers = availableLawyers.map(lawyer => {
      const score = this.calculateMatchScore(caseData, lawyer);
      return {
        lawyer,
        score,
        reasons: this.getMatchReasons(caseData, lawyer)
      };
    });
    
    // 按匹配度排序
    scoredLawyers.sort((a, b) => b.score - a.score);
    
    // 過濾低於最低門檻的結果
    const matched = scoredLawyers.filter(m => m.score >= minMatchScore).slice(0, limit);
    
    return {
      case: {
        id: caseData.id,
        type: caseData.case_type,
        title: caseData.title,
        summary: caseData.summary,
        keywords: caseData.keywords
      },
      matches: matched.map(m => ({
        lawyer: m.lawyer,
        matchScore: Math.round(m.score * 100) / 100,
        matchLevel: this.getMatchLevel(m.score),
        reasons: m.reasons
      })),
      totalCandidates: availableLawyers.length,
      timestamp: new Date().toISOString()
    };
  },

  // 計算匹配度評分
  calculateMatchScore(caseData, lawyer) {
    let score = 0;
    const weights = {
      expertise: 0.35,      // 專業領域匹配
      experience: 0.20,     // 經驗年數
      successRate: 0.20,    // 成功率
      keywords: 0.15,       // 關鍵字匹配
      availability: 0.10    // 可用性
    };

    // 1. 專業領域匹配
    const caseType = (caseData.case_type || '').toLowerCase();
    const caseKeywords = normalizeKeywords(caseData.keywords).toLowerCase();
    const lawyerExpertise = lawyer.expertise || [];
    
    let expertiseScore = 0;
    const allExpertise = [...lawyerExpertise].map(e => e.toLowerCase());
    
    // 檢查案件類型是否在律師專業中
    for (const exp of allExpertise) {
      if (caseType.includes(exp) || exp.includes(caseType)) {
        expertiseScore = 1;
        break;
      }
      // 檢查關鍵字
      if (caseKeywords.includes(exp)) {
        expertiseScore = Math.max(expertiseScore, 0.8);
      }
    }
    score += expertiseScore * weights.expertise;

    // 2. 經驗年數加分
    const expYears = lawyer.years_of_experience || 0;
    const experienceScore = Math.min(expYears / 20, 1); // 20年經驗為滿分
    score += experienceScore * weights.experience;

    // 3. 成功率加分
    const successRate = lawyer.success_rate || 0;
    score += (successRate / 100) * weights.successRate;

    // 4. 關鍵字匹配
    let keywordScore = 0;
    const caseText = `${caseData.title || ''} ${caseData.summary || ''} ${caseKeywords}`.toLowerCase();
    
    for (const exp of allExpertise) {
      if (caseText.includes(exp)) {
        keywordScore = 1;
        break;
      }
    }
    score += keywordScore * weights.keywords;

    // 5. 可用性 (已過濾不可用的律師，這裡給滿分)
    score += weights.availability;

    // 標準化到 0-1
    return Math.min(Math.max(score, 0), 1);
  },

  // 取得匹配原因
  getMatchReasons(caseData, lawyer) {
    const reasons = [];
    const caseType = (caseData.case_type || '').toLowerCase();
    const caseKeywords = normalizeKeywords(caseData.keywords).toLowerCase();
    const lawyerExpertise = (lawyer.expertise || []).map(e => e.toLowerCase());

    // 檢查專業領域
    for (const exp of lawyerExpertise) {
      if (caseType.includes(exp) || exp.includes(caseType)) {
        reasons.push({
          type: 'expertise',
          text: `專長領域符合：${exp}`,
          weight: 'high'
        });
        break;
      }
    }

    // 檢查關鍵字
    for (const exp of lawyerExpertise) {
      if (caseKeywords.includes(exp)) {
        reasons.push({
          type: 'keywords',
          text: `關鍵字匹配：${exp}`,
          weight: 'medium'
        });
        break;
      }
    }

    // 經驗
    if (lawyer.years_of_experience >= 10) {
      reasons.push({
        type: 'experience',
        text: `豐富經驗：${lawyer.years_of_experience} 年`,
        weight: 'medium'
      });
    }

    // 成功率
    if (lawyer.success_rate >= 70) {
      reasons.push({
        type: 'success_rate',
        text: `高成功率：${lawyer.success_rate}%`,
        weight: 'high'
      });
    }

    // 評價
    if (lawyer.rating >= 4.5) {
      reasons.push({
        type: 'rating',
        text: `高評價：${lawyer.rating} 分`,
        weight: 'medium'
      });
    }

    return reasons;
  },

  // 取得匹配等級
  getMatchLevel(score) {
    if (score >= 0.8) return '極高';
    if (score >= 0.6) return '高';
    if (score >= 0.4) return '中等';
    if (score >= 0.3) return '一般';
    return '較低';
  },

  // 取得律師推薦結果
  getRecommendations(userId, caseData, options = {}) {
    const matchResult = this.matchCaseToLawyers(caseData, options);
    
    // 儲存推薦結果到資料庫
    const recommendationId = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO case_lawyer_matches (
        id, case_id, user_id, match_results, created_at
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      recommendationId,
      caseData.id || null,
      userId || null,
      JSON.stringify(matchResult.matches.map(m => ({
        lawyer_id: m.lawyer.id,
        score: m.matchScore,
        level: m.matchLevel
      })))
    );

    return {
      recommendationId,
      ...matchResult
    };
  },

  // 取得歷史推薦記錄
  getHistory(userId, limit = 10) {
    const history = db.prepare(`
      SELECT * FROM case_lawyer_matches 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit);

    return history.map(h => ({
      id: h.id,
      caseId: h.case_id,
      results: JSON.parse(h.match_results || '[]'),
      createdAt: h.created_at
    }));
  },

  // 儲存匹配記錄
  saveMatchRecord(caseId, lawyerId, score) {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO case_lawyer_matches (id, case_id, lawyer_id, score, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, caseId, lawyerId, score);
    return { id, caseId, lawyerId, score };
  }
};

module.exports = MatchingService;
