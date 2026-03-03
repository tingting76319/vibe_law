/**
 * Judgment Document Processing Service - 判決書資料處理服務 v0.4
 * 處理、解析、和結構化判決書資料
 */

const mockData = require('../../data/mockData.json');
const KeywordExtractionService = require('./keywordExtractionService');

class JudgmentDocumentService {
  constructor() {
    this.cases = mockData.cases || [];
  }

  // 解析判決書文本
  parseJudgment(text) {
    const result = {
      // 基本資訊
      caseNumber: null,
      court: null,
      date: null,
      judge: null,
      clerk: null,
      
      // 案件資訊
      caseType: null,
      parties: {
        plaintiff: null,
        defendant: null,
        appellant: null,
        appelle: null
      },
      
      // 案件內容
      subject: null,
      claims: [],
      defenses: [],
      
      // 法律依據
      relatedLaws: [],
      
      // 判決結果
      judgment: {
        result: null,
        details: [],
        amount: null,
        imprisonment: null,
        fine: null,
        probation: null
      },
      
      // 關鍵詞
      keywords: [],
      
      // 原始文本
      rawText: text,
      processedText: ''
    };

    // 解析案件編號
    result.caseNumber = this.extractCaseNumber(text);
    
    // 解析法院
    result.court = this.extractCourt(text);
    
    // 解析日期
    result.date = this.extractDate(text);
    
    // 解析當事人
    result.parties = this.extractParties(text);
    
    // 解析案件類型
    result.caseType = this.extractCaseType(text);
    
    // 解析當事人主張
    const claimsAndDefenses = this.extractClaimsAndDefenses(text);
    result.claims = claimsAndDefenses.claims;
    result.defenses = claimsAndDefenses.defenses;
    
    // 解析相關法條
    result.relatedLaws = this.extractLaws(text);
    
    // 解析判決結果
    result.judgment = this.extractJudgmentResult(text);
    
    // 提取關鍵詞
    result.keywords = KeywordExtractionService.extractKeywords(text, {
      maxKeywords: 15
    });

    // 清理文本
    result.processedText = this.cleanText(text);

    return result;
  }

