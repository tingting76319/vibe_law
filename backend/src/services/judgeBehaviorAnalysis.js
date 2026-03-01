/**
 * Judge Behavior Analysis Service - 法官行為分析服務
 * 分析法官歷史判決模式、提取裁判風格
 */
const { JUDGES, getJudgeById, searchJudges, getAllJudges } = require('../../../js/graph/judges');
const mockData = require('../../data/mockData.json');

// 法官行為分析
class JudgeBehaviorAnalysis {
  constructor() {
    this.judges = JUDGES;
    this.cases = mockData.cases || [];
  }

  // 分析法官判決模式
  analyzeJudgmentPatterns(judgeId) {
    const judge = getJudgeById(judgeId);
    if (!judge) {
      return { error: '法官不存在' };
    }

    const patterns = {
      judgeId: judge.id,
      judgeName: judge.name,
      court: judge.court,
      specialty: judge.specialty,
      seniority: judge.seniority,
      
      // 裁判風格分析
      judgmentStyle: {
        approach: judge.judgmentStyle?.approach || '未知',
        characteristics: judge.judgmentStyle?.特点 || '無資料',
        tendency: judge.judgmentStyle?.tendency || '無資料'
      },

      // 擅長領域分析
      expertise: judge.expertise || [],
      
      // 哲學理念
      philosophy: judge.philosophy || '無資料',

      // 判決傾向統計（mock data analysis）
      tendencies: this.analyzeTendencies(judge),

      // 關鍵詞關聯
      keywordAssociations: this.analyzeKeywordAssociations(judge)
    };

    return patterns;
  }

  // 分析判決傾向
  analyzeTendencies(judge) {
    // 基於法官專長領域分析判決傾向
    const tendencies = [];

    // 根據專長領域推斷傾向
    if (judge.specialty?.includes('民事侵權') || judge.specialty?.includes('醫療糾紛')) {
      tendencies.push({
        type: '侵權案件',
        tendency: '傾向保護被害人權益',
        confidence: 0.85,
        reason: '專長領域為民事侵權與醫療糾紛，注重過失責任與因果關係認定'
      });
    }

    if (judge.specialty?.includes('智慧財產權')) {
      tendencies.push({
        type: '智慧財產案件',
        tendency: '強調智慧財產權保護與創新激勵',
        confidence: 0.80,
        reason: '專長於著作權、專利侵權案件，注重技術細節與實質相似性'
      });
    }

    if (judge.specialty?.includes('刑事案件') || judge.specialty?.includes('毒品犯罪')) {
      tendencies.push({
        type: '刑事案件',
        tendency: '重視正當程序與證據法則',
        confidence: 0.85,
        reason: '專長於刑事案件，強調程序正義與被告權益保護'
      });
    }

    if (judge.specialty?.includes('行政法') || judge.specialty?.includes('稅務行政')) {
      tendencies.push({
        type: '行政案件',
        tendency: '強調依法行政與公益平衡',
        confidence: 0.80,
        reason: '專長於行政法與稅務，擅長法條解釋與處分合法性審查'
      });
    }

    if (judge.specialty?.includes('金融犯罪') || judge.specialty?.includes('內線交易')) {
      tendencies.push({
        type: '金融案件',
        tendency: '強調市場秩序與被害人保護',
        confidence: 0.85,
        reason: '專長於金融犯罪，注重市場公平與透明'
      });
    }

    return tendencies;
  }

  // 分析關鍵詞關聯
  analyzeKeywordAssociations(judge) {
    const associations = {};
    
    // 從法官專長領域建立關鍵詞映射
    judge.specialty?.forEach(specialty => {
      associations[specialty] = {
        frequency: Math.floor(Math.random() * 50) + 20, // mock frequency
        avgOutcome: this.getOutcomeForSpecialty(specialty),
        confidence: 0.75
      };
    });

    // 從判決風格建立關鍵詞關聯
    judge.keywords?.forEach(keyword => {
      if (!associations[keyword]) {
        associations[keyword] = {
          frequency: Math.floor(Math.random() * 30) + 10,
          avgOutcome: this.getOutcomeForSpecialty(keyword),
          confidence: 0.70
        };
      }
    });

    return associations;
  }

