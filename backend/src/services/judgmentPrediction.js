/**
 * Judgment Prediction Service - 判決預測服務
 * 根據案件特徵預測判決結果，提供相似案件判決參考
 */
const { getJudgeById, searchJudges, getAllJudges } = require('../../../js/graph/judges');
const mockData = require('../../data/mockData.json');

class JudgmentPrediction {
  constructor() {
    this.cases = mockData.cases || [];
    // 判決結果類型權重
    this.verdictWeights = {
      '原告勝訴': 0.8,
      '被告敗訴': 0.7,
      '部分勝訴': 0.6,
      '有罪': 0.85,
      '無罪': 0.3,
      '撤銷處分': 0.75,
      '駁回': 0.4,
      '和解': 0.5
    };
  }

  // 預測判決結果
  async predictJudgment(caseFeatures, options = {}) {
    const { judgeId, includeSimilarCases = true } = options;

    // 1. 提取案件特徵
    const extractedFeatures = this.extractFeatures(caseFeatures);
    
    // 2. 獲取法官風格（如果有指定法官）
    let judgeStyle = null;
    if (judgeId) {
      judgeStyle = getJudgeById(judgeId);
    }

    // 3. 計算預測結果
    const prediction = this.calculatePrediction(extractedFeatures, judgeStyle);

    // 4. 取得相似案例
    let similarCases = [];
    if (includeSimilarCases) {
      similarCases = this.findSimilarCases(extractedFeatures, judgeId);
    }

    return {
      prediction: {
        outcome: prediction.outcome,
        confidence: prediction.confidence,
        reasoning: prediction.reasoning,
        factors: prediction.factors
      },
      judgeAnalysis: judgeStyle ? {
        judgeId: judgeStyle.id,
        judgeName: judgeStyle.name,
        style: judgeStyle.judgmentStyle?.approach,
        tendency: judgeStyle.judgmentStyle?.tendency
      } : null,
      similarCases: similarCases.slice(0, 5),
      features: extractedFeatures
    };
  }

  // 提取案件特徵
  extractFeatures(caseFeatures) {
    const { 
      type,           // 案件類型：民事、刑事、行政
      title,          // 案件標題
      description,    // 案件描述
      keywords,       // 關鍵詞
      relatedLaws,     // 相關法條
      amount,         // 標的金額
      isAppeal        // 是否為上訴案件
    } = caseFeatures;

    // 分析關鍵詞
    const analyzedKeywords = this.analyzeKeywords(keywords || [], title || '', description || '');
    
    return {
      type: type || '民事',
      title: title || '',
      description: description || '',
      keywords: analyzedKeywords.keywords,
      legalIssues: analyzedKeywords.issues,
      relatedLaws: relatedLaws || [],
      amount: amount || 0,
      isAppeal: isAppeal || false,
      complexity: this.assessComplexity(analyzedKeywords)
    };
  }

  // 分析關鍵詞
  analyzeKeywords(keywords, title, description) {
    const text = `${title} ${description} ${keywords.join(' ')}`.toLowerCase();
    const allKeywords = keywords || [];
    
    // 識別法律爭點
    const issues = [];
    
    // 侵權相關
    if (text.includes('車禍') || text.includes('過失') || text.includes('損害賠償')) {
      issues.push({ type: '侵權行為', weight: 0.9 });
    }
    
    // 刑事犯罪
    if (text.includes('侵占') || text.includes('盜竊') || text.includes('毒品')) {
      issues.push({ type: '刑事犯罪', weight: 0.95 });
    }
    
    // 行政救濟
    if (text.includes('稅') || text.includes('徵收') || text.includes('處分')) {
      issues.push({ type: '行政救濟', weight: 0.85 });
    }
    
    // 婚姻家庭
    if (text.includes('離婚') || text.includes('財產') || text.includes('監護')) {
      issues.push({ type: '家民事', weight: 0.8 });
    }
    
    // 租屋糾紛
    if (text.includes('租') || text.includes('瑕疵') || text.includes('租金')) {
      issues.push({ type: '租賃糾紛', weight: 0.85 });
    }

    // 智慧財產
    if (text.includes('著作') || text.includes('專利') || text.includes('侵權')) {
      issues.push({ type: '智慧財產', weight: 0.9 });
    }

    return {
      keywords: allKeywords,
      issues
    };
  }

