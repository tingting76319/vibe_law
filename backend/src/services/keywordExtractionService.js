/**
 * Keyword Extraction Service - 關鍵字萃取服務 v0.4
 * 從判決書中自動萃取關鍵詞
 */

const mockData = require('../../data/mockData.json');

class KeywordExtractionService {
  constructor() {
    this.cases = mockData.cases || [];
    
    // 法律領域專用關鍵詞庫
    this.legalKeywords = this.buildLegalKeywordBank();
    
    // TF-IDF 計算所需的文檔頻率
    this.documentFrequencies = this.calculateDocumentFrequencies();
  }

  // 建立法律關鍵詞庫
  buildLegalKeywordBank() {
    return {
      // 案件類型關鍵詞
      caseType: {
        '民事': ['民事', '民事訴訟', '民事法院', '民事判決', '民事糾紛', '民事責任'],
        '刑事': ['刑事', '刑事訴訟', '刑事法院', '刑事判決', '刑事案件', '犯罪', '判處'],
        '行政': ['行政', '行政訴訟', '行政法院', '行政處分', '行政救濟', '行政行為'],
        '智慧財產': ['智慧財產', '智慧財產法院', '專利', '著作權', '商標', '營業秘密'],
        '勞動': ['勞動', '勞動訴訟', '勞動契約', '勞資糾紛', '工會', '勞基法'],
        '海商': ['海商', '海商法', '船舶', '航海', '海難', '海事'],
        '少年': ['少年', '少年法院', '少年事件', '少年保護']
      },
      
      // 法律爭點關鍵詞
      legalIssue: {
        '侵權行為': ['侵權', '侵權行為', '損害賠償', '過失', '過失責任', '注意義務', '因果關係'],
        '財產犯罪': ['侵占', '盜竊', '詐欺', '竊盜', '搶奪', '強盜', '財產'],
        '毒品犯罪': ['毒品', '持有毒品', '施用毒品', '販賣毒品', '製毒', '運毒'],
        '暴力犯罪': ['傷害', '殺人', '毀損', '恐嚇', '脅迫', '強暴', '猥褻'],
        '金融犯罪': ['內線交易', '洗錢', '違反證券交易法', '銀行法', '掏空', '背信'],
        '行政救濟': ['行政處分', '撤銷', '變更', '課稅', '裁罰', '許可', '核准'],
        '民事糾紛': ['合約', '契約', '債務', '糾紛', '爭議', '調解', '和解'],
        '婚姻家庭': ['離婚', '繼承', '收養', '監護', '撫養', '親權', '家暴'],
        '勞動糾紛': ['勞動契約', '薪資', '資遣', '退休金', '工傷', '職業災害', '勞基法'],
        '智慧財產權': ['著作權', '專利', '商標', '營業秘密', '侵權', '授權']
      },
      
      // 法律術語關鍵詞
      legalTerm: {
        '當事人': ['原告', '被告', '上訴人', '被上訴人', '告訴人', '嫌疑人', '被害人'],
        '程序': ['起訴', '上訴', '抗告', '再審', '非常上訴', '聲請', '申訴'],
        '判決結果': ['勝訴', '敗訴', '駁回', '準予', '撤銷', '發回', '和解', '調解'],
        '刑罰': ['有期徒刑', '無期徒刑', '死刑', '罰金', '緩刑', '易科罰金', '沒收'],
        '民事責任': ['賠償', '補償', '回復原狀', '金錢賠償', '精神慰撫金'],
        '證據': ['證據', '證人', '證物', '筆錄', '鑑定', '勘驗', '調查'],
        '強制執行': ['強制執行', '假扣押', '假處分', '查封', '拍賣', '執行']
      },
      
      // 法條類型關鍵詞
      lawType: {
        '民法': ['民法', '第184條', '第185條', '第213條', '第216條', '第195條'],
        '刑法': ['刑法', '第271條', '第320條', '第335條', '第339條', '第185條'],
        '刑事訴訟法': ['刑訴', '刑事訴訟法', '起訴', '公訴', '自訴'],
        '民事訴訟法': ['民訴', '民事訴訟法', '舉證責任', '證據保全'],
        '行政法': ['行政法', '行政程序法', '行政訴訟法', '訴願法']
      }
    };
  }