  // 提取案件編號
  extractCaseNumber(text) {
    // 匹配格式: 105年度民事字第1234號
    const patterns = [
      /(\d{3})\s*年\s*([^\s]+?)\s*字\s*第(\d+)\s*號/,
      /(\d{3})\s*年度?\s*([^\s]+?)\s*第(\d+)\s*號/,
      /([^\s]+?)\s*字\s*第(\d+)\s*號/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          year: match[1] ? (parseInt(match[1]) + 1911).toString() : null,
          type: match[match.length - 2] || null,
          number: match[match.length - 1] || null,
          full: match[0]
        };
      }
    }
    return null;
  }

  // 提取法院
  extractCourt(text) {
    const courtPatterns = [
      /([^法院]+)法院/,
      /(最高法院|高等法院|地方法院|行政法院|智慧財產法院)/,
      /([^縣市]+(?:地方法院|高等法院|最高法院))/
    ];

    for (const pattern of courtPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    return null;
  }

  // 提取日期
  extractDate(text) {
    // 匹配各種日期格式
    const patterns = [
      /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
      /(\d{3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
      /(\d{4})-(\d{2})-(\d{2})/,
      /(\d{4})\/(\d{2})\/(\d{2})/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let year = parseInt(match[1]);
        if (year < 1911) year += 1911; // 轉換民國年
        
        return {
          year: year.toString(),
          month: match[2].padStart(2, '0'),
          day: match[3].padStart(2, '0'),
          formatted: `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`,
          rocYear: (year - 1911).toString()
        };
      }
    }
    return null;
  }

  // 提取當事人
  extractParties(text) {
    const parties = {
      plaintiff: null,
      defendant: null,
      appellant: null,
      appelle: null
    };

    // 原告
    const plaintiffPatterns = [
      /原告[：:]\s*([^\n]{2,30})(?:，|。|$)/,
      /上訴人[（]([^）]+)[）](?:即原告)?[：:]\s*([^\n]{2,30})/
    ];
    
    for (const pattern of plaintiffPatterns) {
      const match = text.match(pattern);
      if (match) {
        parties.plaintiff = match[1] || match[2];
        break;
      }
    }

    // 被告
    const defendantPatterns = [
      /被告[：:]\s*([^\n]{2,30})(?:，|。|$)/,
      /被上訴人[（]([^）]+)[）](?:即被告)?[：:]\s*([^\n]{2,30})/
    ];
    
    for (const pattern of defendantPatterns) {
      const match = text.match(pattern);
      if (match) {
        parties.defendant = match[1] || match[2];
        break;
      }
    }

    // 上訴人/被上訴人
    const appellantMatch = text.match(/上訴人[：:]\s*([^\n]{2,30})/);
    if (appellantMatch) parties.appellant = appellantMatch[1];
    
    const appelleMatch = text.match(/被上訴人[：:]\s*([^\n]{2,30})/);
    if (appelleMatch) parties.appelle = appelleMatch[1];

    return parties;
  }

  // 提取案件類型
  extractCaseType(text) {
    const typePatterns = [
      { type: '民事', keywords: ['民事', '民事訴訟', '民事判決', '民事糾紛'] },
      { type: '刑事', keywords: ['刑事', '刑事訴訟', '刑事判決', '刑事案件'] },
      { type: '行政', keywords: ['行政', '行政訴訟', '行政處分'] },
      { type: '智慧財產', keywords: ['智慧財產', '專利', '著作權', '商標'] },
      { type: '勞動', keywords: ['勞動', '勞動契約', '勞資'] },
      { type: '少年', keywords: ['少年', '少年法院'] },
      { type: '海商', keywords: ['海商', '海事'] }
    ];

    for (const { type, keywords } of typePatterns) {
      if (keywords.some(k => text.includes(k))) {
        return type;
      }
    }
    return '其他';
  }

  // 提取主張和抗辯
  extractClaimsAndDefenses(text) {
    const claims = [];
    const defenses = [];

    // 原告主張
    const claimPatterns = [
      /原告主張[：:]\s*([^\n]{10,200})/g,
      /原告訴稱[：:]\s*([^\n]{10,200})/g,
      /原告略以[：:]\s*([^\n]{10,200})/g
    ];

    for (const pattern of claimPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        claims.push(match[1].trim());
      }
    }

    // 被告抗辯
    const defensePatterns = [
      /被告抗辯[：:]\s*([^\n]{10,200})/g,
      /被告辯稱[：:]\s*([^\n]{10,200})/g,
      /被告略以[：:]\s*([^\n]{10,200})/g,
      /被告則謂[：:]\s*([^\n]{10,200})/g
    ];

    for (const pattern of defensePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        defenses.push(match[1].trim());
      }
    }

    return { claims, defenses };
  }

  // 提取法條
  extractLaws(text) {
    // 匹配法條格式
    const lawPatterns = [
      /(?:民法|刑法|刑事訴訟法|民事訴訟法|行政訴訟法|行政程序法|強制執行法|破產法|公司法|票據法|銀行法|證券交易法|保險法|勞動基準法|著作權法|專利法|商標法|營業秘密法|毒品危害防制條例|洗錢防制法|個人資料保護法)\s*第?\s*[\d零一二三四五六七八九十百千]+條(?:\s*之[\d零一二三四五六七八九十百千]+)?/g,
      /第\s*(\d+)\s*條(?:\s*之\s*(\d+))?/g
    ];

    const laws = new Set();

    // 精確匹配
    const preciseMatch = text.match(lawPatterns[0]);
    if (preciseMatch) {
      preciseMatch.forEach(l => laws.add(l));
    }

    // 通用匹配
    let match;
    const generalPattern = lawPatterns[1];
    let lastIndex = 0;
    
    // 找到前面的法律名稱
    const lawNames = ['民法', '刑法', '刑訴', '民訴', '行政法', '公司法', '保險法'];
    
    while ((match = generalPattern.exec(text)) !== null) {
      // 檢查前面的上下文
      const start = Math.max(0, match.index - 15);
      const context = text.substring(start, match.index);
      
      if (lawNames.some(l => context.includes(l))) {
        laws.add(match[0]);
      }
    }

    return Array.from(laws);
  }

  // 提取判決結果
  extractJudgmentResult(text) {
    const result = {
      result: null,
      details: [],
      amount: null,
      imprisonment: null,
      fine: null,
      probation: null
    };

    // 判決結果關鍵詞
    const resultKeywords = [
      { keyword: '準予離婚', result: '準予離婚' },
      { keyword: '判處有期徒刑', result: '有期徒刑' },
      { keyword: '判處罰金', result: '罰金' },
      { keyword: '緩刑', result: '緩刑' },
      { keyword: '應賠償', result: '應賠償' },
      { keyword: '駁回', result: '駁回' },
      { keyword: '撤銷原判決', result: '撤銷' },
      { keyword: '無罪', result: '無罪' },
      { keyword: '有罪', result: '有罪' },
      { keyword: '和解', result: '和解' }
    ];

    for (const { keyword, result: r } of resultKeywords) {
      if (text.includes(keyword)) {
        result.result = r;
        result.details.push(keyword);
      }
    }

    // 提取金額
    const amountPatterns = [
      /新臺幣\s*(\d+(?:,\d{3})*(?:萬|億)?)\s*元/,
      /新台幣\s*(\d+(?:,\d{3})*(?:萬|億)?)\s*元/,
      /NT\$\s*(\d+(?:,\d{3})*)/,
      /(\d+(?:,\d{3})*(?:萬|億)?)\s*元/
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        let amount = match[1].replace(/,/g, '');
        if (match[0].includes('億')) amount = parseInt(amount) * 100000000;
        else if (match[0].includes('萬')) amount = parseInt(amount) * 10000;
        
        result.amount = parseInt(amount);
        break;
      }
    }

    // 提取有期徒刑
    const imprisonmentMatch = text.match(/有期徒刑\s*(\d+)\s*年\s*(\d+)\s*個月?/);
    if (imprisonmentMatch) {
      result.imprisonment = {
        years: parseInt(imprisonmentMatch[1]),
        months: parseInt(imprisonmentMatch[2])
      };
    } else {
      const simpleImprisonment = text.match(/有期徒刑\s*(\d+)\s*(?:年|個月)/);
      if (simpleImprisonment) {
        result.imprisonment = simpleImprisonment[1].includes('年') 
          ? { years: parseInt(simpleImprisonment[1]), months: 0 }
          : { years: 0, months: parseInt(simpleImprisonment[1]) };
      }
    }

    // 提取罰金
    const fineMatch = text.match(/罰金\s*新臺幣\s*(\d+(?:,\d{3})*)\s*元/);
    if (fineMatch) {
      result.fine = parseInt(fineMatch[1].replace(/,/g, ''));
    }

    // 提取緩刑
    const probationMatch = text.match(/緩刑\s*(\d+)\s*年/);
    if (probationMatch) {
      result.probation = {
        years: parseInt(probationMatch[1])
      };
    }

    return result;
  }

  // 清理文本
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\n\r]+/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .substring(0, 10000); // 限制長度
  }

  // 處理批量案例
  processBatch(cases) {
    return cases.map(c => ({
      ...c,
      parsed: this.parseJudgment(c.JFULLX?.JFULLCONTENT || c.JABSTRACT || '')
    }));
  }

  // 結構化輸出
  toStructuredFormat(caseData) {
    const parsed = this.parseJudgment(caseData.JFULLX?.JFULLCONTENT || caseData.JABSTRACT || '');
    
    return {
      metadata: {
        id: caseData.JID,
        year: parsed.date?.rocYear || caseData.JYEAR,
        caseType: parsed.caseType || caseData.JCASE,
        caseNumber: parsed.caseNumber?.full || caseData.JNO,
        court: parsed.court || caseData.JCOURT,
        date: parsed.date?.formatted || caseData.JDATE
      },
      parties: parsed.parties,
      subject: parsed.subject,
      claims: parsed.claims,
      defenses: parsed.defenses,
      relatedLaws: parsed.relatedLaws,
      judgment: parsed.judgment,
      keywords: parsed.keywords,
      originalData: {
        title: caseData.JTITLE,
        fullContent: caseData.JFULLX?.JFULLCONTENT || '',
        existingKeywords: caseData.keywords || [],
        existingLaws: caseData.relatedLaws || []
      }
    };
  }

  // 驗證判決書
  validateJudgment(caseData) {
    const issues = [];
    const text = caseData.JFULLX?.JFULLCONTENT || caseData.JABSTRACT || '';

    if (!text || text.length < 50) {
      issues.push('判決書內容過短');
    }

    if (!caseData.JTITLE) {
      issues.push('缺少案件標題');
    }

    if (!caseData.JDATE) {
      issues.push('缺少判決日期');
    }

    if (!caseData.JCASE) {
      issues.push('缺少案件類型');
    }

    // 檢查是否有任何當事人資訊
    const hasParties = /原告|被告|上訴人|被上訴人/.test(text);
    if (!hasParties) {
      issues.push('缺少當事人資訊');
    }

    // 檢查是否有判決結果
    const hasResult = /判處|判決|準予|駁回/.test(text);
    if (!hasResult) {
      issues.push('缺少判決結果');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = new JudgmentDocumentService();
