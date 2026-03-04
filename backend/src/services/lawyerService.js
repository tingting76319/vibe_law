/**
 * Lawyer Service - 律師資料庫服務
 * 整合資料庫模型與分析服務
 */
const Lawyer = require('../models/lawyer');
const { cacheService } = require('./cacheService');
const lawyerBehaviorAnalysis = require('./lawyerBehaviorAnalysis');
const lawyerMatchingEngine = require('./lawyerMatchingEngine');

class LawyerService {
  constructor() {
    this.cacheTTL = 30; // 分鐘
  }

  // 取得所有律師
  async getAllLawyers(forceRefresh = false) {
    const cacheKey = 'lawyers:all';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;
    }
    
    const lawyers = Lawyer.findAll(100, 0);
    
    // 與分析數據合併
    const lawyersWithAnalysis = lawyers.map(lawyer => {
      const analysis = lawyerBehaviorAnalysis.getAllLawyers().find(l => l.id === lawyer.id);
      return {
        ...lawyer,
        practiceStyle: analysis?.practiceStyle || null,
        specialties: lawyer.specialty
      };
    });
    
    cacheService.set(cacheKey, lawyersWithAnalysis, this.cacheTTL);
    return lawyersWithAnalysis;
  }

  // 依 ID 取得律師
  async getLawyerById(lawyerId, forceRefresh = false) {
    const cacheKey = `lawyer:${lawyerId}`;
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;
    }
    
    const lawyer = Lawyer.findById(lawyerId);
    if (!lawyer) return null;
    
    // 取得分析數據
    const analysis = lawyerBehaviorAnalysis.analyzePracticePatterns(lawyerId);
    const styleVector = lawyerBehaviorAnalysis.extractStyleVector(lawyerId);
    
    const result = {
      ...lawyer,
      behaviorAnalysis: analysis.error ? null : {
        specialties: analysis.specialties,
        practiceStyle: analysis.practiceStyle,
        courtroomStyle: analysis.courtroomStyle,
        caseTypeDistribution: analysis.caseTypeDistribution,
        winRateAnalysis: analysis.winRateAnalysis,
        keywordTags: analysis.keywordTags
      },
      styleVector: styleVector
    };
    
    cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  // 搜尋律師
  async searchLawyers(query) {
    const cacheKey = `lawyers:search:${query}`;
    
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    
    const lawyers = Lawyer.search(query);
    cacheService.set(cacheKey, lawyers, this.cacheTTL);
    return lawyers;
  }

  // 依專長取得律師
  async getLawyersBySpecialty(specialty) {
    const cacheKey = `lawyers:specialty:${specialty}`;
    
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    
    const lawyers = Lawyer.findBySpecialty(specialty);
    cacheService.set(cacheKey, lawyers, this.cacheTTL);
    return lawyers;
  }

  // 依法院取得律師
  async getLawyersByCourt(court) {
    const cacheKey = `lawyers:court:${court}`;
    
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    
    const lawyers = Lawyer.findByCourt(court);
    cacheService.set(cacheKey, lawyers, this.cacheTTL);
    return lawyers;
  }

  // 依律所取得律師
  async getLawyersByLawFirm(lawFirm) {
    const cacheKey = `lawyers:firm:${lawFirm}`;
    
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    
    const lawyers = Lawyer.findByLawFirm(lawFirm);
    cacheService.set(cacheKey, lawyers, this.cacheTTL);
    return lawyers;
  }

  // 建立律師資料
  async createLawyer(data) {
    const lawyer = Lawyer.create(data);
    
    // 清空相關快取
    cacheService.invalidatePattern('lawyers:*');
    
    return lawyer;
  }

  // 更新律師資料
  async updateLawyer(lawyerId, data) {
    const lawyer = Lawyer.update(lawyerId, data);
    
    // 清空快取
    cacheService.delete(`lawyer:${lawyerId}`);
    cacheService.invalidatePattern('lawyers:*');
    
    return lawyer;
  }

  // 刪除律師
  async deleteLawyer(lawyerId) {
    const result = Lawyer.delete(lawyerId);
    
    // 清空快取
    cacheService.delete(`lawyer:${lawyerId}`);
    cacheService.invalidatePattern('lawyers:*');
    
    return result;
  }

  // 更新案件統計
  async updateCaseStats(lawyerId, caseResult) {
    const result = Lawyer.updateCaseStats(lawyerId, caseResult);
    
    // 清空快取
    cacheService.delete(`lawyer:${lawyerId}`);
    cacheService.invalidatePattern('lawyers:*');
    
    return result;
  }

  // 律師媒合
  async matchLawyers(caseData, options = {}) {
    return await lawyerMatchingEngine.match(caseData, options);
  }

  // 計算單一律師匹配分數
  async calculateMatchScores(lawyerId, caseData, options = {}) {
    const lawyer = Lawyer.findById(lawyerId);
    if (!lawyer) return { error: '律師不存在' };
    
    return await lawyerMatchingEngine.calculateMatchScores(lawyer, caseData, options);
  }

  // 律師數位孿生完整資訊
  async getLawyerDigitalTwin(lawyerId) {
    const cacheKey = `lawyer-twin:${lawyerId}`;
    
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
    
    const profile = await this.getLawyerById(lawyerId);
    if (!profile) return null;
    
    const result = {
      profile: {
        id: profile.id,
        name: profile.name,
        gender: profile.gender,
        barNumber: profile.bar_number,
        lawFirm: profile.law_firm,
        position: profile.position,
        contact: {
          email: profile.contact_email,
          phone: profile.contact_phone,
          address: profile.office_address
        },
        yearsOfExperience: profile.years_of_experience,
        education: profile.education,
        barAdmissionYear: profile.bar_admission_year,
        bio: profile.bio,
        hourlyRate: profile.hourly_rate,
        availability: profile.availability_status
      },
      specialties: profile.specialty,
      expertise: profile.expertise,
      courtAdmission: profile.court_admission,
      languages: profile.languages,
      behaviorAnalysis: profile.behaviorAnalysis,
      styleVector: profile.styleVector,
      caseStats: profile.case_stats,
      winRateByCourt: profile.win_rate_by_court,
      winRateByType: profile.win_rate_by_type,
      rating: profile.rating
    };
    
    cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  // 比較多位律師
  async compareLawyers(lawyerIds, caseData) {
    const lawyers = Lawyer.findByIds(lawyerIds);
    
    if (lawyers.length === 0) {
      return { error: '找不到指定的律師' };
    }

    const comparisons = await Promise.all(
      lawyers.map(async (lawyer) => {
        const scores = await lawyerMatchingEngine.calculateMatchScores(lawyer, caseData);
        const totalScore = (
          scores.specialtyMatch.score * 0.30 +
          scores.courtMatch.score * 0.20 +
          scores.judgeMatch.score * 0.15 +
          scores.similarCase.score * 0.20 +
          scores.winRate.score * 0.15
        );
        
        return {
          lawyer: {
            id: lawyer.id,
            name: lawyer.name,
            lawFirm: lawyer.law_firm,
            yearsOfExperience: lawyer.years_of_experience,
            rating: lawyer.rating
          },
          scores: {
            specialtyMatch: scores.specialtyMatch.score.toFixed(2),
            courtMatch: scores.courtMatch.score.toFixed(2),
            judgeMatch: scores.judgeMatch.score.toFixed(2),
            similarCase: scores.similarCase.score.toFixed(2),
            winRate: scores.winRate.score.toFixed(2)
          },
          totalScore: totalScore.toFixed(2)
        };
      })
    );

    return {
      caseData: {
        type: caseData.case_type,
        court: caseData.court,
        judge: caseData.judge_id
      },
      comparedAt: new Date().toISOString(),
      comparisons: comparisons.sort((a, b) => b.totalScore - a.totalScore)
    };
  }

  // 取得可用律師
  async getAvailableLawyers(filters = {}) {
    const { court = null, specialty = null, maxHourlyRate = null } = filters;
    
    let lawyers = Lawyer.findAll(100, 0);
    
    // 篩選可用
    lawyers = lawyers.filter(l => l.availability_status === 'available');
    
    // 按法院篩選
    if (court) {
      lawyers = lawyers.filter(l => 
        (l.court_admission || []).some(c => c.includes(court))
      );
    }
    
    // 按專長篩選
    if (specialty) {
      lawyers = lawyers.filter(l => 
        (l.specialty || []).some(s => s.toLowerCase().includes(specialty.toLowerCase()))
      );
    }
    
    // 按時薪篩選
    if (maxHourlyRate) {
      lawyers = lawyers.filter(l => !l.hourly_rate || l.hourly_rate <= maxHourlyRate);
    }
    
    return lawyers;
  }
}

module.exports = new LawyerService();
