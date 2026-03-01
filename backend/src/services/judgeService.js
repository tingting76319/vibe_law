/**
 * Judge Service - 法官資料庫服務
 * 整合資料庫模型與分析服務
 */
const Judge = require('../models/judge');
const { cacheService } = require('./cacheService');
const judgeBehaviorAnalysis = require('./judgeBehaviorAnalysis');
const judgmentPrediction = require('./judgmentPrediction');
const similarCaseRecommendation = require('./similarCaseRecommendation');

class JudgeService {
  constructor() {
    this.cacheTTL = 30; // 分鐘
  }

  // 取得所有法官
  async getAllJudges(forceRefresh = false) {
    const cacheKey = 'judges:all';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;
    }
    
    // 從資料庫取得
    const judges = Judge.findAll();
    
    // 與 mock 數據合併（補充分析數據）
    const judgesWithAnalysis = judges.map(judge => {
      const analysis = judgeBehaviorAnalysis.getAllJudges().find(j => j.id === judge.id);
      return {
        ...judge,
        style: analysis?.style || null,
        level: analysis?.level || null,
        seniority: analysis?.seniority || null
      };
    });
    
    cacheService.set(cacheKey, judgesWithAnalysis, this.cacheTTL);
    return judgesWithAnalysis;
  }

  // 依 ID 取得法官
  async getJudgeById(judgeId, forceRefresh = false) {
    const cacheKey = `judge:${judgeId}`;
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;
    }
    
    const judge = Judge.findById(judgeId);
    if (!judge) return null;
    
    // 取得分析數據
    const analysis = judgeBehaviorAnalysis.analyzeJudgmentPatterns(judgeId);
    const styleVector = judgeBehaviorAnalysis.extractJudgmentStyleVector(judgeId);
    
    const result = {
      ...judge,
      behaviorAnalysis: analysis.error ? null : {
        judgmentStyle: analysis.judgmentStyle,
        expertise: analysis.expertise,
        philosophy: analysis.philosophy,
        tendencies: analysis.tendencies
      },
      styleVector: styleVector
    };
    
    cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  // 搜尋法官
  async searchJudges(query) {
    const cacheKey = `judges:search:${query}`;
    
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    
    // 從資料庫搜尋
    let judges = Judge.findByName(query);
    
    // 如果沒有結果，從分析服務取得
    if (judges.length === 0) {
      const analysisJudges = judgeBehaviorAnalysis.searchJudges(query);
      judges = analysisJudges.map(j => ({
        id: j.id,
        name: j.name,
        court: j.court,
        specialty: j.specialty,
        style: j.style
      }));
    }
    
    cacheService.set(cacheKey, judges, this.cacheTTL);
    return judges;
  }

  // 依法院取得法官
  async getJudgesByCourt(court) {
    const cacheKey = `judges:court:${court}`;
    
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    
    const judges = Judge.findByCourt(court);
    cacheService.set(cacheKey, judges, this.cacheTTL);
    return judges;
  }

  // 建立法官資料
  async createJudge(data) {
    const judge = Judge.create(data);
    
    // 清空相關快取
    cacheService.invalidatePattern('judges:*');
    
    return judge;
  }

  // 更新法官資料
  async updateJudge(judgeId, data) {
    const judge = Judge.update(judgeId, data);
    
    // 清空快取
    cacheService.delete(`judge:${judgeId}`);
    cacheService.invalidatePattern('judges:*');
    
    return judge;
  }

  // 刪除法官
  async deleteJudge(judgeId) {
    const result = Judge.delete(judgeId);
    
    // 清空快取
    cacheService.delete(`judge:${judgeId}`);
    cacheService.invalidatePattern('judges:*');
    
    return result;
  }

  // 判決預測
  async predictJudgment(caseFeatures, options = {}) {
    const { judgeId, includeSimilarCases = true } = options;
    
    return await judgmentPrediction.predictJudgment(caseFeatures, {
      judgeId,
      includeSimilarCases
    });
  }

  // 比較法官預測
  async compareJudgePredictions(caseFeatures, judgeIds) {
    return await judgmentPrediction.compareJudges(caseFeatures, judgeIds);
  }

  // 相似案例推薦
  async findSimilarCases(queryData, options = {}) {
    const { caseId, caseData, topK = 10, judgeId, minSimilarity = 0.1, yearRange, caseType } = options;
    
    // 安全地生成快取鍵
    let cacheKeyData = caseId || 'query';
    if (!caseId && caseData) {
      try {
        cacheKeyData = JSON.stringify(caseData).substring(0, 50);
      } catch (e) {
        cacheKeyData = 'query';
      }
    }
    const cacheKey = `similar:${cacheKeyData}:${topK}:${judgeId}`;
    
    let queryCase;
    
    if (caseId) {
      // 從資料庫取得案例
      const Case = require('../models/case');
      queryCase = Case.findById(caseId);
    } else if (caseData) {
      queryCase = caseData;
    }
    
    if (!queryCase) {
      // Fallback to mock data with queryData
      return similarCaseRecommendation.findSimilarCases(queryData, options);
    }
    
    const result = similarCaseRecommendation.findSimilarCases(queryCase, options);
    
    return result;
  }

  // 搜尋相關判例
  async searchRelatedCases(query, options = {}) {
    return similarCaseRecommendation.searchRelatedCases(query, options);
  }

  // 取得相似度矩陣
  async getSimilarityMatrix() {
    return similarCaseRecommendation.computeSimilarityMatrix();
  }

  // 取得案例群組
  async getCaseClusters(minSimilarity = 0.5) {
    return similarCaseRecommendation.getCaseClusters(minSimilarity);
  }

  // 法官數位孪生完整資訊
  async getJudgeDigitalTwin(judgeId) {
    const cacheKey = `judge-twin:${judgeId}`;
    
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    
    const profile = await this.getJudgeById(judgeId);
    if (!profile) return null;
    
    const result = {
      profile: {
        id: profile.id,
        name: profile.name,
        court: profile.court,
        specialty: profile.specialty,
        seniority: profile.seniority,
        position: profile.position,
        tenureStart: profile.tenure_start,
        tenureEnd: profile.tenure_end,
        bio: profile.bio
      },
      behaviorAnalysis: profile.behaviorAnalysis,
      styleVector: profile.styleVector,
      judgmentStats: profile.judgment_stats
    };
    
    cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }
}

module.exports = new JudgeService();
