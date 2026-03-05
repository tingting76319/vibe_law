/**
 * Court Service - 法院資料庫服務
 * 提供法院資料、判決模式分析、趨勢統計
 */
const db = require('../db/postgres');
const { cacheService } = require('./cacheService');

class CourtService {
  constructor() {
    this.cacheTTL = 30; // 分鐘
  }

  // 取得所有法院
  async getAllCourts(forceRefresh = false) {
    const cacheKey = 'courts:all';
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;
    }

    // 從案件資料中提取法院（只取 court）
    const courts = db.prepare(`
      SELECT DISTINCT court 
      FROM cases 
      WHERE court IS NOT NULL AND court != ''
      ORDER BY court
    `).all();

    // 取得各法院統計
    const courtData = courts.map(c => {
      const stats = this.getCourtStats(c.court);
      return {
        name: c.court,
        level: this.inferCourtLevel(c.court),
        caseCount: stats.totalCases,
        yearRange: stats.yearRange
      };
    });

    cacheService.set(cacheKey, courtData, this.cacheTTL);
    return courtData;
  }

  // 推斷法院層級
  inferCourtLevel(courtName) {
    if (courtName.includes('最高')) return '最高法院';
    if (courtName.includes('高等')) return '高等法院';
    if (courtName.includes('智慧')) return '智慧財產法院';
    if (courtName.includes('行政')) return '行政法院';
    return '地方法院';
  }

  // 取得法院基本統計
  getCourtStats(courtName) {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalCases,
        MIN(year) as minYear,
        MAX(year) as maxYear,
        COUNT(DISTINCT case_type) as caseTypeCount
      FROM cases 
      WHERE court = ?
    `).get(courtName);

    return {
      totalCases: stats?.totalCases || 0,
      yearRange: stats?.minYear && stats?.maxYear 
        ? { start: stats.minYear, end: stats.maxYear } 
        : null,
      caseTypeCount: stats?.caseTypeCount || 0
    };
  }

  // 依 ID 取得法院資料
  async getCourtById(courtId, forceRefresh = false) {
    const cacheKey = `court:${courtId}`;
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;
    }

    // 先嘗試直接用 courtId 查詢案件
    const court = db.prepare(`
      SELECT DISTINCT court
      FROM cases 
      WHERE court = ?
    `).get(courtId);

    if (!court) {
      // 嘗試用 ID 查詢法官所屬法院
      const judge = db.prepare(`
        SELECT court FROM judge_profiles WHERE id = ?
      `).get(courtId);
      
      if (judge) {
        return this.getCourtByName(judge.court, forceRefresh);
      }
      return null;
    }

    const result = this.getCourtByName(court.court, forceRefresh);
    cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  // 依名稱取得法院資料
  getCourtByName(courtName, forceRefresh = false) {
    const cacheKey = `court:name:${courtName}`;
    
    if (!forceRefresh) {
      const cached = cacheService.get(cacheKey);
      if (cached) return cached;
    }

    // 基本資料
    const stats = this.getCourtStats(courtName);
    
    // 案件類型分布
    const typeDistribution = db.prepare(`
      SELECT 
        case_type as type,
        COUNT(*) as count
      FROM cases 
      WHERE court = ?
      GROUP BY case_type
      ORDER BY count DESC
    `).all(courtName);

    // 判決結果分布
    const resultDistribution = db.prepare(`
      SELECT 
        result,
        COUNT(*) as count
      FROM cases 
      WHERE court = ? AND result IS NOT NULL AND result != ''
      GROUP BY result
      ORDER BY count DESC
      LIMIT 10
    `).all(courtName);

    // 法官清單
    const judges = db.prepare(`
      SELECT id, name, position, specialty
      FROM judge_profiles 
      WHERE court = ?
      ORDER BY name
    `).all(courtName);

    // 年度趨勢
    const annualTrend = db.prepare(`
      SELECT 
        year,
        COUNT(*) as count,
        case_type as type
      FROM cases 
      WHERE court = ?
      GROUP BY year, case_type
      ORDER BY year DESC
      LIMIT 50
    `).all(courtName);

    const result = {
      id: courtName,
      name: courtName,
      level: this.inferCourtLevel(courtName),
      stats: {
        totalCases: stats.totalCases,
        yearRange: stats.yearRange,
        caseTypeCount: stats.caseTypeCount
      },
      typeDistribution: typeDistribution.map(t => ({
        type: t.type || '其他',
        count: t.count,
        percentage: stats.totalCases > 0 
          ? Math.round((t.count / stats.totalCases) * 1000) / 10 
          : 0
      })),
      resultDistribution,
      judges: judges.map(j => ({
        id: j.id,
        name: j.name,
        position: j.position,
        specialty: j.specialty ? JSON.parse(j.specialty) : []
      })),
      annualTrend: this.processAnnualTrend(annualTrend)
    };

    cacheService.set(cacheKey, result, this.cacheTTL);
    return result;
  }

  // 處理年度趨勢資料
  processAnnualTrend(trendData) {
    const yearly = {};
    trendData.forEach(t => {
      if (!yearly[t.year]) {
        yearly[t.year] = { year: t.year, total: 0, byType: {} };
      }
      yearly[t.year].total += t.count;
      yearly[t.year].byType[t.type || '其他'] = t.count;
    });

    return Object.values(yearly)
      .sort((a, b) => b.year - a.year)
      .slice(0, 10);
  }

  // 取得法院判決模式分析
  async getCourtAnalysis(courtId, options = {}) {
    const { yearRange, caseType } = options;
    const court = await this.getCourtById(courtId);
    
    if (!court) {
      return { status: 'error', message: '法院不存在' };
    }

    // 取得法官判決傾向
    const judgeTendencies = db.prepare(`
      SELECT 
        j.id,
        j.name,
        j.position,
        j.style_approach,
        COUNT(c.id) as caseCount,
        SUM(CASE WHEN c.result LIKE '%勝訴%' THEN 1 ELSE 0 END) as wins
      FROM judge_profiles j
      LEFT JOIN cases c ON c.judge_id = j.id AND c.court = ?
      WHERE j.court = ?
      GROUP BY j.id
      ORDER BY caseCount DESC
      LIMIT 20
    `).all(court.name, court.name);

    // 上訴維持率分析
    const appealStats = this.getAppealStats(court.name, yearRange);

    // 常引用法條
    const topLaws = this.getTopLaws(court.name, yearRange);

    // 案件類型統計
    const caseTypeStats = this.getCaseTypeStats(court.name, yearRange, caseType);

    return {
      status: 'success',
      data: {
        court: {
          id: court.id,
          name: court.name,
          level: court.level
        },
        caseTypeAnalysis: caseTypeStats,
        judgeTendencies: judgeTendencies.map(j => ({
          id: j.id,
          name: j.name,
          position: j.position,
          style: j.style_approach,
          caseCount: j.caseCount,
          winRate: j.caseCount > 0 
            ? Math.round((j.wins / j.caseCount) * 1000) / 10 
            : 0
        })),
        appealAnalysis: appealStats,
        topLaws
      }
    };
  }

  // 取得案件類型統計
  getCaseTypeStats(courtName, yearRange, caseType) {
    let query = `
      SELECT 
        case_type,
        COUNT(*) as count
      FROM cases 
      WHERE court = ?
    `;
    const params = [courtName];

    if (yearRange) {
      query += ' AND year BETWEEN ? AND ?';
      params.push(yearRange.startYear, yearRange.endYear);
    }

    query += ' GROUP BY case_type ORDER BY count DESC';

    const stats = db.prepare(query).all(...params);
    
    return stats.map(s => ({
      type: s.case_type || '其他',
      count: s.count
    }));
  }

  // 取得常引用法條
  getTopLaws(courtName, yearRange) {
    // 取得有法條的案件
    const casesWithLaws = db.prepare(`
      SELECT id, related_laws FROM cases 
      WHERE court = ? AND related_laws IS NOT NULL AND related_laws != ''
      ${yearRange ? 'AND year BETWEEN ? AND ?' : ''}
    `).all(...(yearRange ? [courtName, yearRange.startYear, yearRange.endYear] : [courtName]));

    // 統計法條出現次數
    const lawCount = {};
    casesWithLaws.forEach(c => {
      if (c.related_laws) {
        try {
          const laws = JSON.parse(c.related_laws);
          laws.forEach(law => {
            lawCount[law] = (lawCount[law] || 0) + 1;
          });
        } catch (e) {
          // related_laws 可能不是 JSON 格式
          const laws = c.related_laws.split(/[,，]/);
          laws.forEach(law => {
            const trimmed = law.trim();
            if (trimmed) lawCount[trimmed] = (lawCount[trimmed] || 0) + 1;
          });
        }
      }
    });

    return Object.entries(lawCount)
      .map(([law, count]) => ({ law, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  // 取得上訴統計
  getAppealStats(courtName, yearRange) {
    // 模擬上訴資料
    const totalAppeals = Math.floor(Math.random() * 100) + 50;
    
    return {
      totalAppeals,
      sustained: Math.floor(totalAppeals * 0.65),
      reversed: Math.floor(totalAppeals * 0.20),
      modified: Math.floor(totalAppeals * 0.10),
      pending: Math.floor(totalAppeals * 0.05),
      sustainedRate: 65,
      court: courtName
    };
  }

  // 搜尋法院
  async searchCourts(query) {
    const cacheKey = `courts:search:${query}`;
    
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const courts = db.prepare(`
      SELECT DISTINCT court as name
      FROM cases 
      WHERE court LIKE ?
      ORDER BY court
      LIMIT 20
    `).all(`%${query}%`);

    cacheService.set(cacheKey, courts, this.cacheTTL);
    return courts;
  }

  // 取得法院判決模式
  getCourtJudgmentPatterns() {
    const patterns = {
      '最高法院': {
        approach: '法律審',
        style: '嚴謹',
        commonTypes: ['民事', '刑事'],
        reversalRate: '15-25%',
        characteristic: '著重法律適用正確性'
      },
      '高等法院': {
        approach: '事實審',
        style: '平衡',
        commonTypes: ['民事', '刑事', '行政'],
        reversalRate: '20-30%',
        characteristic: '注重事實認定與證據審查'
      },
      '地方法院': {
        approach: '事實審',
        style: '多元',
        commonTypes: ['民事', '刑事', '行政'],
        reversalRate: '30-40%',
        characteristic: '案件量大，類型多元'
      },
      '智慧財產法院': {
        approach: '專業審',
        style: '技術導向',
        commonTypes: ['智慧財產', '營業秘密'],
        reversalRate: '10-20%',
        characteristic: '強調專業技術細節'
      },
      '行政法院': {
        approach: '行政審',
        style: '法理分析',
        commonTypes: ['行政', '稅務'],
        reversalRate: '25-35%',
        characteristic: '強調依法行政原則'
      }
    };

    return patterns;
  }

  // ===== v1.5 新增: 法院判決差異分析 =====
  async compareCourtJudgments(caseType, year = null) {
    let yearCondition = year ? `AND jyear = '${year}'` : '';
    
    const query = "SELECT SUBSTRING(jid FROM 1 FOR 4) as court_code, COUNT(*) as total_cases, COUNT(DISTINCT jcase) as unique_case_types, AVG(LENGTH(jfull)) as avg_content_length FROM judgments WHERE jcase LIKE '%" + caseType + "%' " + yearCondition + " GROUP BY SUBSTRING(jid FROM 1 FOR 4) ORDER BY total_cases DESC LIMIT 20";
    
    const result = db.query(query);
    const rows = result.rows;
    
    const courts = await this.getAllCourts();
    const courtMap = {};
    courts.forEach(c => {
      courtMap[c.code || c.name] = c.name;
    });
    
    return rows.map(row => ({
      court_code: row.court_code,
      court_name: courtMap[row.court_code] || row.court_code,
      total_cases: parseInt(row.total_cases),
      unique_case_types: parseInt(row.unique_case_types),
      avg_content_length: Math.round(parseFloat(row.avg_content_length) || 0)
    }));
  }

  async getCourtTrend(courtId, years = 3) {
    const currentYear = new Date().getFullYear() - 1911;
    const yearList = [];
    
    for (let i = 0; i < years; i++) {
      yearList.push(currentYear - i);
    }
    
    const query = "SELECT jyear, COUNT(*) as case_count, COUNT(DISTINCT jcase) as case_types FROM judgments WHERE jid LIKE '" + courtId + "%' AND jyear IN (" + yearList.join(',') + ") GROUP BY jyear ORDER BY jyear DESC";
    
    const result = db.query(query);
    const rows = result.rows;
    
    return rows.map(row => ({
      year: row.jyear,
      case_count: parseInt(row.case_count),
      case_types: parseInt(row.case_types)
    }));
  }
}

module.exports = new CourtService();
