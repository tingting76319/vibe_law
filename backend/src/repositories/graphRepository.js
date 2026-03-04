/**
 * Graph Repository - Graph RAG 圖譜查詢
 * v1.4 - 支援同一判決歷史脈絡與法官相似案件查詢
 */
const DB_QUERY_TIMEOUT_MS = Number.parseInt(process.env.DB_QUERY_TIMEOUT_MS || '5000', 10);

function createTimeoutError() {
  const error = new Error('資料庫查詢逾時，請稍後再試');
  error.code = 'DB_TIMEOUT';
  return error;
}

function createGraphRepository(dbClient) {
  async function queryWithTimeout(text, params = []) {
    let timeoutId;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(createTimeoutError()), DB_QUERY_TIMEOUT_MS);
      });

      return await Promise.race([dbClient.query(text, params), timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    /**
     * 取得案件的所有相關判決（歷史脈絡）
     * 包含上訴、發回、更審等相關案件
     * 
     * 查詢策略：
     * 1. 根據案件編號 (jcase) 找尋相關案件
     * 2. 根據關鍵字相似度找尋相似案件
     * 3. 根據法院和日期範圍找尋相關案件
     * 
     * @param {string} jid - 案件編號
     * @param {number} limit - 回傳結果數量
     */
    async getCaseHistory(jid, limit = 20) {
      // 先取得原始案件的資訊
      const originalCase = await queryWithTimeout(
        `SELECT jid, jcase, jtitle, jdate, jfull, jyear 
         FROM judgments WHERE jid = $1`,
        [jid]
      );

      if (!originalCase.rows || originalCase.rows.length === 0) {
        return {
          originalCase: null,
          relatedCases: [],
          history: [],
          message: '找不到該案件'
        };
      }

      const caseInfo = originalCase.rows[0];
      const jcase = caseInfo.jcase;
      const jyear = caseInfo.jyear;
      const jtitle = caseInfo.jtitle || '';
      const jdate = caseInfo.jdate || '';

      // 找出案件編號相關的案件（上訴、發回、更審）
      // 案件編號格式可能是: 111年度簡字第1234號
      // 相關案件會有類似的編號格式
      
      let relatedQuery = '';
      let queryParams = [];
      
      if (jcase && jcase.trim()) {
        // 提取案件年度和編號
        const caseYearMatch = jcase.match(/(\d+)年度/);
        const caseNumberMatch = jcase.match(/第(\d+)號/);
        
        if (caseYearMatch && caseNumberMatch) {
          const caseYear = caseYearMatch[1];
          const caseNumber = caseNumberMatch[1];
          
          // 查詢相同年度、類似編號的案件
          relatedQuery = `
            SELECT jid, jcase, jtitle, jdate, jyear, jfull,
                   CASE 
                     WHEN jcase LIKE $1 THEN 'SAME_CASE'
                     WHEN jcase LIKE $2 THEN 'RELATED'
                     WHEN jcase LIKE $3 THEN 'APPEAL'
                     ELSE 'SIMILAR'
                   END as relation_type
            FROM judgments 
            WHERE jid != $4
              AND (
                -- 相同案件編號
                (jcase LIKE $1)
                -- 相關案件（類似編號）
                OR (jcase LIKE $2)
                -- 上訴案件
                OR (jcase LIKE $3)
                -- 相同年度的類似案件
                OR (jyear = $5 AND jcase LIKE $6)
              )
            ORDER BY jdate DESC
            LIMIT $7
          `;
          queryParams = [
            `%${jcase}%`,           // $1 - 相同案件
            `%${caseYear}%簡字%${caseNumber.substring(0, 2)}%`, // $2 - 相關
            `%${caseYear}%上訴%`,  // $3 - 上訴
            jid,                     // $4 - 排除自己
            jyear,                   // $5 - 相同年度
            `%${caseYear}%`,         // $6 - 類似案件
            limit                    // $7
          ];
        } else {
          // 如果無法解析案件編號，就用模糊比對
          relatedQuery = `
            SELECT jid, jcase, jtitle, jdate, jyear, jfull,
                   'SIMILAR' as relation_type
            FROM judgments 
            WHERE jid != $1
              AND jcase LIKE $2
            ORDER BY jdate DESC
            LIMIT $3
          `;
          queryParams = [jid, `%${jcase}%`, limit];
        }
      } else {
        // 如果沒有案件編號，使用標題關鍵字找相似案件
        const keywords = jtitle.split(/[,，、\s]+/).filter(k => k.length > 2).slice(0, 3);
        if (keywords.length > 0) {
          const keywordConditions = keywords.map((_, i) => `jtitle LIKE $${i + 2}`).join(' OR ');
          relatedQuery = `
            SELECT jid, jcase, jtitle, jdate, jyear, jfull,
                   'SIMILAR' as relation_type
            FROM judgments 
            WHERE jid != $1
              AND (${keywordConditions})
            ORDER BY jdate DESC
            LIMIT $2
          `;
          queryParams = [jid, ...keywords.map(k => `%${k}%`), limit];
        } else {
          // 沒有足夠關鍵字，回傳空結果
          return {
            originalCase: caseInfo,
            relatedCases: [],
            history: [],
            message: '案件資訊不足，無法找尋相關案件'
          };
        }
      }

      const relatedResult = await queryWithTimeout(relatedQuery, queryParams);

      // 組織歷史脈絡
      const history = relatedResult.rows.map(row => ({
        jid: row.jid,
        jcase: row.jcase,
        jtitle: row.jtitle,
        jdate: row.jdate,
        jyear: row.jyear,
        relationType: row.relation_type,
        // 根據關係類型給予描述
        relationDescription: getRelationDescription(row.relation_type, row.jcase)
      }));

      // 按關係類型分組
      const relatedCases = {
        SAME_CASE: history.filter(h => h.relationType === 'SAME_CASE'),
        APPEAL: history.filter(h => h.relationType === 'APPEAL'),
        RELATED: history.filter(h => h.relationType === 'RELATED'),
        SIMILAR: history.filter(h => h.relationType === 'SIMILAR')
      };

      return {
        originalCase: {
          jid: caseInfo.jid,
          jcase: caseInfo.jcase,
          jtitle: caseInfo.jtitle,
          jdate: caseInfo.jdate,
          jyear: caseInfo.jyear
        },
        relatedCases,
        history,
        total: history.length
      };
    },

    /**
     * 取得法官審理的相似案件
     * 
     * 查詢策略：
     * 1. 先根據法官名稱找到法官資料
     * 2. 找出該法官審理的所有案件
     * 3. 根據案件類型、關鍵字、法院等計算相似度
     * 4. 回傳最相似的案件列表
     * 
     * @param {string} judgeName - 法官名稱
     * @param {number} limit - 回傳結果數量
     * @param {object} options - 額外選項 (caseType, court, yearFrom, yearTo)
     */
    async getJudgeSimilarCases(judgeName, limit = 20, options = {}) {
      const { caseType, court, yearFrom, yearTo } = options;

      // 優先使用預先計算的法官統計表（快速）
      if (judgeName && judgeName.length >= 2) {
        try {
          const statsQuery = 'SELECT * FROM judge_case_stats WHERE judge_name LIKE $1 LIMIT 1';
          const statsResult = await dbClient.query(statsQuery, [`%${judgeName}%`]);
          
          if (statsResult.rows.length > 0) {
            const stats = statsResult.rows[0];
            return {
              status: 'success',
              judge_name: stats.judge_name,
              case_count: parseInt(stats.case_count),
              message: '使用預先計算的統計資料'
            };
          }
          
          // 如果預先計算表沒資料，回傳提示
          return {
            status: 'not_found',
            message: '找不到法官資料，請嘗試其他法官名稱'
          };
        } catch (e) {
          console.log('[Graph] 預先計算表查詢失敗:', e.message);
        }
      }

      // 從 SQLite 資料庫找法官資訊
      // 注意：這裡需要用到 SQLite 的 judge_profiles 表
      let judgeId = null;
      let judgeInfo = null;

      try {
        // 嘗試從 SQLite 獲取法官資訊
        const sqlite = require('../db/init');
        const judgeResult = sqlite.prepare(`
          SELECT id, name, court, court_level, position, specialty, style_approach
          FROM judge_profiles 
          WHERE name LIKE ? OR name = ?
          LIMIT 1
        `).all(`%${judgeName}%`, judgeName);

        if (judgeResult && judgeResult.length > 0) {
          judgeInfo = judgeResult[0];
          judgeId = judgeInfo.id;
        }
      } catch (e) {
        console.log('[Graph] 無法從 SQLite 取得法官資訊:', e.message);
      }

      // 從 PostgreSQL  judgments 表中找法官相關案件
      // 裁判書內容中可能包含法官名稱
      let query = '';
      let queryParams = [];
      
      if (judgeName) {
        // 先找包含法官姓名的裁判書
        // 然後按案件類型分組，找出法官擅長的案件類型
        
        let whereConditions = ['jfull ILIKE $1 OR jtitle ILIKE $1'];
        queryParams = [`%${judgeName}%`];

        if (caseType) {
          whereConditions.push(`(jcase ILIKE $${queryParams.length + 1} OR jtitle ILIKE $${queryParams.length + 1})`);
          queryParams.push(`%${caseType}%`);
        }

        if (court) {
          whereConditions.push(`jcase ILIKE $${queryParams.length + 1}`);
          queryParams.push(`%${court}%`);
        }

        if (yearFrom) {
          whereConditions.push(`jyear >= $${queryParams.length + 1}`);
          queryParams.push(yearFrom);
        }

        if (yearTo) {
          whereConditions.push(`jyear <= $${queryParams.length + 1}`);
          queryParams.push(yearTo);
        }

        query = `
          SELECT jid, jcase, jtitle, jdate, jyear, jfull,
                 -- 計算相似度分數
                 (
                   CASE WHEN jtitle ILIKE $1 THEN 3 ELSE 0 END +
                   CASE WHEN jcase ILIKE $1 THEN 2 ELSE 0 END +
                   CASE WHEN jfull ILIKE $1 THEN 1 ELSE 0 END
                 ) as relevance_score
          FROM judgments
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY relevance_score DESC, jdate DESC
          LIMIT $${queryParams.length + 1}
        `;
        queryParams.push(limit);

        const result = await queryWithTimeout(query, queryParams);

        // 分析案件類型分佈
        const caseTypeDistribution = {};
        result.rows.forEach(row => {
          const type = getCaseType(row.jcase, row.jtitle);
          caseTypeDistribution[type] = (caseTypeDistribution[type] || 0) + 1;
        });

        // 分析判決結果傾向
        const judgmentTrends = analyzeJudgmentTrends(result.rows);

        return {
          judge: {
            name: judgeName,
            foundInDatabase: !!judgeId,
            info: judgeInfo || null
          },
          cases: result.rows.map(row => ({
            jid: row.jid,
            jcase: row.jcase,
            jtitle: row.jtitle,
            jdate: row.jdate,
            jyear: row.jyear,
            relevanceScore: row.relevance_score,
            caseType: getCaseType(row.jcase, row.jtitle)
          })),
          statistics: {
            totalCases: result.rows.length,
            caseTypeDistribution,
            judgmentTrends,
            yearRange: getYearRange(result.rows)
          },
          filters: {
            caseType,
            court,
            yearFrom,
            yearTo
          }
        };
      }

      return {
        judge: { name: judgeName, foundInDatabase: false },
        cases: [],
        message: '請提供法官名稱'
      };
    },

    /**
     * 取得法官的判決趨勢分析
     * @param {string} judgeName - 法官名稱
     * @param {number} yearFrom - 起始年度
     * @param {number} yearTo - 結束年度
     */
    async getJudgeTrendAnalysis(judgeName, yearFrom = 108, yearTo = 112) {
      const result = await queryWithTimeout(
        `
          SELECT jyear, jcase, jtitle, jfull
          FROM judgments
          WHERE (jfull ILIKE $1 OR jtitle ILIKE $1)
            AND jyear >= $2
            AND jyear <= $3
          ORDER BY jyear DESC, jdate DESC
          LIMIT 200
        `,
        [`%${judgeName}%`, yearFrom, yearTo]
      );

      // 按年度分組
      const yearlyStats = {};
      result.rows.forEach(row => {
        const year = row.jyear;
        if (!yearlyStats[year]) {
          yearlyStats[year] = {
            year,
            totalCases: 0,
            caseTypes: {}
          };
        }
        yearlyStats[year].totalCases++;
        
        const caseType = getCaseType(row.jcase, row.jtitle);
        yearlyStats[year].caseTypes[caseType] = (yearlyStats[year].caseTypes[caseType] || 0) + 1;
      });

      return {
        judgeName,
        period: { yearFrom, yearTo },
        yearlyStats: Object.values(yearlyStats).sort((a, b) => b.year - a.year)
      };
    }
  };
}

