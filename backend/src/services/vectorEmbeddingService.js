/**
 * Vector Embedding Service - 向量嵌入服務 v0.4
 * 在應用層計算向量嵌入和相似度
 * 不依賴外部向量數據庫
 */

const mockData = require('../../data/mockData.json');

class VectorEmbeddingService {
  constructor() {
    this.cases = mockData.cases || [];
    this.embeddingCache = new Map();
    this.dimensions = 384; // Default embedding dimension
    
    // 法律領域專用詞彙表
    this.legalVocabulary = this.buildLegalVocabulary();
    
    // 詞向量模型 (簡化版 - 使用詞袋模型)
    this.wordVectors = this.buildWordVectors();
  }

  // 建立法律詞彙表
  buildLegalVocabulary() {
    return {
      // 案件類型
      caseTypes: ['民事', '刑事', '行政', '軍事', '智慧財產', '勞動', '海商', '少年'],
      
      // 法律爭點
      legalIssues: [
        '侵權行為', '損害賠償', '合約糾紛', '離婚', '繼承', '監護',
        '毒品犯罪', '財產犯罪', '暴力犯罪', '經濟犯罪', '貪污瀆職',
        '行政救濟', '稅務爭議', '土地徵收', '環境保護',
        '智慧財產', '著作權', '專利', '營業秘密',
        '勞動糾紛', '工傷', '薪資', '資遣', '退休金',
        '金融犯罪', '內線交易', '洗錢', '信用卡詐欺'
      ],
      
      // 法律術語
      legalTerms: [
        '原告', '被告', '上訴人', '被上訴人', '告訴人', '被告',
        '判決', '裁定', '調解', '和解', '撤銷', '駁回', '準予',
        '勝訴', '敗訴', '部分勝訴', '緩刑', '有期徒刑', '無期徒刑', '死刑',
        '罰金', '沒收', '緩起訴', '不起訴', '不起訴處分',
        '舉證責任', '證據力', '證明力', '自由心證',
        '民法', '刑法', '行政法', '憲法', '商事法',
        '強制執行', '假扣押', '假處分', '保全程序'
      ],
      
      // 法院
      courts: [
        '地方法院', '高等法院', '最高法院', '智慧財產法院', '行政法院',
        '最高行政法院', '公務人員懲戒委員會', '少年及家事法院'
      ]
    };
  }

  // 建立詞向量
  buildWordVectors() {
    const vectors = {};
    const vocabulary = [
      ...this.legalVocabulary.caseTypes,
      ...this.legalVocabulary.legalIssues,
      ...this.legalVocabulary.legalTerms,
      ...this.legalVocabulary.courts
    ];
    
    // 使用簡單的隨機向量（實際應使用預訓練模型）
    vocabulary.forEach((word, idx) => {
      vectors[word] = this.generateRandomVector(this.dimensions, idx);
    });
    
    return vectors;
  }

  // 生成隨機向量（基於seed確保一致性）
  generateRandomVector(dimensions, seed) {
    const vector = new Array(dimensions).fill(0);
    // 簡單的hash seed
    const random = this.seededRandom(seed);
    
    for (let i = 0; i < dimensions; i++) {
      vector[i] = (random() * 2) - 1; // -1 到 1
    }
    
    // L2正規化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map(v => v / norm);
  }

  // 簡單的 seeded random
  seededRandom(seed) {
    let s = seed + 1;
    return function() {
      s = Math.sin(s * 9999) * 10000;
      return s - Math.floor(s);
    };
  }

  // 文本向量化
  async embedText(text) {
    if (!text) return new Array(this.dimensions).fill(0);
    
    const cacheKey = text.substring(0, 100);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    const words = this.tokenize(text);
    let embedding = new Array(this.dimensions).fill(0);
    let count = 0;

    // 詞袋模型 + 詞向量平均
    for (const word of words) {
      // 精確匹配
      if (this.wordVectors[word]) {
        for (let i = 0; i < this.dimensions; i++) {
          embedding[i] += this.wordVectors[word][i];
        }
        count++;
      } else {
        // 部分匹配
        for (const [vocabWord, vector] of Object.entries(this.wordVectors)) {
          if (vocabWord.includes(word) || word.includes(vocabWord)) {
            for (let i = 0; i < this.dimensions; i++) {
              embedding[i] += vector[i] * 0.5; // 部分匹配權重較低
            }
            count += 0.5;
          }
        }
      }
    }

    if (count > 0) {
      embedding = embedding.map(v => v / count);
    }

    // L2正規化
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      embedding = embedding.map(v => v / norm);
    }