  // 計算文檔頻率 (用於TF-IDF)
  calculateDocumentFrequencies() {
    const df = {};
    const totalDocs = this.cases.length;
    
    // 收集所有關鍵詞
    const allKeywords = new Set();
    Object.values(this.legalKeywords).forEach(category => {
      Object.values(category).forEach(keywords => {
        keywords.forEach(k => allKeywords.add(k));
      });
    });
    
    // 計算每個詞的文檔頻率
    allKeywords.forEach(keyword => {
      df[keyword] = this.cases.filter(c => {
        const text = `${c.JTITLE} ${c.JFULLX?.JFULLCONTENT || ''} ${c.keywords?.join(' ') || ''}`;
        return text.includes(keyword);
      }).length;
    });
    
    return { df, totalDocs };
  }

  // 提取關鍵詞（主要方法）
  extractKeywords(textOrCase, options = {}) {
    const {
      maxKeywords = 20,
      minScore = 0.1,
      useTFIDF = true,
      includeCaseType = true,
      includeLegalIssues = true,
      includeLegalTerms = true,
      includeLawType = true
    } = options;

    const text = typeof textOrCase === 'string' 
      ? textOrCase 
      : `${textOrCase.JTITLE} ${textOrCase.JFULLX?.JFULLCONTENT || ''}`;

    const results = [];
    const categories = [];
    
    if (includeCaseType) categories.push('caseType');
    if (includeLegalIssues) categories.push('legalIssue');
    if (includeLegalTerms) categories.push('legalTerm');
    if (includeLawType) categories.push('lawType');

    // 計算TF
    const tf = this.calculateTermFrequency(text);
    
    // 計算IDF（如果使用TF-IDF）
    const idf = useTFIDF ? this.calculateInverseDocumentFrequency() : {};

    // 遍歷各類別關鍵詞
    for (const category of categories) {
      const categoryKeywords = this.legalKeywords[category];
      
      for (const [label, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
          const termFreq = tf[keyword] || 0;
          
          if (termFreq > 0) {
            let score = termFreq;
            
            // 應用IDF權重
            if (useTFIDF && idf[keyword] !== undefined) {
              score = termFreq * idf[keyword];
            }
            
            // 類別權重
            const categoryWeights = {
              caseType: 1.5,
              legalIssue: 2.0,
              legalTerm: 1.2,
              lawType: 1.0
            };
            score *= categoryWeights[category] || 1.0;
            
            // 標題權重
            if (textOrCase.JTITLE?.includes(keyword)) {
              score *= 1.5;
            }
            
            results.push({
              keyword,
              label,
              category,
              score: parseFloat(score.toFixed(4)),
              frequency: termFreq
            });
          }
        }
      }
    }

    // 排序並返回結果
    return results
      .sort((a, b) => b.score - a.score)
      .filter((r, idx, arr) => {
        // 去重，保留最高分
        const firstIdx = arr.findIndex(x => x.keyword === r.keyword);
        return firstIdx === idx;
      })
      .filter(r => r.score >= minScore)
      .slice(0, maxKeywords);
  }

  // 計算詞頻 (Term Frequency)
  calculateTermFrequency(text) {
    const tf = {};
    const words = text.split(/[\s,，.。;；!！?？]+/).filter(Boolean);
    const totalWords = words.length;
    
    if (totalWords === 0) return tf;
    
    // 統計詞頻
    words.forEach(word => {
      tf[word] = (tf[word] || 0) + 1;
    });
    
    // 正規化
    Object.keys(tf).forEach(key => {
      tf[key] = tf[key] / totalWords;
    });
    
    return tf;
  }

