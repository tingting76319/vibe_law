/**
 * Similar Case Recommendation Service - 相似案例推薦服務
 * 向量相似度計算、相關判例推薦
 */
const { getJudgeById } = require('../../../js/graph/judges');
const mockData = require('../../data/mockData.json');

class SimilarCaseRecommendation {
  constructor() {
    this.cases = mockData.cases || [];
    // 向量維度配置
    this.vectorDimensions = {
      caseType: 5,      // 案件類型 (民事、刑事、行政、軍事、其他)
      legalIssue: 20,   // 法律爭點
      keyword: 30,      // 關鍵詞
      court: 10,        // 法院
      year: 5,          // 年度
      amount: 5,        // 標的金額
      result: 10        // 判決結果
    };
  }

  // 計算案例向量
  computeCaseVector(caseData) {
    const vector = new Array(this.getTotalDimensions()).fill(0);
    let offset = 0;

    // 1. 案件類型向量 (one-hot encoding)
    const typeMap = { '民事': 0, '刑事': 1, '行政': 2, '軍事': 3, '其他': 4 };
    const typeIdx = typeMap[caseData.JCASE] ?? 4;
    vector[offset + typeIdx] = 1;
    offset += this.vectorDimensions.caseType;

    // 2. 法律爭點向量
    const issues = this.extractIssues(caseData);
    const issueVector = this.encodeIssues(issues);
    issueVector.forEach(v => { vector[offset++] = v; });

    // 3. 關鍵詞向量
    const keywordVector = this.encodeKeywords(caseData.keywords || []);
    keywordVector.forEach(v => { vector[offset++] = v; });

    // 4. 法院向量 (簡易編碼)
    const courtScore = this.encodeCourt(caseData);
    for (let i = 0; i < this.vectorDimensions.court; i++) {
      vector[offset++] = courtScore[i] || 0;
    }

    // 5. 年度向量 (歸一化)
    const yearNorm = this.normalizeYear(caseData.JYEAR);
    for (let i = 0; i < this.vectorDimensions.year; i++) {
      vector[offset++] = (yearNorm >> i) & 1 ? 1 : 0;
    }

    // 6. 金額向量 (如果有)
    const amountNorm = this.normalizeAmount(caseData);
    for (let i = 0; i < this.vectorDimensions.amount; i++) {
      vector[offset++] = (amountNorm >> i) & 1 ? 1 : 0;
    }

    // 7. 判決結果向量
    const resultVector = this.encodeResult(caseData);
    resultVector.forEach(v => { vector[offset++] = v; });

    return vector;
  }

  // 取得總維度
  getTotalDimensions() {
    return Object.values(this.vectorDimensions).reduce((a, b) => a + b, 0);
  }

  // 提取法律爭點
  extractIssues(caseData) {
    const text = `${caseData.JTITLE} ${caseData.JFULLX?.JFULLCONTENT || ''}`.toLowerCase();
    const issues = [];

    // 侵權行為
    if (text.includes('車禍') || text.includes('過失') || text.includes('損害賠償')) {
      issues.push('侵權行為');
    }
    // 財產犯罪
    if (text.includes('侵占') || text.includes('盜竊') || text.includes('詐欺')) {
      issues.push('財產犯罪');
    }
    // 毒品犯罪
    if (text.includes('毒品') || text.includes('持有') || text.includes('施用')) {
      issues.push('毒品犯罪');
    }
    // 行政救濟
    if (text.includes('稅') || text.includes('徵收') || text.includes('處分')) {
      issues.push('行政救濟');
    }
    // 民事糾紛
    if (text.includes('離婚') || text.includes('租') || text.includes('契約')) {
      issues.push('民事糾紛');
    }
    // 智慧財產
    if (text.includes('著作') || text.includes('專利') || text.includes('營業秘密')) {
      issues.push('智慧財產');
    }
    // 婚姻家庭
    if (text.includes('監護') || text.includes('繼承') || text.includes('收養')) {
      issues.push('婚姻家庭');
    }
    // 勞動糾紛
    if (text.includes('勞動') || text.includes('工傷') || text.includes('薪資')) {
      issues.push('勞動糾紛');
    }

    return issues;
  }

  // 編碼法律爭點
  encodeIssues(issues) {
    const issueList = [
      '侵權行為', '財產犯罪', '毒品犯罪', '行政救濟', '民事糾紛',
      '智慧財產', '婚姻家庭', '勞動糾紛', '金融犯罪', '環境犯罪',
      '刑事偵查', '強制執行', '破產', '公法', '憲法',
      '國際私法', '海事法', '醫療糾紛', '建築糾紛', '保險糾紛'
    ];

    return issueList.map(issue => issues.includes(issue) ? 1 : 0);
  }

