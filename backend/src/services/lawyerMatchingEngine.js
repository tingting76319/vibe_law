/**
 * Lawyer Matching Engine - 律師媒合引擎
 * v0.8.0 - 律師媒合 MVP
const lawyerService = require("./lawyerService");
 * 
 * 核心功能：
 * 1. 規則分數計算
 * 2. 相似案例分數
 * 3. 法院/法官適配分數
 * 4. 勝率預測
 */
const Lawyer = require('../models/lawyer');
const lawyerBehaviorAnalysis = require('./lawyerBehaviorAnalysis');
const similarCaseRecommendation = require('./similarCaseRecommendation');
const judgeService = require('./judgeService');
const { cacheService } = require('./cacheService');

class LawyerMatchingEngine {
  constructor() {
    this.cacheTTL = 30; // 分鐘
    
    // 權重配置
    this.defaultWeights = {
      specialtyMatch: 0.30,      // 專長領域匹配
      courtMatch: 0.20,          // 法院適配度
      judgeMatch: 0.15,         // 法官適配度
      similarCase: 0.20,        // 相似案例匹配
      winRate: 0.15,            // 勝率預測
    };
    
    // 案件類型映射到專長領域
    this.caseTypeToSpecialty = {
      '民事侵權': ['民事侵權', '損害賠償'],
      '交通事故': ['民事侵權', '交通事故'],
      '醫療糾紛': ['民事侵權', '醫療糾紛'],
      '婚姻': ['婚姻家庭', '離婚'],
      '繼承': ['婚姻家庭', '遺產繼承'],
      '刑事辯護': ['刑事辯護'],
      '刑事告訴': ['刑事告訴'],
      '行政救濟': ['行政救濟', '稅務行政'],
      '智慧財產': ['智慧財產', '著作權侵權', '專利侵權'],
      '金融': ['金融保險', '銀行法'],
      '勞動': ['勞動法', '勞動契約'],
      '不動產': ['不動產', '土地徵收'],
      '強制執行': ['強制執行'],
      '破產': ['破產清算', '債務協商']
    };
  }

