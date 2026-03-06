/**
 * Lawyer Behavior Analysis Service - 律師行為分析服務
 * v0.8.0 - 律師媒合 MVP
const lawyerService = require("./lawyerService");
 * 分析律師歷史案件、提取執業風格
 */
const Lawyer = require('../models/lawyer');

// 律師擅長領域分類（對應案件類型）
const SPECIALTY_CATEGORIES = {
  '民事侵權': {
    type: 'civil',
    subTypes: ['交通事故', '醫療糾紛', '產品責任', '動物侵害', '環境污染'],
    keyExpertise: ['過失責任', '因果關係', '損害賠償', '精神慰撫金']
  },
  '民事契約': {
    type: 'civil',
    subTypes: ['買賣糾紛', '租賃糾紛', '借貸糾紛', '承攬糾紛', '委任糾紛'],
    keyExpertise: ['契約審閱', '違約責任', '解除契約', '損害計算']
  },
  '婚姻家庭': {
    type: 'civil',
    subTypes: ['離婚', '子女監護', '財產分配', '遺產繼承', '收養'],
    keyExpertise: ['夫妻財產制', '監護權酌定', '遺產分配', '剩餘財產分配']
  },
  '刑事辯護': {
    type: 'criminal',
    subTypes: ['毒品犯罪', '財產犯罪', '暴力犯罪', '白領犯罪', '少年案件'],
    keyExpertise: ['辯護策略', '證據分析', '量刑建議', '羈押抗告']
  },
  '刑事告訴': {
    type: 'criminal',
    subTypes: ['傷害告訴', '誹謗告訴', '侵占告訴', '詐欺告訴', '違反個資'],
    keyExpertise: ['告訴代理', '告訴狀撰寫', '調解協商', '和解談判']
  },
  '行政救濟': {
    type: 'administrative',
    subTypes: ['稅務行政', '都市計畫', '環保處分', '牌照許可', '勞動基準'],
    keyExpertise: ['行政訴訟', '復查決定', '國家賠償', '法規解釋']
  },
  '智慧財產': {
    type: 'civil',
    subTypes: ['著作權侵權', '專利侵權', '商標侵權', '營業秘密', '公平交易'],
    keyExpertise: ['侵權分析', '權利範圍', '損害賠償', '禁令救濟']
  },
  '金融保險': {
    type: 'civil',
    subTypes: ['銀行法', '證券交易法', '保險理賠', '信用卡爭議', '投資糾紛'],
    keyExpertise: ['金融法規', '內線交易', '洗錢防制', '消費者保護']
  },
  '勞動法': {
    type: 'civil',
    subTypes: ['勞動契約', '資遣解僱', '職業傷害', '雇主責任', '勞動檢查'],
    keyExpertise: ['勞動法規', '薪資計算', '資遣費', '職業災害']
  },
  '不動產': {
    type: 'civil',
    subTypes: ['土地徵收', '房屋買賣', '共有分割', '越界建築', '地籍糾紛'],
    keyExpertise: ['不動產法規', '登記程序', '價金分配', '土地利用']
  },
  '強制執行': {
    type: 'civil',
    subTypes: ['債權執行', '假扣押', '假處分', '拍賣程序', '參與分配'],
    keyExpertise: ['執行策略', '財產調查', '拍賣抗告', '分配異議']
  },
  '破產清算': {
    type: 'civil',
    subTypes: ['債務協商', '更生程序', '清算程序', '債權人會議', '破產抗告'],
    keyExpertise: ['破產法規', '債權申報', '財產管理', '債權分配']
  }
};

class LawyerBehaviorAnalysis {
  constructor() {
    this.specialtyCategories = SPECIALTY_CATEGORIES;
  }