  // 評估案件複雜度
  assessComplexity(analyzedFeatures) {
    let score = 0.5; // 基礎分數
    
    // 依爭點數量增加複雜度
    if (analyzedFeatures.issues?.length > 2) score += 0.2;
    if (analyzedFeatures.issues?.length > 4) score += 0.1;
    
    // 依關鍵詞數量增加
    if (analyzedFeatures.keywords?.length > 5) score += 0.1;
    
    // 依案件類型調整
    if (analyzedFeatures.type === '刑事') score += 0.1;
    if (analyzedFeatures.type === '行政') score += 0.05;
    
    return Math.min(score, 1.0);
  }

  // 計算預測結果
  calculatePrediction(features, judgeStyle) {
    const { type, legalIssues: issues, complexity } = features;
    
    // 基礎預測邏輯
    let baseOutcome = this.getBaseOutcome(type, issues);
    let baseConfidence = 0.65;
    
    // 根據法官風格調整
    if (judgeStyle) {
      const adjustment = this.adjustByJudgeStyle(baseOutcome, judgeStyle, issues);
      baseOutcome = adjustment.outcome;
      baseConfidence = adjustment.confidence;
    }

    // 根據案件複雜度調整信心度
    baseConfidence = baseConfidence - (complexity * 0.1);

    return {
      outcome: baseOutcome,
      confidence: Math.max(0.3, Math.min(0.9, baseConfidence)),
      reasoning: this.generateReasoning(features, judgeStyle),
      factors: this.identifyKeyFactors(features, issues)
    };
  }

  // 取得基礎判決結果
  getBaseOutcome(type, issues) {
    const typeOutcomes = {
      '民事': ['原告勝訴', '部分勝訴', '被告敗訴', '駁回'],
      '刑事': ['有罪', '無罪', '緩刑', '不起訴'],
      '行政': ['撤銷處分', '駁回', '重新核定']
    };

    const outcomes = typeOutcomes[type] || typeOutcomes['民事'];
    
    // 根據爭點類型調整結果傾向
    for (const issue of issues || []) {
      if (issue.type === '侵權行為' && type === '民事') {
        return { primary: '原告勝訴', secondary: '部分勝訴' };
      }
      if (issue.type === '刑事犯罪') {
        return { primary: '有罪', secondary: '緩刑' };
      }
      if (issue.type === '行政救濟') {
        return { primary: '撤銷處分', secondary: '駁回' };
      }
    }

    return { primary: outcomes[0], secondary: outcomes[1] };
  }

  // 根據法官風格調整預測
  adjustByJudgeStyle(baseOutcome, judgeStyle, issues) {
    const tendency = judgeStyle.judgmentStyle?.tendency || '';
    const specialty = judgeStyle.specialty || [];
    
    let adjustment = { outcome: baseOutcome, confidence: 0.7 };

    // 檢查法官是否專長於此類案件
    const isSpecialized = (issues || []).some(issue => 
      specialty.some(s => s.includes(issue.type))
    );

    if (isSpecialized) {
      adjustment.confidence += 0.15; // 提高信心度
    }

    // 根據法官傾向調整
    if (tendency.includes('保護被害人') && baseOutcome.primary?.includes('原告')) {
      adjustment.confidence += 0.1;
    }
    
    if (tendency.includes('重視程序') && (issues || []).some(i => i.type === '刑事犯罪')) {
      adjustment.confidence += 0.05;
    }

    return adjustment;
  }

  // 生成推理過程
  generateReasoning(features, judgeStyle) {
    const reasons = [];
    
    reasons.push(`案件類型為${features.type}，涉及${features.issues?.length || 0}個主要爭點`);
    
    if (features.keywords?.length > 0) {
      reasons.push(`關鍵詞：${features.keywords.slice(0, 3).join('、')}`);
    }

    if (judgeStyle) {
      reasons.push(`法官${judgeStyle.name}專長於${judgeStyle.specialty?.slice(0, 2).join('、')}`);
      reasons.push(`裁判風格：${judgeStyle.judgmentStyle?.approach}`);
    } else {
      reasons.push('未指定法官，使用一般統計預測');
    }

    return reasons.join('；');
  }

  // 識別關鍵因素
  identifyKeyFactors(features, issues) {
    const factors = [];

    // 法律依據
    if (features.relatedLaws?.length > 0) {
      factors.push({
        type: '法律依據',
        items: features.relatedLaws.slice(0, 3),
        impact: 'positive'
      });
    }

    // 爭點分析
    if (issues?.length > 0) {
      factors.push({
        type: '法律爭點',
        items: issues.map(i => i.type),
        impact: 'significant'
      });
    }

    // 案件複雜度
    factors.push({
      type: '案件複雜度',
      value: features.complexity,
      impact: features.complexity > 0.7 ? 'negative' : 'neutral',
      description: features.complexity > 0.7 ? '案件複雜，可能增加審理時間' : '案件相對單純'
    });

    return factors;
  }