  /**
   * 主媒合方法
   * @param {Object} caseData - 案件資料
   * @param {Object} options - 選項
   * @returns {Promise<Array>} 排序後的律師列表
   */
  async match(caseData, options = {}) {
    const {
      topK = 10,
      weights = this.defaultWeights,
      excludeLawyerIds = [],
      court = null,
      judgeId = null,
      minScore = 0.1
    } = options;

    // 生成快取鍵
    const cacheKey = `match:${JSON.stringify(caseData).substring(0, 50)}:${topK}:${court}:${judgeId}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    // 1. 獲取候選律師
    let candidates = await this._getCandidateLawyers(caseData, court, excludeLawyerIds);
    
    if (candidates.length === 0) {
      return { error: '找不到符合條件的律師', candidates: [] };
    }

    // 2. 為每個候選律師計算分數
    const scoredCandidates = await Promise.all(
      candidates.map(async (lawyer) => {
        const scores = await this.calculateMatchScores(lawyer, caseData, {
          court,
          judgeId,
          weights
        });
        
        return {
          lawyer,
          scores,
          totalScore: this._calculateTotalScore(scores, weights)
        };
      })
    );

    // 3. 排序並過濾
    let results = scoredCandidates
      .filter(c => c.totalScore >= minScore)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, topK);

    // 4. 生成可解釋理由
    results = results.map(r => ({
      ...r,
      reasons: this._generateReasons(r.lawyer, r.scores, caseData)
    }));

    // 5. 格式化輸出
    const output = {
      caseId: caseData.id || null,
      caseType: caseData.case_type || caseData.type,
      court: court || caseData.court,
      judge: judgeId ? await this._getJudgeName(judgeId) : null,
      matchedAt: new Date().toISOString(),
      candidates: results.map(r => ({
        rank: results.indexOf(r) + 1,
        lawyer: this._formatLawyerSummary(r.lawyer),
        matchScore: r.totalScore.toFixed(2),
        scoreBreakdown: {
          specialtyMatch: r.scores.specialtyMatch.score.toFixed(2),
          courtMatch: r.scores.courtMatch.score.toFixed(2),
          judgeMatch: r.scores.judgeMatch.score.toFixed(2),
          similarCase: r.scores.similarCase.score.toFixed(2),
          winRate: r.scores.winRate.score.toFixed(2)
        },
        reasons: r.reasons,
        recommendation: this._getRecommendation(r.totalScore)
      }))
    };

    cacheService.set(cacheKey, output, this.cacheTTL);
    return output;
  }

  /**
   * 計算單一律師的匹配分數
   */
  async calculateMatchScores(lawyer, caseData, options = {}) {
    const { court = null, judgeId = null, weights = this.defaultWeights } = options;

    // 1. 專長領域匹配分數
    const specialtyMatch = await this._calculateSpecialtyMatch(lawyer, caseData);

    // 2. 法院適配分數
    const courtMatch = await this._calculateCourtMatch(lawyer, court || caseData.court);

    // 3. 法官適配分數
    const judgeMatch = await this._calculateJudgeMatch(lawyer, judgeId, caseData);

    // 4. 相似案例分數
    const similarCase = await this._calculateSimilarCaseScore(lawyer, caseData);

    // 5. 勝率預測分數
    const winRate = await this._calculateWinRateScore(lawyer, caseData);

    return {
      specialtyMatch,
      courtMatch,
      judgeMatch,
      similarCase,
      winRate
    };
  }

  /**
   * 計算專長領域匹配分數
   */
  async _calculateSpecialtyMatch(lawyer, caseData) {
    const caseType = caseData.case_type || caseData.type || '';
    const caseSubType = caseData.case_subtype || caseData.subtype || '';
    const keywords = caseData.keywords || caseData.related_issues || [];

    // 映射案件類型到專長領域
    const targetSpecialties = this._mapCaseTypeToSpecialties(caseType);
    
    // 添加子類型關鍵詞
    if (caseSubType) {
      targetSpecialties.push(caseSubType);
    }

    // 添加額外關鍵詞
    if (keywords.length > 0) {
      keywords.forEach(k => {
        const mapped = this._mapCaseTypeToSpecialties(k);
        targetSpecialties.push(...mapped);
      });
    }

    const lawyerSpecialties = lawyer.specialty || [];
    const lawyerExpertise = lawyer.expertise || [];

    // 計算匹配
    let matchedCount = 0;
    let totalWeight = 0;

    for (const target of targetSpecialties) {
      const lower = target.toLowerCase();
      
      // 檢查完全匹配
      if (lawyerSpecialties.some(s => s.toLowerCase().includes(lower))) {
        matchedCount += 1;
        totalWeight += 1.0;
      }
      // 檢查部分匹配（專長）
      else if (lawyerExpertise.some(e => e.toLowerCase().includes(lower))) {
        matchedCount += 0.7;
        totalWeight += 0.7;
      }
      // 檢查模糊匹配
      else {
        const fuzzy = lawyerSpecialties.some(s => {
          return this._fuzzyMatch(s.toLowerCase(), lower) > 0.6;
        });
        if (fuzzy) {
          matchedCount += 0.5;
          totalWeight += 0.5;
        }
      }
    }

    // 計算最終分數
    const maxPossibleScore = targetSpecialties.length || 1;
    const score = Math.min(matchedCount / Math.sqrt(maxPossibleScore), 1.0);

    return {
      score,
      matched: matchedCount > 0,
      matchedSpecialties: targetSpecialties.filter(t => 
        lawyerSpecialties.some(s => s.toLowerCase().includes(t.toLowerCase()))
      ),
      confidence: totalWeight > 0 ? Math.min(totalWeight / maxPossibleScore, 1) : 0
    };
  }

  /**
   * 計算法院適配分數
   */
  async _calculateCourtMatch(lawyer, court) {
    if (!court) {
      return { score: 0.5, reason: '無法院資訊', court: null, confidence: 0 };
    }

    const lawyerCourts = lawyer.court_admission || [];
    
    // 完全匹配
    const exactMatch = lawyerCourts.some(c => c.includes(court));
    if (exactMatch) {
      return {
        score: 1.0,
        court: court,
        experience: '丰富',
        confidence: 0.9
      };
    }

    // 檢查同層級法院
    const courtLevel = this._getCourtLevel(court);
    const sameLevelCourts = lawyerCourts.filter(c => 
      this._getCourtLevel(c) === courtLevel
    );

    if (sameLevelCourts.length > 0) {
      return {
        score: 0.7,
        court: court,
        experience: '中等',
        confidence: 0.6
      };
    }

    // 檢查法院適配度數據
    const winRateByCourt = lawyer.win_rate_by_court || {};
    const courtWinRate = winRateByCourt[court];
    
    if (courtWinRate !== undefined) {
      return {
        score: courtWinRate / 100,
        court: court,
        experience: '有紀錄',
        confidence: 0.8
      };
    }

    return {
      score: 0.3,
      court: court,
      experience: '無直接經驗',
      confidence: 0.3
    };
  }

  /**
   * 計算法官適配分數
   */
  async _calculateJudgeMatch(lawyer, judgeId, caseData) {
    if (!judgeId) {
      return { 
        score: 0.5, 
        hasHistory: false, 
        reason: '無法官資訊',
        confidence: 0 
      };
    }

    try {
      // 獲取法官資料
      const judge = await judgeService.getJudgeById(judgeId);
      if (!judge) {
        return { 
          score: 0.5, 
          hasHistory: false, 
          reason: '法官資料不存在',
          confidence: 0 
        };
      }

      // 分析法官與律師的歷史對局
      // 這裡應該查詢 judge_lawyer_history 表
      // 暫時基於法官專長和律師專長匹配
      
      const judgeSpecialty = judge.specialty || [];
      const lawyerSpecialty = lawyer.specialty || [];

      // 專長匹配
      const specialtyMatchCount = judgeSpecialty.filter(js => 
        lawyerSpecialty.some(ls => 
          js.toLowerCase().includes(ls.toLowerCase()) || 
          ls.toLowerCase().includes(js.toLowerCase())
        )
      ).length;

      const matchRatio = specialtyMatchCount / Math.max(judgeSpecialty.length, 1);
      
      // 法官風格與律師風格適配
      const styleCompatibility = this._calculateStyleCompatibility(judge, lawyer);

      const score = (matchRatio * 0.6 + styleCompatibility * 0.4);

      return {
        score,
        judgeName: judge.name,
        judgeCourt: judge.court,
        specialtyMatchCount,
        styleCompatibility,
        hasHistory: specialtyMatchCount > 0,
        confidence: 0.7
      };
    } catch (e) {
      return { 
        score: 0.5, 
        hasHistory: false, 
        reason: '無法獲取法官資料',
        confidence: 0 
      };
    }
  }

  /**
   * 計算相似案例分數
   */
  async _calculateSimilarCaseScore(lawyer, caseData) {
    try {
      // 搜尋相似案例
      const similarCases = await similarCaseRecommendation.findSimilarCases(
        {
          case_type: caseData.case_type,
          keywords: caseData.keywords || [],
          summary: caseData.summary || caseData.description
        },
        { topK: 5 }
      );

      if (!similarCases || similarCases.length === 0) {
        return { score: 0.5, similarCases: 0, confidence: 0.2 };
      }

      // 檢查律師是否有處理過這些相似案例
      // 這裡應該查詢 lawyer_cases 表
      // 暫時基於相似案例的關鍵字與律師專長匹配
      
      const caseKeywords = caseData.keywords || [];
      const lawyerKeywords = [...(lawyer.specialty || []), ...(lawyer.expertise || [])];

      let matchedKeywords = 0;
      for (const caseKw of caseKeywords) {
        if (lawyerKeywords.some(lk => 
          lk.toLowerCase().includes(caseKw.toLowerCase()) ||
          caseKw.toLowerCase().includes(lk.toLowerCase())
        )) {
          matchedKeywords++;
        }
      }

      const score = matchedKeywords > 0 ? 
        Math.min(0.5 + (matchedKeywords / caseKeywords.length) * 0.5, 1.0) : 
        0.5;

      return {
        score,
        similarCases: similarCases.length,
        topSimilarCase: similarCases[0]?.title || null,
        confidence: Math.min(0.3 + matchedKeywords * 0.1, 0.8)
      };
    } catch (e) {
      return { score: 0.5, similarCases: 0, confidence: 0 };
    }
  }

  /**
   * 計算勝率預測分數
   */
  async _calculateWinRateScore(lawyer, caseData) {
    const caseType = caseData.case_type || caseData.type || '';
    const court = caseData.court || null;

    // 1. 整體勝訴率
    const caseStats = lawyer.case_stats || {};
    const totalCases = caseStats.total_cases || 0;
    const wins = caseStats.wins || 0;
    const overallWinRate = totalCases > 0 ? wins / totalCases : 0.5;

    // 2. 按案件類型的勝訴率
    const winRateByType = lawyer.win_rate_by_type || {};
    let typeWinRate = winRateByType[caseType] || null;

    if (typeWinRate === null) {
      // 嘗試模糊匹配案件類型
      for (const [type, rate] of Object.entries(winRateByType)) {
        if (caseType.toLowerCase().includes(type.toLowerCase()) ||
            type.toLowerCase().includes(caseType.toLowerCase())) {
          typeWinRate = rate;
          break;
        }
      }
    }

    // 3. 按法院的勝訴率
    const winRateByCourt = lawyer.win_rate_by_court || {};
    let courtWinRate = court ? winRateByCourt[court] : null;

    // 4. 計算最終預測勝率
    let predictedWinRate;
    
    if (typeWinRate !== null && courtWinRate !== null) {
      // 兩者都有數據，加權平均
      predictedWinRate = (typeWinRate * 0.6 + courtWinRate * 0.4) / 100;
    } else if (typeWinRate !== null) {
      predictedWinRate = typeWinRate / 100;
    } else if (courtWinRate !== null) {
      predictedWinRate = courtWinRate / 100;
    } else {
      // 使用整體勝訴率，但對經驗進行調整
      const expFactor = Math.min(lawyer.years_of_experience / 20, 1);
      predictedWinRate = overallWinRate * (0.7 + expFactor * 0.3);
    }

    // 5. 案件價值調整（大案通常更謹慎）
    const caseValue = caseData.case_value || 0;
    if (caseValue > 10000000) { // 1000萬以上
      predictedWinRate *= 0.9; // 大案風險調整
    }

    return {
      score: Math.min(Math.max(predictedWinRate, 0), 1),
      overallWinRate: (overallWinRate * 100).toFixed(1) + '%',
      typeWinRate: typeWinRate ? typeWinRate + '%' : '無資料',
      courtWinRate: courtWinRate ? courtWinRate + '%' : '無資料',
      predictedWinRate: (predictedWinRate * 100).toFixed(1) + '%',
      confidence: this._calculateConfidence(totalCases, typeWinRate, courtWinRate)
    };
  }

  /**
   * 計算置信度
   */
  _calculateConfidence(totalCases, typeWinRate, courtWinRate) {
    let confidence = 0.3; // 基礎置信度

    if (totalCases >= 100) confidence += 0.2;
    else if (totalCases >= 50) confidence += 0.15;
    else if (totalCases >= 20) confidence += 0.1;

    if (typeWinRate !== null) confidence += 0.2;
    if (courtWinRate !== null) confidence += 0.2;

    return Math.min(confidence, 0.9);
  }

  /**
   * 獲取候選律師列表
   */
  async _getCandidateLawyers(caseData, court, excludeLawyerIds) {
    let candidates = [];
    const caseType = caseData.case_type || caseData.type || '';

    // 1. 先按專長領域篩選
    const mappedSpecialties = this._mapCaseTypeToSpecialties(caseType);
    if (mappedSpecialties.length > 0) {
      candidates = lawyerService.getLawyersBySpecialty(mappedSpecialties[0], 100);
    }

    // 2. 如果沒有結果，獲取全部律師
    if (candidates.length === 0) {
      candidates = lawyerService.getAllLawyers(100, 0);
    }

    // 3. 按法院進一步篩選
    if (court) {
      const courtCandidates = lawyerService.getLawyersByCourt(court, 50);
      if (courtCandidates.length > 0) {
        // 合併並按評分排序
        const combined = [...new Map([...candidates, ...courtCandidates].map(l => [l.id, l])).values()];
        combined.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        candidates = combined;
      }
    }

    // 4. 排除指定律師
    if (excludeLawyerIds.length > 0) {
      candidates = candidates.filter(l => !excludeLawyerIds.includes(l.id));
    }

    return candidates;
  }

  /**
   * 計算總分數
   */
  _calculateTotalScore(scores, weights) {
    return (
      scores.specialtyMatch.score * weights.specialtyMatch +
      scores.courtMatch.score * weights.courtMatch +
      scores.judgeMatch.score * weights.judgeMatch +
      scores.similarCase.score * weights.similarCase +
      scores.winRate.score * weights.winRate
    );
  }

  /**
   * 生成推薦理由
   */
  _generateReasons(lawyer, scores, caseData) {
    const reasons = [];

    // 專長匹配
    if (scores.specialtyMatch.matched) {
      reasons.push({
        type: 'specialty',
        text: `專長領域「${scores.specialtyMatch.matchedSpecialties.join('、')}」與本案高度匹配`,
        weight: '高'
      });
    }

    // 法院經驗
    if (scores.courtMatch.experience && scores.courtMatch.experience !== '無直接經驗') {
      reasons.push({
        type: 'court',
        text: `在 ${scores.courtMatch.court} 有${scores.courtMatch.experience}經驗`,
        weight: '中'
      });
    }

    // 法官適配
    if (scores.judgeMatch.hasHistory) {
      reasons.push({
        type: 'judge',
        text: `與本案法官 ${scores.judgeMatch.judgeName} 有歷史合作經驗`,
        weight: '中'
      });
    }

    // 相似案例
    if (scores.similarCase.similarCases > 0) {
      reasons.push({
        type: 'similar',
        text: `有處理 ${scores.similarCase.similarCases} 件相似案例的經驗`,
        weight: '高'
      });
    }

    // 勝率
    if (scores.winRate.predictedWinRate) {
      reasons.push({
        type: 'winrate',
        text: `預測勝訴率 ${scores.winRate.predictedWinRate}`,
        weight: '高'
      });
    }

    return reasons;
  }

  /**
   * 獲取推薦等級
   */
  _getRecommendation(score) {
    if (score >= 0.8) return '強烈推薦';
    if (score >= 0.6) return '推薦';
    if (score >= 0.4) return '可考慮';
    return '一般';
  }

  /**
   * 格式化律師摘要
   */
  _formatLawyerSummary(lawyer) {
    return {
      id: lawyer.id,
      name: lawyer.name,
      lawFirm: lawyer.law_firm,
      yearsOfExperience: lawyer.years_of_experience,
      specialties: lawyer.specialty || [],
      rating: lawyer.rating || 0,
      hourlyRate: lawyer.hourly_rate || null,
      availability: lawyer.availability_status
    };
  }

  /**
   * 獲取法官名稱
   */
  async _getJudgeName(judgeId) {
    try {
      const judge = await judgeService.getJudgeById(judgeId);
      return judge?.name || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 案件類型映射到專長領域
   */
  _mapCaseTypeToSpecialties(caseType) {
    return this.caseTypeToSpecialty[caseType] || [caseType];
  }

  /**
   * 獲取法院層級
   */
  _getCourtLevel(court) {
    if (court.includes('最高法院') || court.includes('最高行政法院')) return '最高';
    if (court.includes('高等') || court.includes('智慧財產')) return '高等';
    if (court.includes('地方法院') || court.includes('簡易庭')) return '地方法院';
    if (court.includes('行政法院')) return '行政';
    return '其他';
  }

  /**
   * 模糊匹配
   */
  _fuzzyMatch(a, b) {
    if (a.includes(b) || b.includes(a)) return 1;
    let matches = 0;
    for (const char of b) {
      if (a.includes(char)) matches++;
    }
    return matches / b.length;
  }

  /**
   * 計算風格相容性
   */
  _calculateStyleCompatibility(judge, lawyer) {
    // 從法官風格向量和律師風格向量計算相容性
    // 這裡應該從 lawyerBehaviorAnalysis 和 judgeBehaviorAnalysis 獲取向量
    
    // 簡單的基於專長的匹配
    const judgeSpecialty = judge.specialty || [];
    const lawyerSpecialty = lawyer.specialty || [];
    
    const overlap = judgeSpecialty.filter(js => 
      lawyerSpecialty.some(ls => 
        js.toLowerCase().includes(ls.toLowerCase()) ||
        ls.toLowerCase().includes(js.toLowerCase())
      )
    ).length;

    return overlap > 0 ? 0.7 : 0.4;
  }
}

module.exports = new LawyerMatchingEngine();