// 輔助函數

function getCaseType(jcase, jtitle) {
  const text = (jcase || '') + ' ' + (jtitle || '');
  if (text.includes('民事')) return '民事';
  if (text.includes('刑事')) return '刑事';
  if (text.includes('行政')) return '行政';
  if (text.includes('家事')) return '家事';
  if (text.includes('少年')) return '少年';
  if (text.includes('憲法')) return '憲法';
  return '其他';
}

function getRelationDescription(relationType, jcase) {
  switch (relationType) {
    case 'SAME_CASE':
      return '同一案件';
    case 'APPEAL':
      return '上訴案件';
    case 'RELATED':
      return '相關案件';
    case 'SIMILAR':
      return '相似案件';
    default:
      return '相關案件';
  }
}

function analyzeJudgmentTrends(cases) {
  // 分析案件內容中的判決關鍵詞
  const trends = {
    '原告/上訴方勝訴': 0,
    '被告/被上訴方勝訴': 0,
    '和解': 0,
    '發回更審': 0,
    '駁回': 0,
    '其他': 0
  };

  cases.forEach(row => {
    const text = (row.jfull || '') + ' ' + (row.jtitle || '');
    if (text.includes('原告') && text.includes('勝訴')) trends['原告/上訴方勝訴']++;
    else if (text.includes('被告') && text.includes('勝訴')) trends['被告/被上訴方勝訴']++;
    else if (text.includes('和解')) trends['和解']++;
    else if (text.includes('發回') || text.includes('更審')) trends['發回更審']++;
    else if (text.includes('駁回')) trends['駁回']++;
    else trends['其他']++;
  });

  return trends;
}

function getYearRange(cases) {
  const years = cases.map(c => c.jyear).filter(y => y);
  if (years.length === 0) return null;
  return {
    min: Math.min(...years),
    max: Math.max(...years)
  };
}

const db = require('../db/postgres');

module.exports = createGraphRepository(db);
module.exports.createGraphRepository = createGraphRepository;
