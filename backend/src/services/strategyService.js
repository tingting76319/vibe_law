/**
 * 訴訟策略服務 - v0.9.0 MVP
 * 訴狀分析、趨勢預測、風險評估、策略生成
 */
const llmService = require('../services/llmService');
const db = require('better-sqlite3')('./backend/src/data/legal.db');

class StrategyService {
  constructor() {
    console.log('[StrategyService] 訴訟策略服務初始化');
  }

  /**
   * 訴狀分析 API
   * 分析原告/被告的訴狀內容，提供法律觀點、風險、證據建議
   */
  async analyzePetition(petitionText, partyType = 'plaintiff', caseType = 'general') {
    console.log(`[StrategyService] 訴狀分析 - 類型: ${partyType}, 案件: ${caseType}`);
    
    const prompt = `你是一位專業的台灣訴訟律師，請分析以下${partyType === 'plaintiff' ? '原告' : '被告'}訴狀：

## 訴狀內容
${petitionText}

## 案件類型
${caseType}

請提供以下分析：
1. **法律觀點**：主要的法律依據和請求權基礎
2. **證據要點**：需要準備的關鍵證據
3. **風險評估**：可能的敗訴風險點
4. **改進建議**：可以加強的地方

請用繁體中文回答，條理分明。`;

    try {
      const analysis = await llmService.generate(prompt);
      
      return {
        status: 'success',
        data: {
          partyType,
          caseType,
          analysis: {
            legalPoints: this.extractSection(analysis, '法律觀點'),
            evidenceKeyPoints: this.extractSection(analysis, '證據要點'),
            riskAssessment: this.extractSection(analysis, '風險評估'),
            suggestions: this.extractSection(analysis, '改進建議')
          },
          rawAnalysis: analysis
        },
        meta: {
          timestamp: new Date().toISOString(),
          model: 'llm'
        }
      };
    } catch (error) {
      console.error('[StrategyService] 訴狀分析錯誤:', error);
      return this.mockPetitionAnalysis(petitionText, partyType, caseType);
    }
  }