  // 分析律師執業模式
  analyzePracticePatterns(lawyerId) {
    const lawyer = lawyerService.getLawyerById(lawyerId);
    if (!lawyer) {
      return { error: '律師不存在' };
    }

    const patterns = {
      lawyerId: lawyer.id,
      lawyerName: lawyer.name,
      lawFirm: lawyer.law_firm,
      yearsOfExperience: lawyer.years_of_experience,
      barAdmissionYear: lawyer.bar_admission_year,

      // 專長領域分析
      specialties: this.analyzeSpecialties(lawyer),

      // 執業風格分析
      practiceStyle: this.analyzePracticeStyle(lawyer),

      // 法庭風格
      courtroomStyle: this.analyzeCourtroomStyle(lawyer),

      // 案件類型分布
      caseTypeDistribution: this.analyzeCaseTypeDistribution(lawyer),

      // 勝訴率分析
      winRateAnalysis: this.analyzeWinRate(lawyer),

      // 關鍵字標籤
      keywordTags: this.generateKeywordTags(lawyer)
    };

    return patterns;
  }

  // 分析專長領域
  analyzeSpecialties(lawyer) {
    const specialties = lawyer.specialty || [];
    return specialties.map(specialty => {
      const category = this.specialtyCategories[specialty] || { type: 'other', subTypes: [], keyExpertise: [] };
      return {
        specialty,
        category: category.type,
        subTypes: category.subTypes,
        keyExpertise: category.keyExpertise,
        confidence: this.calculateSpecialtyConfidence(specialty, lawyer)
      };
    });
  }

  // 計算專長置信度
  calculateSpecialtyConfidence(specialty, lawyer) {
    // 基於經驗年數和案件數據計算置信度
    const expFactor = Math.min(lawyer.years_of_experience / 10, 1) * 0.3;
    const baseConfidence = 0.5;
    return Math.min(baseConfidence + expFactor, 0.95);
  }

  // 分析執業風格
  analyzePracticeStyle(lawyer) {
    const styles = [];

    // 根據專長領域判斷風格
    const specialties = lawyer.specialty || [];
    
    if (specialties.includes('刑事辯護')) {
      styles.push({
        style: '攻擊型辯護',
        description: '積極攻防，注重證據瑕疵與程序正義',
        characteristics: ['質詢技巧強', '善於發現偵查破綻', '強調被告權利']
      });
    }

    if (specialties.includes('民事侵權') || specialties.includes('醫療糾紛')) {
      styles.push({
        style: '細膩論證型',
        description: '注重因果關係與損害計算',
        characteristics: ['因果論證嚴謹', '損害項目仔細列舉', '善用專家證人']
      });
    }

    if (specialties.includes('婚姻家庭')) {
      styles.push({
        style: '溫和協調型',
        description: '注重當事人溝通與調解',
        characteristics: ['善於情緒安撫', '偏好和解調解', '注重未成年子女利益']
      });
    }

    if (specialties.includes('智慧財產')) {
      styles.push({
        style: '技術導向型',
        description: '熟悉技術細節與產業實務',
        characteristics: ['技術理解力強', '善用鑑定報告', '注重侵權分析']
      });
    }

    if (specialties.includes('行政救濟')) {
      styles.push({
        style: '法理分析型',
        description: '擅長法條解釋與行政程序',
        characteristics: ['法規熟悉度高', '善用訴願程序', '注重公益平衡']
      });
    }

    // 根據經驗年數添加風格標籤
    if (lawyer.years_of_experience >= 15) {
      styles.push({
        style: '資深穩健',
        description: '經驗豐富，策略成熟',
        characteristics: ['案件評估精準', '風險控制得當', '法庭經驗老道']
      });
    } else if (lawyer.years_of_experience < 5) {
      styles.push({
        style: '積極進取',
        description: '新銳律師，充滿熱忱',
        characteristics: ['研究深入', '回覆迅速', '收費弹性']
      });
    }

    return styles;
  }