    this.embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  // 分詞
  tokenize(text) {
    // 簡單的中文分詞
    const tokens = [];
    const patterns = [
      ...this.legalVocabulary.caseTypes,
      ...this.legalVocabulary.legalIssues,
      ...this.legalVocabulary.legalTerms,
      ...this.legalVocabulary.courts
    ];
    
    let remaining = text;
    while (remaining.length > 0) {
      let matched = false;
      
      // 嘗試匹配詞彙表中的詞
      for (const pattern of patterns) {
        if (remaining.startsWith(pattern)) {
          tokens.push(pattern);
          remaining = remaining.substring(pattern.length);
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        // 取一個字符
        if (remaining.length > 0) {
          tokens.push(remaining[0]);
          remaining = remaining.substring(1);
        }
      }
    }
    
    // 過濾停用詞
    const stopWords = ['的', '了', '在', '是', '和', '與', '及', '或', '等', '之'];
    return tokens.filter(t => !stopWords.includes(t) && t.trim().length > 0);
  }

  // 案例向量化
  async embedCase(caseData) {
    const texts = [
      caseData.JTITLE,
      caseData.JFULLX?.JFULLCONTENT || '',
      caseData.JABSTRACT || '',
      ...(caseData.keywords || [])
    ].filter(Boolean);

    const combinedText = texts.join(' ');
    return this.embedText(combinedText);
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

  // 計算歐氏距離
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

  // 計算點積
  dotProduct(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('向量維度必須相同');
    }

    return vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
  }

  // 批量向量化
  async embedCases(cases) {
    const embeddings = [];
    for (const caseData of cases) {
      const embedding = await this.embedCase(caseData);
      embeddings.push({
        caseId: caseData.JID,
        embedding
      });
    }
    return embeddings;
  }

  // 搜尋相似案例
  async searchSimilar(query, options = {}) {
    const {
      topK = 10,
      threshold = 0.1,
      caseType = null,
      yearRange = null
    } = options;

    // 向量化查詢
    const queryEmbedding = await this.embedText(query);

    // 過濾候選案例
    let candidates = [...this.cases];
    
    if (caseType) {
      candidates = candidates.filter(c => c.JCASE === caseType);
    }
    
    if (yearRange) {
      candidates = candidates.filter(c => {
        const year = parseInt(c.JYEAR) + 1911;
        return year >= yearRange.start && year <= yearRange.end;
      });
    }

    // 計算相似度
    const results = await Promise.all(
      candidates.map(async (c) => {
        const caseEmbedding = await this.embedCase(c);
        const similarity = this.cosineSimilarity(queryEmbedding, caseEmbedding);
        const distance = this.euclideanDistance(queryEmbedding, caseEmbedding);

        return {
          case: c,
          similarity,
          distance,
          embedding: caseEmbedding
        };
      })
    );

    // 排序並返回結果
    return results
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // 建立向量索引（用於加速搜索）
  buildVectorIndex() {
    const index = {
      cases: [],
      embeddings: [],
      dimensions: this.dimensions
    };

    this.cases.forEach((c, idx) => {
      const embedding = this.embedCaseSync(c);
      index.cases.push({
        id: c.JID,
        index: idx,
        title: c.JTITLE,
        caseType: c.JCASE,
        year: c.JYEAR
      });
      index.embeddings.push(embedding);
    });

    return index;
  }

  // 同步版本（用於索引構建）
  embedCaseSync(caseData) {
    const texts = [
      caseData.JTITLE,
      caseData.JFULLX?.JFULLCONTENT || '',
      ...(caseData.keywords || [])
    ].filter(Boolean);

    const combinedText = texts.join(' ');
    return this.embedTextSync(combinedText);
  }

  embedTextSync(text) {
    if (!text) return new Array(this.dimensions).fill(0);

    const words = this.tokenize(text);
    let embedding = new Array(this.dimensions).fill(0);
    let count = 0;

    for (const word of words) {
      if (this.wordVectors[word]) {
        for (let i = 0; i < this.dimensions; i++) {
          embedding[i] += this.wordVectors[word][i];
        }
        count++;
      }
    }

    if (count > 0) {
      embedding = embedding.map(v => v / count);
    }

    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      embedding = embedding.map(v => v / norm);
    }

    return embedding;
  }

  // 獲取詞彙表信息
  getVocabularyInfo() {
    return {
      caseTypes: this.legalVocabulary.caseTypes.length,
      legalIssues: this.legalVocabulary.legalIssues.length,
      legalTerms: this.legalVocabulary.legalTerms.length,
      courts: this.legalVocabulary.courts.length,
      totalWords: Object.keys(this.wordVectors).length,
      dimensions: this.dimensions
    };
  }
}

module.exports = new VectorEmbeddingService();