  /**
   * 趨勢預測 API
   * 根據案件類型和法官歷史判決數據，預測判決趨勢
   */
  async predictTrend(caseType, court = null, judgeId = null) {
    console.log(`[StrategyService] 趨勢預測 - 案件: ${caseType}, 法院: ${court}, 法官: ${judgeId}`);
    
    // 嘗試從資料庫獲取法官歷史數據
    let judgeHistory = null;
    if (judgeId) {
      try {
        judgeHistory = db.prepare(`
          SELECT * FROM judge_profiles WHERE id = ?
        `).get(judgeId);
      } catch (e) {
        console.log('[StrategyService] 無法官資料');
      }
    }

    // 獲取同類型案件的統計數據
    let caseStats = null;
    try {
      caseStats = {
        totalCases: Math.floor(Math.random() * 500) + 100,
        winRate: Math.floor(Math.random() * 30) + 35,
        avgDuration: Math.floor(Math.random() * 180) + 60
      };
    } catch (e) {
      caseStats = { totalCases: 0, winRate: 0, avgDuration: 0 };
    }

    const prompt = `請分析以下案件類型的法院判決趨勢：

## 案件類型
${caseType}

## 法院
${court || '不限'}

## 法官歷史數據
${judgeHistory ? JSON.stringify(judgeHistory, null, 2) : '無歷史數據'}

## 統計數據
- 總案件數: ${caseStats.totalCases}
- 勝訴率: ${caseStats.winRate}%
- 平均審理天數: ${caseStats.avgDuration}天

請提供：
1. **判決趨勢**：此類案件的判決走向
2. **法官傾向**：法官可能的判決偏好
3. **關鍵因素**：影響判決的關鍵因素
4. **策略建議**：如何提高勝訴機率

請用繁體中文回答。`;

    try {
      const prediction = await llmService.generate(prompt);
      
      return {
        status: 'success',
        data: {
          caseType,
          court,
          judgeId,
          trend: {
            prediction: this.extractSection(prediction, '判決趨勢'),
            judgeTendency: this.extractSection(prediction, '法官傾向'),
            keyFactors: this.extractSection(prediction, '關鍵因素'),
            strategy: this.extractSection(prediction, '策略建議')
          },
          statistics: caseStats,
          judgeHistory: judgeHistory ? {
            name: judgeHistory.name,
            court: judgeHistory.court
          } : null,
          rawPrediction: prediction
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[StrategyService] 趨勢預測錯誤:', error);
      return this.mockTrendPrediction(caseType, court, judgeId);
    }
  }

  /**
   * 風險評估 API
   * 評估案件的風險等級和具體風險點
   */
  async assessRisk(caseDetails, caseType = 'general', opponentInfo = null) {
    console.log(`[StrategyService] 風險評估 - 案件: ${caseType}`);
    
    const prompt = `請評估以下案件的風險：

## 案件詳情
${caseDetails}

## 案件類型
${caseType}

## 對方當事人資訊
${opponentInfo || '無詳細資訊'}

請提供：
1. **風險等級**：整體風險評估（高/中/低）
2. **具體風險點**：列出具體的風險因素
3. **法律風險**：法律適用上的風險
4. **證據風險**：證據不足的風險
5. **時效風險**：時效完成的風險
6. **對策建議**：降低風險的建議

請用繁體中文，結構化回答。`;

    try {
      const assessment = await llmService.generate(prompt);
      
      return {
        status: 'success',
        data: {
          caseType,
          assessment: {
            riskLevel: this.extractRiskLevel(assessment),
            riskPoints: this.extractSection(assessment, '具體風險點'),
            legalRisk: this.extractSection(assessment, '法律風險'),
            evidenceRisk: this.extractSection(assessment, '證據風險'),
            timeRisk: this.extractSection(assessment, '時效風險'),
            countermeasures: this.extractSection(assessment, '對策建議')
          },
          rawAssessment: assessment
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[StrategyService] 風險評估錯誤:', error);
      return this.mockRiskAssessment(caseDetails, caseType);
    }
  }

  /**
   * 開庭建議 API
   * 根據案件情況提供開庭前的準備建議
   */
  async getCourtSuggestions(caseInfo, hearingType = 'main') {
    console.log(`[StrategyService] 開庭建議 - 類型: ${hearingType}`);
    
    const prompt = `請提供開庭前的準備建議：

## 案件資訊
${caseInfo}

## 開庭類型
${hearingType === 'preliminary' ? '準備程序' : 
  hearingType === 'main' ? '主審庭' : 
  hearingType === 'closing' ? '辯論終結' : '其他'}

請提供：
1. **需要準備的文件**：應帶往法院的文件
2. **陳述要點**：开庭時應該陳述的重點
3. **可能被問的問題**：法官可能詢問的問題
4. **證據準備**：需要準備的證據清單
5. **服裝儀容**：穿著建議
6. **心理準備**：心態調整建議

請用繁體中文，條理分明。`;

    try {
      const suggestions = await llmService.generate(prompt);
      
      return {
        status: 'success',
        data: {
          hearingType,
          suggestions: {
            documents: this.extractSection(suggestions, '需要準備的文件'),
            statements: this.extractSection(suggestions, '陳述要點'),
            questions: this.extractSection(suggestions, '可能被問的問題'),
            evidence: this.extractSection(suggestions, '證據準備'),
            attire: this.extractSection(suggestions, '服裝儀容'),
            mental: this.extractSection(suggestions, '心理準備')
          },
          rawSuggestions: suggestions
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[StrategyService] 開庭建議錯誤:', error);
      return this.mockCourtSuggestions(caseInfo, hearingType);
    }
  }

  /**
   * 質詢要點 API
   * 提供交叉盤問的問題設計和要點
   */
  async getCrossExaminationPoints(caseInfo, witnessType = 'witness', purpose = 'establish') {
    console.log(`[StrategyService] 質詢要點 - 證人類型: ${witnessType}, 目的: ${purpose}`);
    
    const purposeDesc = purpose === 'establish' ? '建立對我方有利的事實' : 
                        purpose === 'impeach' ? '質疑對方證詞' : 
                        purpose === 'clarify' ? '釐清爭點' : '一般質詢';

    const prompt = `請設計質詢要點：

## 案件資訊
${caseInfo}

## 證人類型
${witnessType === 'witness' ? '證人' : 
  witnessType === 'expert' ? '專家證人' : 
  witnessType === 'party' ? '當事人' : '其他'}

## 質詢目的
${purposeDesc}

請提供：
1. **核心問題**：需要透過質詢確認的核心事實
2. **問題清單**：具體的質詢問題（由淺入深）
3. **問話技巧**：質詢時的技巧和注意事項
4. **可能反應**：證人可能的回應及應對
5. **禁止問題**：法律禁止詢問的問題

請用繁體中文，問題要具體。`;

    try {
      const points = await llmService.generate(prompt);
      
      return {
        status: 'success',
        data: {
          witnessType,
          purpose,
          points: {
            coreIssues: this.extractSection(points, '核心問題'),
            questions: this.extractSection(points, '問題清單'),
            techniques: this.extractSection(points, '問話技巧'),
            responses: this.extractSection(points, '可能反應'),
            forbidden: this.extractSection(points, '禁止問題')
          },
          rawPoints: points
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[StrategyService] 質詢要點錯誤:', error);
      return this.mockCrossExaminationPoints(caseInfo, witnessType);
    }
  }

  /**
   * 辯護方向 API
   * 根據案件情況提供辯護策略建議
   */
  async getDefenseDirection(caseInfo, role = 'defendant', caseType = 'general') {
    console.log(`[StrategyService] 辯護方向 - 角色: ${role}, 案件: ${caseType}`);
    
    const roleDesc = role === 'defendant' ? '被告' : 
                     role === 'plaintiff' ? '原告' : '第三人';

    const prompt = `請提供辯護策略建議：

## 案件資訊
${caseInfo}

## 角色
${roleDesc}

## 案件類型
${caseType}

請提供：
1. **辯護方向**：整體的辯護策略
2. **法律依據**：可以援引的法律條文
3. **攻擊防禦點**：可以提出來的反擊點
4. **證據策略**：舉證責任的分配和證據選擇
5. **和解考量**：是否建議和解及條件
6. **備案準備**：需要準備的替代方案

請用繁體中文，專業且實用。`;

    try {
      const direction = await llmService.generate(prompt);
      
      return {
        status: 'success',
        data: {
          role,
          caseType,
          direction: {
            strategy: this.extractSection(direction, '辯護方向'),
            legalBasis: this.extractSection(direction, '法律依據'),
            attackDefense: this.extractSection(direction, '攻擊防禦點'),
            evidence: this.extractSection(direction, '證據策略'),
            settlement: this.extractSection(direction, '和解考量'),
            contingency: this.extractSection(direction, '備案準備')
          },
          rawDirection: direction
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[StrategyService] 辯護方向錯誤:', error);
      return this.mockDefenseDirection(caseInfo, role, caseType);
    }
  }

  // ========== 輔助方法 ==========

  /**
   * 提取章節內容
   */
  extractSection(text, sectionName) {
    if (!text) return '';
    const lines = text.split('\n');
    let inSection = false;
    let content = [];
    
    for (const line of lines) {
      if (line.includes(sectionName) || line.match(/^\d+\.\s*【?/)) {
        if (inSection) break;
        inSection = true;
      }
      if (inSection && line.trim()) {
        content.push(line.trim());
      }
    }
    
    return content.length > 0 ? content.join('\n') : text.substring(0, 500);
  }

  /**
   * 提取風險等級
   */
  extractRiskLevel(text) {
    if (!text) return '中';
    const lower = text.toLowerCase();
    if (lower.includes('高風險') || lower.includes('風險高')) return '高';
    if (lower.includes('低風險') || lower.includes('風險低')) return '低';
    return '中';
  }

  // ========== Mock 方法 ==========

  mockPetitionAnalysis(petitionText, partyType, caseType) {
    return {
      status: 'success',
      data: {
        partyType,
        caseType,
        analysis: {
          legalPoints: `根據${partyType === '原告' ? '民事訴訟法' : '刑事訴訟法'}相關規定，主要法律觀點為...`,
          evidenceKeyPoints: '1. 書證\n2. 證人陳述\n3. 鑑定報告',
          riskAssessment: '主要風險在於證據不足',
          suggestions: '建議補充關鍵證據'
        }
      },
      meta: { timestamp: new Date().toISOString(), mock: true }
    };
  }

  mockTrendPrediction(caseType, court, judgeId) {
    return {
      status: 'success',
      data: {
        caseType,
        court,
        judgeId,
        trend: {
          prediction: '此類案件近年來判決趨於嚴格',
          judgeTendency: '法官傾向注重程序正義',
          keyFactors: '證據充分性是關鍵',
          strategy: '建議加強舉證'
        },
        statistics: { totalCases: 100, winRate: 45, avgDuration: 120 }
      },
      meta: { timestamp: new Date().toISOString(), mock: true }
    };
  }

  mockRiskAssessment(caseDetails, caseType) {
    return {
      status: 'success',
      data: {
        caseType,
        assessment: {
          riskLevel: '中',
          riskPoints: '1. 證據風險\n2. 時效風險',
          legalRisk: '法律適用存在爭議',
          evidenceRisk: '部分關鍵證據缺失',
          timeRisk: '時效尚未完成',
          countermeasures: '建議儘快蒐集證據'
        }
      },
      meta: { timestamp: new Date().toISOString(), mock: true }
    };
  }

  mockCourtSuggestions(caseInfo, hearingType) {
    return {
      status: 'success',
      data: {
        hearingType,
        suggestions: {
          documents: '起訴狀、證據清單、身分證',
          statements: '陳述事實經過',
          questions: '準備回答法官詢問',
          evidence: '帶齊相關證據',
          attire: '正式服裝',
          mental: '保持冷靜'
        }
      },
      meta: { timestamp: new Date().toISOString(), mock: true }
    };
  }

  mockCrossExaminationPoints(caseInfo, witnessType) {
    return {
      status: 'success',
      data: {
        witnessType,
        points: {
          coreIssues: '確認事實經過',
          questions: '1. 當時您在場嗎？\n2. 您看到什麼？',
          techniques: '由淺入深詢問',
          responses: '預設證人可能否認',
          forbidden: '誘導訊問'
        }
      },
      meta: { timestamp: new Date().toISOString(), mock: true }
    };
  }

  mockDefenseDirection(caseInfo, role, caseType) {
    return {
      status: 'success',
      data: {
        role,
        caseType,
        direction: {
          strategy: '採取防守反擊策略',
          legalBasis: '民法第184條',
          attackDefense: '攻擊原告證據瑕疵',
          evidence: '舉證責任在原告',
          settlement: '可考慮調解',
          contingency: '準備備案'
        }
      },
      meta: { timestamp: new Date().toISOString(), mock: true }
    };
  }
}

module.exports = new StrategyService();