  // 分析法庭風格
  analyzeCourtroomStyle(lawyer) {
    const courtAdmission = lawyer.court_admission || [];
    const style = {
      preferredCourts: [],
      courtLevelStrength: {},
      trialVsSettlement: 'balanced'
    };

    // 法院層級分布
    const levels = { '最高法院': 0, '高等法院': 0, '地方法院': 0, '行政法院': 0 };
    courtAdmission.forEach(court => {
      for (const level in levels) {
        if (court.includes(level)) levels[level]++;
      }
    });

    style.preferredCourts = courtAdmission;
    style.courtLevelStrength = levels;

    // 根據勝率數據判斷訴訟取向
    const winRateByType = lawyer.win_rate_by_type || {};
    const criminalWinRate = winRateByType['刑事辯護'] || 0;
    const civilWinRate = winRateByType['民事'] || 0;

    if (criminalWinRate > 0.6) {
      style.trialVsSettlement = 'trial_preferred';
      style.trialPreference = '偏好在法庭上辯論，較少調解'
    } else if (civilWinRate > 0.5 && (winRateByType['調解'] || 0) > 0.7) {
      style.trialVsSettlement = 'settlement_preferred';
      style.trialPreference = '偏好調解和解，講究效率'
    } else {
      style.trialVsSettlement = 'balanced';
      style.trialPreference = '視案件情況靈活選擇策略'
    }

    return style;
  }

  // 分析案件類型分布
  analyzeCaseTypeDistribution(lawyer) {
    const specialty = lawyer.specialty || [];
    const distribution = [];

    specialty.forEach(s => {
      const category = this.specialtyCategories[s];
      if (category) {
        distribution.push({
          type: category.type,
          specialty: s,
          subTypes: category.subTypes,
          proportion: this.estimateProportion(s, specialty)
        });
      }
    });

    return distribution;
  }

  // 估算領域比例
  estimateProportion(specialty, allSpecialties) {
    const idx = allSpecialties.indexOf(specialty);
    return 1 - (idx * 0.15); // 越前面的專長權重越高
  }

  // 分析勝訴率
  analyzeWinRate(lawyer) {
    const caseStats = lawyer.case_stats || {};
    const winRateByCourt = lawyer.win_rate_by_court || {};
    const winRateByType = lawyer.win_rate_by_type || {};

    const totalCases = caseStats.total_cases || 0;
    const wins = caseStats.wins || 0;
    const overallWinRate = totalCases > 0 ? (wins / totalCases) * 100 : 0;

    return {
      overall: {
        total: totalCases,
        wins: wins,
        losses: caseStats.losses || 0,
        rate: overallWinRate.toFixed(1) + '%',
        trend: this.calculateTrend(winRateByType)
      },
      byCourt: winRateByCourt,
      byType: winRateByType,
      analysis: this.generateWinRateAnalysis(overallWinRate, winRateByType)
    };
  }

  // 計算趨勢
  calculateTrend(winRateByType) {
    // 簡單趨勢計算：基於最近年度勝率變化
    const recent = winRateByType['recent'] || winRateByType['2024'] || 0;
    const older = winRateByType['2023'] || winRateByType['2022'] || 0;
    
    if (recent > older) return '上升';
    if (recent < older) return '下降';
    return '穩定';
  }

