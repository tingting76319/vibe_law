/**
 * 法規資料庫 Service
 * 
 * 全國法規資料庫 (law.moj.gov.tw) API 研究結果：
 * - 無公開的 REST API
 * - 有 OData 接口但需要進一步研究
 * - 提供開放資料下載 (https://data.gov.tw/dataset/15105)
 * 
 * 本服務提供：
 * 1. 法規搜尋（本地資料庫）
 * 2. 法規內容查詢
 * 3. 法規異動歷史
 * 4. 法規資料匯入（支援 JSON 格式）
 */
const lawRepository = require('../repositories/lawRepository');
const axios = require('axios');

class LawService {
  constructor() {
    // 全國法規資料庫資訊
    this.sourceInfo = {
      name: '全國法規資料庫',
      website: 'https://law.moj.gov.tw/',
      dataPortal: 'https://data.gov.tw/dataset/15105',
      note: '法規資料來源為全國法規資料庫'
    };
    
    // 法規類別對照
    this.categories = {
      '刑法': 'criminal',
      '民法': 'civil',
      '行政法': 'administrative',
      '商事法': 'commercial',
      '勞動法': 'labor',
      '智慧財產權法': 'ip',
      '刑事訴訟法': 'criminal_procedure',
      '民事訴訟法': 'civil_procedure',
      '行政訴訟法': 'administrative_procedure',
      '憲法': 'constitutional',
      '其他': 'other'
    };
  }

  /**
   * 搜尋法規
   */
  async search(keyword, options = {}) {
    const { limit = 20, offset = 0, category = null } = options;
    
    try {
      const results = await lawRepository.searchLaws(keyword, { limit, offset, category });
      
      // 記錄搜尋歷史
      await lawRepository.logSearch(null, keyword, results.length);
      
      return {
        success: true,
        keyword,
        count: results.length,
        total: results.length, // TODO: 需要 total count
        results: results.map(r => this.normalizeLaw(r))
      };
    } catch (error) {
      console.error('[LawService] 搜尋錯誤:', error.message);
      throw error;
    }
  }

  /**
   * 取得單一法規
   */
  async getLaw(lawId) {
    try {
      const law = await lawRepository.getLawById(lawId);
      if (!law) {
        return { success: false, error: '找不到法規' };
      }
      
      // 取得異動歷史
      const amendments = await lawRepository.getLawAmendments(lawId);
      
      return {
        success: true,
        law: this.normalizeLaw(law),
        amendments: amendments.map(a => ({
          date: a.amendment_date,
          type: a.amendment_type,
          description: a.description
        }))
      };
    } catch (error) {
      console.error('[LawService] 取得法規錯誤:', error.message);
      throw error;
    }
  }

  /**
   * 依類別取得法規
   */
  async getByCategory(category, limit = 50, offset = 0) {
    try {
      const results = await lawRepository.getLawsByCategory(category, limit, offset);
      return {
        success: true,
        category,
        count: results.length,
        results: results.map(r => this.normalizeLaw(r))
      };
    } catch (error) {
      console.error('[LawService] 取得類別法規錯誤:', error.message);
      throw error;
    }
  }

  /**
   * 取得所有類別
   */
  async getCategories() {
    try {
      const categories = await lawRepository.getCategories();
      return {
        success: true,
        categories: categories.map(c => ({
          name: c.law_category,
          count: parseInt(c.count, 10)
        }))
      };
    } catch (error) {
      console.error('[LawService] 取得類別錯誤:', error.message);
      throw error;
    }
  }

  /**
   * 匯入法規資料
   */
  async importLaw(lawData) {
    try {
      // 驗證必要欄位
      if (!lawData.law_id || !lawData.law_name) {
        throw new Error('缺少必要欄位：law_id, law_name');
      }
      
      const result = await lawRepository.upsertLaw(lawData);
      return {
        success: true,
        law: this.normalizeLaw(result)
      };
    } catch (error) {
      console.error('[LawService] 匯入法規錯誤:', error.message);
      throw error;
    }
  }

  /**
   * 批次匯入法規
   */
  async importLaws(lawsArray) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const law of lawsArray) {
      try {
        await this.importLaw(law);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          law_id: law.law_id,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 取得法規統計
   */
  async getStats() {
    try {
      const total = await lawRepository.getTotalCount();
      const categories = await this.getCategories();
      
      return {
        success: true,
        total,
        categories: categories.categories
      };
    } catch (error) {
      console.error('[LawService] 取得統計錯誤:', error.message);
      throw error;
    }
  }

  /**
   * 正規化法規資料
   */
  normalizeLaw(row) {
    return {
      id: row.id,
      lawId: row.law_id,
      name: row.law_name,
      category: row.law_category,
      chapter: row.chapter,
      section: row.section,
      article: row.article,
      title: row.title,
      content: row.content,
      effectiveDate: row.effective_date,
      promulgateDate: row.promulgate_date,
      amendmentCount: row.amendment_count,
      relatedLaws: row.related_laws ? JSON.parse(row.related_laws) : [],
      keywords: row.keywords ? JSON.parse(row.keywords) : [],
      updatedAt: row.updated_at
    };
  }
}

module.exports = new LawService();