  // 計算逆文檔頻率 (Inverse Document Frequency)
  calculateInverseDocumentFrequency() {
    const { df, totalDocs } = this.documentFrequencies;
    const idf = {};
    
    Object.keys(df).forEach(term => {
      // 平滑IDF，避免除以零
      idf[term] = Math.log((totalDocs + 1) / (df[term] + 1)) + 1;
    });
    
    return idf;
  }

  // 從案例中提取關鍵詞
  extractFromCase(caseData, options = {}) {
    const {
      maxKeywords = 20,
      includeExisting = true
    } = options;

    // 合併現有關鍵詞和新提取的關鍵詞
    const results = this.extractKeywords(caseData, { ...options, maxKeywords: maxKeywords * 2 });

    let finalResults = [...results];

    // 添加現有關鍵詞（如果存在）
    if (includeExisting && caseData.keywords) {
      const existingKeywords = caseData.keywords.map(k => ({
        keyword: k,
        label: 'existing',
        category: 'existing',
        score: 1.0,
        frequency: 1,
        isExisting: true
      }));
      
      // 合併並去重
      const existingSet = new Set(results.map(r => r.keyword));
      const newExisting = existingKeywords.filter(k => !existingSet.has(k.keyword));
      finalResults = [...results, ...newExisting];
    }

    return finalResults
      .sort((a, b) => b.score - a.score)
      .slice(0, maxKeywords);
  }

  // 批量提取關鍵詞
  extractBatch(cases, options = {}) {
    return cases.map(c => ({
      caseId: c.JID,
      title: c.JTITLE,
      keywords: this.extractFromCase(c, options)
    }));
  }

  // 提取法律爭點
  extractLegalIssues(textOrCase) {
    const keywords = this.extractKeywords(textOrCase, {
      includeCaseType: false,
      includeLegalIssues: true,
      includeLegalTerms: false,
      includeLawType: false,
      maxKeywords: 10
    });
    
    return [...new Set(keywords.map(k => k.label))];
  }

  // 提取相關法條
  extractRelatedLaws(textOrCase) {
    const text = typeof textOrCase === 'string' 
      ? textOrCase 
      : `${textOrCase.JTITLE} ${textOrCase.JFULLX?.JFULLCONTENT || ''}`;

    const lawPattern = /(?:民法|刑法|刑事訴訟法|民事訴訟法|行政訴訟法|行政程序法|強制執行法|破產法|公司法|票據法|銀行法|證券交易法|保險法|勞動基準法|勞工保險條例|全民健康保險法|稅捐稽徵法|關稅法|海關緝私條例|智慧財產權法|著作權法|專利法|商標法|營業秘密法|毒品危害防制條例|槍械管制條例|洗錢防制法|資恐防制法|家庭教育法|少年事件處理法|兒童及少年福利與權益保障法|家庭暴力防治法|性侵害犯罪防治法|身心障礙者權益保障法|老人福利法|社會福利法|環境基本法|水污染防治法|空氣污染防治法|廢棄物清理法|毒性化學物質管理法|核子事故緊急應變法|建築法|都市計畫法|土地徵收條例|平均地權條例|耕地三七五減租條例|農地重劃條例|山坡地保育利用條例|國家公園法|文化資產保存法|古蹟保存法|歷史建築保護法|家庭教育法|全民國防教育法|兵役法|軍人撫卹條例|國防法|國家安全法|個人資料保護法|電子簽章法|消保法|公平交易法|著作權法)\s*第?\s*[\d零一二三四五六七八九十百千]+條(?:\s*之[\d零一二三四五六七八九十百千]+)?/g;
    
    const matches = text.match(lawPattern) || [];
    
    // 去重並返回
    return [...new Set(matches)];
  }

  // 獲取關鍵詞庫統計
  getKeywordBankStats() {
    let total = 0;
    const stats = {};
    
    for (const [category, labels] of Object.entries(this.legalKeywords)) {
      stats[category] = {};
      for (const [label, keywords] of Object.entries(labels)) {
        stats[category][label] = keywords.length;
        total += keywords.length;
      }
    }
    
    return {
      ...stats,
      total,
      documents: this.documentFrequencies.totalDocs
    };
  }
}

module.exports = new KeywordExtractionService();