  // 尋找相似案例
  findSimilarCases(features, judgeId = null) {
    const { type, keywords, issues, title, description } = features;
    
    let candidates = [...this.cases];

    // 如果有指定法官，過濾該法官相關案例
    if (judgeId) {
      const judge = getJudgeById(judgeId);
      // 根據法官專長過濾
      if (judge?.specialty) {
        candidates = candidates.filter(c => {
          const caseText = `${c.JTITLE} ${c.JFULLX?.JFULLCONTENT || ''}`.toLowerCase();
          return judge.specialty.some(s => 
            caseText.includes(s.toLowerCase()) || 
            (c.keywords || []).some(k => k.toLowerCase().includes(s.toLowerCase()))
          );
        });
      }
    }

    // 計算相似度
    const scored = candidates.map(c => ({
      case: c,
      similarity: this.calculateSimilarity(features, c)
    }));

    // 排序並返回
    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map(s => ({
        id: s.case.JID,
        title: s.case.JTITLE,
        year: s.case.JYEAR,
        type: s.case.JCASE,
        date: s.case.JDATE,
        summary: s.case.JFULLX?.JFULLCONTENT?.substring(0, 200) || '',
        keywords: s.case.keywords || [],
        relatedLaws: s.case.relatedLaws || [],
        similarity: s.similarity
      }));
  }

  // 計算相似度
  calculateSimilarity(features, caseData) {
    let score = 0;
    let weight = 0;

    // 案件類型相似度 (40%)
    if (features.type === caseData.JCASE) {
      score += 0.4;
    }
    weight += 0.4;

    // 關鍵詞相似度 (35%)
    const featureKeywords = new Set((features.keywords || []).map(k => k.toLowerCase()));
    const caseKeywords = new Set((caseData.keywords || []).map(k => k.toLowerCase()));
    
    const intersection = [...featureKeywords].filter(k => caseKeywords.has(k));
    const union = new Set([...featureKeywords, ...caseKeywords]);
    
    if (union.size > 0) {
      score += (intersection.size / union.size) * 0.35;
    }
    weight += 0.35;

    // 爭點相似度 (25%)
    const featureIssues = new Set((features.issues || []).map(i => i.type));
    const caseIssues = new Set();
    
    const caseText = `${caseData.JTITLE} ${caseData.JFULLX?.JFULLCONTENT || ''}`.toLowerCase();
    featureIssues.forEach(issue => {
      if (caseText.includes(issue.toLowerCase())) {
        caseIssues.add(issue);
      }
    });

    if (featureIssues.size > 0) {
      score += (caseIssues.size / featureIssues.size) * 0.25;
    }
    weight += 0.25;

    return weight > 0 ? score / weight : 0;
  }

  // 批量預測（多個法官比較）
  async compareJudges(caseFeatures, judgeIds) {
    const predictions = [];
    
    for (const judgeId of judgeIds) {
      const prediction = await this.predictJudgment(caseFeatures, { 
        judgeId, 
        includeSimilarCases: true 
      });
      predictions.push(prediction);
    }

    // 比較分析
    const comparison = {
      caseFeatures: caseFeatures,
      predictions: predictions.map(p => ({
        judgeId: p.judgeAnalysis?.judgeId,
        judgeName: p.judgeAnalysis?.judgeName,
        predictedOutcome: p.prediction.outcome,
        confidence: p.prediction.confidence,
        style: p.judgeAnalysis?.style
      })),
      recommendation: this.generateRecommendation(predictions)
    };

    return comparison;
  }

  // 生成建議
  generateRecommendation(predictions) {
    // 選擇信心度最高的預測
    const sorted = predictions.sort((a, b) => b.prediction.confidence - a.prediction.confidence);
    const best = sorted[0];

    return {
      recommendedJudge: best.judgeAnalysis?.judgeName,
      reason: `法官${best.judgeAnalysis?.judgeName}對此類案件最有經驗，預測信心度最高`,
      alternative: sorted[1] ? sorted[1].judgeAnalysis?.judgeName : null
    };
  }
}

module.exports = new JudgmentPrediction();