  // 生成勝率分析
  generateWinRateAnalysis(overall, byType) {
    const insights = [];
    
    if (overall > 70) {
      insights.push('整體勝訴率優於業界平均');
    } else if (overall < 40) {
      insights.push('整體勝訴率較低，需注意案件選擇');
    }

    // 找出最強領域
    const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] > 60) {
      insights.push(`最強領域為 ${sorted[0][0]}，勝訴率 ${sorted[0][1]}%`);
    }

    return insights;
  }

  // 生成關鍵字標籤
  generateKeywordTags(lawyer) {
    const tags = [];
    const specialties = lawyer.specialty || [];
    const expertise = lawyer.expertise || [];

    // 從專長添加標籤
    specialties.forEach(s => tags.push({ keyword: s, weight: 0.8 }));
    expertise.forEach(e => tags.push({ keyword: e, weight: 0.6 }));

    // 從執業風格添加標籤
    const styles = this.analyzePracticeStyle(lawyer);
    styles.forEach(s => tags.push({ keyword: s.style, weight: 0.5 }));

    return tags;
  }

  // 提取律師風格向量
  extractStyleVector(lawyerId) {
    const lawyer = lawyerService.getLawyerById(lawyerId);
    if (!lawyer) return null;

    const vector = {
      // 攻擊程度 (0-1)
      aggressiveness: this.calculateAggressiveness(lawyer),
      
      // 調解意願 (0-1)
      mediationWillingness: this.calculateMediationWillingness(lawyer),
      
      // 技術導向 (0-1)
      technicalOrientation: this.calculateTechnicalOrientation(lawyer),
      
      // 保守程度 (0-1)
      conservatism: this.calculateConservatism(lawyer),
      
      // 溝通風格 (0-1) - 0=低調務實, 1=積極主動
      communicationStyle: this.calculateCommunicationStyle(lawyer),
      
      // 風險承受度 (0-1)
      riskTolerance: this.calculateRiskTolerance(lawyer)
    };

    return {
      lawyerId: lawyer.id,
      lawyerName: lawyer.name,
      vector,
      interpretation: this.interpretVector(vector)
    };
  }

  // 計算各項風格分數
  calculateAggressiveness(lawyer) {
    const specialties = lawyer.specialty || [];
    if (specialties.includes('刑事辯護')) return 0.85;
    if (specialties.includes('智慧財產')) return 0.7;
    if (specialties.includes('婚姻家庭')) return 0.3;
    return 0.5;
  }

  calculateMediationWillingness(lawyer) {
    const winRateByType = lawyer.win_rate_by_type || {};
    if ((winRateByType['調解'] || 0) > 0.7) return 0.9;
    if ((winRateByType['和解'] || 0) > 0.6) return 0.8;
    return 0.5;
  }

  calculateTechnicalOrientation(lawyer) {
    const specialties = lawyer.specialty || [];
    if (specialties.includes('智慧財產') || specialties.includes('金融保險')) return 0.9;
    if (specialties.includes('行政救濟')) return 0.75;
    return 0.5;
  }

  calculateConservatism(lawyer) {
    // 資深律師傾向保守
    if (lawyer.years_of_experience >= 20) return 0.8;
    if (lawyer.years_of_experience >= 10) return 0.6;
    return 0.4;
  }

  calculateCommunicationStyle(lawyer) {
    // 根據擅長領域判斷
    const specialties = lawyer.specialty || [];
    if (specialties.includes('婚姻家庭')) return 0.85;
    if (specialties.includes('民事契約')) return 0.7;
    return 0.6;
  }

  calculateRiskTolerance(lawyer) {
    const caseStats = lawyer.case_stats || {};
    const winRate = caseStats.total_cases > 0 ? 
      caseStats.wins / caseStats.total_cases : 0.5;
    
    // 勝訴率高且經驗豐富的律師風險承受度較高
    if (winRate > 0.7 && lawyer.years_of_experience >= 10) return 0.8;
    if (winRate > 0.5) return 0.5;
    return 0.3;
  }

  // 解釋風格向量
  interpretVector(vector) {
    const interpretations = [];
    
    if (vector.aggressiveness >= 0.7) {
      interpretations.push('執風格積極進取，善於主動出擊');
    } else if (vector.aggressiveness <= 0.3) {
      interpretations.push('執風格溫和穩健，講究防守反擊');
    }
    
    if (vector.mediationWillingness >= 0.7) {
      interpretations.push('傾向調解和解，追求雙贏結局');
    }
    
    if (vector.technicalOrientation >= 0.8) {
      interpretations.push('具有技術專業背景，擅長複雜案件');
    }
    
    if (vector.riskTolerance >= 0.7) {
      interpretations.push('勇於接受高風險案件，策略大膽');
    } else if (vector.riskTolerance <= 0.3) {
      interpretations.push('審慎評估風險，偏好穩健策略');
    }

    return interpretations;
  }

  // 搜尋律師
  searchLawyers(keyword) {
    return lawyerService.searchLawyers(keyword);
  }

  // 取得所有律師摘要
  getAllLawyers() {
    return lawyerService.getAllLawyers(100, 0);
  }
}

module.exports = new LawyerBehaviorAnalysis();