  // 編碼關鍵詞
  encodeKeywords(keywords) {
    const keywordList = [
      '車禍', '過失', '損害賠償', '侵占', '毒品', '稅務', '離婚',
      '租屋', '租金', '瑕疵', '智慧財產', '著作權', '專利', '營業秘密',
      '內線交易', '洗錢', '詐欺', '盜竊', '傷害', '殺人', '強盜',
      '監護', '繼承', '收養', '勞動', '工傷', '薪資', '資遣', '退休金'
    ];

    const keywordSet = new Set((keywords || []).map(k => k.toLowerCase()));
    return keywordList.map(k => keywordSet.has(k.toLowerCase()) ? 1 : 0);
  }

  // 編碼法院
  encodeCourt(caseData) {
    const courtText = (caseData.JCOURT || '').toLowerCase();
    const vector = new Array(this.vectorDimensions.court).fill(0);
    
    // 地方法院
    if (courtText.includes('地方法院')) {
      vector[0] = 1;
    }
    // 高等法院
    if (courtText.includes('高等法院')) {
      vector[1] = 1;
    }
    // 最高法院
    if (courtText.includes('最高法院')) {
      vector[2] = 1;
    }
    // 智慧財產法院
    if (courtText.includes('智慧財產')) {
      vector[3] = 1;
    }
    // 行政法院
    if (courtText.includes('行政法院')) {
      vector[4] = 1;
    }

    return vector;
  }

  // 歸一化年度
  normalizeYear(year) {
    const y = parseInt(year) || 105;
    // 轉換民國年
    const westernYear = y + 1911;
    // 歸一化到 0-1 (假設範圍 2000-2030)
    return (westernYear - 2000) / 30;
  }

  // 歸一化金額
  normalizeAmount(caseData) {
    // 從案例內容中嘗試提取金額
    const text = caseData.JFULLX?.JFULLCONTENT || '';
    const amountMatch = text.match(/(?:新臺幣|新台幣|NT|\$)\s*(\d+(?:,\d{3})*(?:萬|億)?)/);
    
    if (amountMatch) {
      let amount = parseInt(amountMatch[1].replace(/,/g, ''));
      if (amountMatch[0].includes('億')) amount *= 100000000;
      else if (amountMatch[0].includes('萬')) amount *= 10000;
      
      // 歸一化到 0-1 (假設範圍 0-10億)
      return Math.min(amount / 1000000000, 1);
    }
    
    return 0;
  }

  // 編碼判決結果
  encodeResult(caseData) {
    const text = (caseData.JFULLX?.JFULLCONTENT || '').toLowerCase();
    const vector = new Array(this.vectorDimensions.result).fill(0);

    // 原告/上訴人勝訴
    if (text.includes('勝訴') || text.includes('應賠償') || text.includes('準予')) {
      vector[0] = 1;
    }
    // 被告/被上訴人敗訴
    if (text.includes('敗訴') || text.includes('應負') || text.includes('判處')) {
      vector[1] = 1;
    }
    // 部分勝訴
    if (text.includes('部分') || text.includes('減輕')) {
      vector[2] = 1;
    }
    // 駁回
    if (text.includes('駁回')) {
      vector[3] = 1;
    }
    // 有期徒刑
    if (text.includes('有期徒刑')) {
      vector[4] = 1;
    }
    // 無期徒刑/死刑
    if (text.includes('無期徒刑') || text.includes('死刑')) {
      vector[5] = 1;
    }
    // 緩刑
    if (text.includes('緩刑')) {
      vector[6] = 1;
    }
    // 撤銷
    if (text.includes('撤銷')) {
      vector[7] = 1;
    }
    // 和解
    if (text.includes('和解')) {
      vector[8] = 1;
    }
    // 罰金
    if (text.includes('罰金')) {
      vector[9] = 1;
    }

    return vector;
  }

  // 計算餘弦相似度
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('向量維度必須相同');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // 歐氏距離
  euclideanDistance(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('向量維度必須相同');
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      sum += Math.pow(vec1[i] - vec2[i], 2);
    }