  // 取得專長領域的典型判決結果
  getOutcomeForSpecialty(specialty) {
    const outcomeMap = {
      '民事侵權': '原告勝訴',
      '醫療糾紛': '部分勝訴',
      '智慧財產權': '被告敗訴',
      '刑事案件': '有罪判決',
      '毒品犯罪': '重判',
      '行政法': '撤銷處分',
      '稅務行政': '重新核定',
      '金融犯罪': '有罪',
      '內線交易': '有罪'
    };

    return outcomeMap[specialty] || '依法論斷';
  }

  // 提取法官裁判風格向量
  extractJudgmentStyleVector(judgeId) {
    const judge = getJudgeById(judgeId);
    if (!judge) return null;

    const vector = {
      // 嚴謹程度 (0-1)
      rigor: this.calculateRigorScore(judge),
      
      // 保守程度 (0-1) 
      conservatism: this.calculateConservatismScore(judge),
      
      // 技術導向程度 (0-1)
      technicalOrientation: this.calculateTechnicalScore(judge),
      
      // 被害人保護傾向 (0-1)
      plaintiffProtection: this.calculatePlaintiffScore(judge),
      
      // 程序正義傾向 (0-1)
      proceduralJustice: this.calculateProceduralScore(judge),
      
      // 公益平衡傾向 (0-1)
      publicInterest: this.calculatePublicInterestScore(judge)
    };

    return {
      judgeId: judge.id,
      judgeName: judge.name,
      vector,
      interpretation: this.interpretVector(vector)
    };
  }

  // 計算各項風格分數
  calculateRigorScore(judge) {
    const style = judge.judgmentStyle?.approach || '';
    if (style.includes('嚴謹') || style.includes('程序嚴謹')) return 0.9;
    if (style.includes('技術') || style.includes('專業精準')) return 0.85;
    if (style.includes('法理')) return 0.8;
    return 0.7;
  }

  calculateConservatismScore(judge) {
    const style = judge.judgmentStyle?.approach || '';
    if (style.includes('嚴謹')) return 0.8;
    if (style.includes('法理')) return 0.7;
    return 0.6;
  }

  calculateTechnicalScore(judge) {
    if (judge.specialty?.includes('智慧財產')) return 0.95;
    if (judge.specialty?.includes('金融')) return 0.9;
    if (judge.specialty?.includes('醫療')) return 0.85;
    return 0.6;
  }

  calculatePlaintiffScore(judge) {
    const tendency = judge.judgmentStyle?.tendency || '';
    if (tendency.includes('保護被害人') || tendency.includes('原告')) return 0.85;
    if (tendency.includes('平衡')) return 0.6;
    return 0.5;
  }

  calculateProceduralScore(judge) {
    const style = judge.judgmentStyle?.approach || '';
    if (style.includes('程序嚴謹')) return 0.95;
    if (style.includes('嚴謹')) return 0.8;
    return 0.6;
  }

  calculatePublicInterestScore(judge) {
    const tendency = judge.judgmentStyle?.tendency || '';
    if (tendency.includes('公益') || tendency.includes('公共利益')) return 0.85;
    if (tendency.includes('市場秩序')) return 0.8;
    return 0.6;
  }

  // 解釋風格向量
  interpretVector(vector) {
    const interpretations = [];
    
    if (vector.rigor >= 0.8) {
      interpretations.push('裁判風格嚴謹，注重事實認定與證據審查');
    }
    
    if (vector.technicalOrientation >= 0.8) {
      interpretations.push('具有技術專業背景，擅長複雜專業案件');
    }
    
    if (vector.plaintiffProtection >= 0.7) {
      interpretations.push('傾向保護弱勢當事人權益');
    }
    
    if (vector.proceduralJustice >= 0.8) {
      interpretations.push('重視正當程序，確保當事人訴訟權利');
    }
    
    if (vector.publicInterest >= 0.7) {
      interpretations.push('注重公益與私人權益之平衡');
    }

    return interpretations;
  }

  // 搜尋法官
  searchJudges(keyword) {
    return searchJudges(keyword);
  }

  // 取得所有法官
  getAllJudges() {
    return this.judges.map(j => ({
      id: j.id,
      name: j.name,
      court: j.court,
      specialty: j.specialty,
      style: j.judgmentStyle?.approach
    }));
  }
}

module.exports = new JudgeBehaviorAnalysis();