    return Math.sqrt(sum);
  }

  // 查找相似案例
  findSimilarCases(queryCase, options = {}) {
    const {
      topK = 10,
      judgeId = null,
      minSimilarity = 0.1,
      yearRange = null,
      caseType = null
    } = options;

    // 計算查詢案例向量
    const queryVector = this.computeCaseVector(queryCase);

    // 過濾候選案例
    let candidates = [...this.cases];

    // 按法官過濾
    if (judgeId) {
      const judge = getJudgeById(judgeId);
      if (judge) {
        candidates = candidates.filter(c => {
          const caseText = `${c.JTITLE} ${c.JFULLX?.JFULLCONTENT || ''}`.toLowerCase();
          return judge.specialty?.some(s => 
            caseText.includes(s.toLowerCase()) ||
            (c.keywords || []).some(k => k.toLowerCase().includes(s.toLowerCase()))
          );
        });
      }
    }

    // 按年度範圍過濾
    if (yearRange) {
      const { start, end } = yearRange;
      candidates = candidates.filter(c => {
        const year = parseInt(c.JYEAR) + 1911;
        return year >= start && year <= end;
      });
    }

    // 按案件類型過濾
    if (caseType) {
      candidates = candidates.filter(c => c.JCASE === caseType);
    }

    // 計算相似度
    const results = candidates.map(c => {
      const caseVector = this.computeCaseVector(c);
      const similarity = this.cosineSimilarity(queryVector, caseVector);
      const distance = this.euclideanDistance(queryVector, caseVector);

      return {
        case: c,
        similarity,
        distance,
        vector: caseVector
      };
    });

    // 排序並過濾
    return results
      .filter(r => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(r => this.formatSimilarCase(r, queryCase));
  }

  // 格式化相似案例輸出
  formatSimilarCase(result, queryCase) {
    const c = result.case;
    
    return {
      id: c.JID,
      title: c.JTITLE,
      year: c.JYEAR,
      caseType: c.JCASE,
      date: c.JDATE,
      summary: c.JFULLX?.JFULLCONTENT?.substring(0, 300) || '',
      keywords: c.keywords || [],
      relatedLaws: c.relatedLaws || [],
      similarity: {
        score: result.similarity,
        distance: result.distance,
        percentage: (result.similarity * 100).toFixed(1) + '%'
      },
      matchDetails: this.getMatchDetails(queryCase, c)
    };
  }

  // 取得匹配詳情
  getMatchDetails(queryCase, targetCase) {
    const details = [];

    // 案件類型匹配
    if (queryCase.JCASE === targetCase.JCASE) {
      details.push('案件類型相同');
    }

    // 關鍵詞匹配
    const queryKeywords = new Set((queryCase.keywords || []).map(k => k.toLowerCase()));
    const targetKeywords = new Set((targetCase.keywords || []).map(k => k.toLowerCase()));
    const matchingKeywords = [...queryKeywords].filter(k => targetKeywords.has(k));
    
    if (matchingKeywords.length > 0) {
      details.push(`共同關鍵詞：${matchingKeywords.join('、')}`);
    }

    // 法條匹配
    const queryLaws = new Set(queryCase.relatedLaws || []);
    const targetLaws = new Set(targetCase.relatedLaws || []);
    const matchingLaws = [...queryLaws].filter(l => targetLaws.has(l));
    
    if (matchingLaws.length > 0) {
      details.push(`相關法條：${matchingLaws.join('、')}`);
    }

    return details;
  }

  // 批量相似度計算（用於推薦系統）
  computeSimilarityMatrix(cases = null) {
    const caseList = cases || this.cases;
    const matrix = [];

    for (let i = 0; i < caseList.length; i++) {
      const row = [];
      const vec1 = this.computeCaseVector(caseList[i]);

      for (let j = 0; j < caseList.length; j++) {
        if (i === j) {
          row.push(1.0); // 自身相似度為 1
        } else {
          const vec2 = this.computeCaseVector(caseList[j]);
          row.push(this.cosineSimilarity(vec1, vec2));
        }
      }

      matrix.push(row);
    }

    return {
      matrix,
      cases: caseList.map((c, i) => ({ index: i, id: c.JID, title: c.JTITLE }))
    };
  }

  // 取得最相似案例群組
  getCaseClusters(minSimilarity = 0.5) {
    const similarityMatrix = this.computeSimilarityMatrix();
    const clusters = [];
    const assigned = new Set();

    for (let i = 0; i < similarityMatrix.matrix.length; i++) {
      if (assigned.has(i)) continue;

      const cluster = [i];
      assigned.add(i);

      for (let j = i + 1; j < similarityMatrix.matrix.length; j++) {
        if (!assigned.has(j) && similarityMatrix.matrix[i][j] >= minSimilarity) {
          cluster.push(j);
          assigned.add(j);
        }
      }

      if (cluster.length > 1) {
        clusters.push({
          clusterId: clusters.length + 1,
          cases: cluster.map(idx => ({
            index: idx,
            ...similarityMatrix.cases[idx]
          })),
          size: cluster.length
        });
      }
    }

    return clusters;
  }

  // 搜尋相關判例
  searchRelatedCases(query, options = {}) {
    // 解析查詢
    const queryFeatures = {
      JID: 'QUERY',
      JTITLE: query,
      JCASE: options.caseType || '民事',
      JYEAR: options.year || '105',
      JDATE: new Date().toISOString().split('T')[0],
      JFULLX: { JFULLCONTENT: query },
      keywords: options.keywords || this.extractKeywordsFromQuery(query),
      relatedLaws: options.relatedLaws || []
    };

    return this.findSimilarCases(queryFeatures, options);
  }

  // 從查詢中提取關鍵詞
  extractKeywordsFromQuery(query) {
    const commonKeywords = [
      '車禍', '過失', '損害賠償', '侵占', '毒品', '稅務', '離婚',
      '租屋', '租金', '瑕疵', '智慧財產', '著作權', '專利', '內線交易',
      '洗錢', '詐欺', '傷害', '監護', '繼承', '勞動', '工傷'
    ];

    return commonKeywords.filter(k => query.toLowerCase().includes(k.toLowerCase()));
  }
}

module.exports = new SimilarCaseRecommendation();
