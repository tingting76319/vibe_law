/**
 * Judge Data Seeder - 法官資料初始化
 * 將法官數據寫入資料庫
 */
const db = require('../connection');
const { v4: uuidv4 } = require('uuid');

const judges = [
  {
    id: 'judge_001',
    name: '張志明',
    court: '臺灣高等法院',
    court_level: '高等法院',
    position: '法官',
    tenure_start: '2010-03-01',
    specialty: ['民事侵權', '醫療糾紛', '損害賠償'],
    bio: '從事民事審判超過20年，專精於醫療過失與侵權行為案件',
    style_approach: '嚴謹細緻',
    style_tendency: '傾向保護被害人權益',
    philosophy: '以人為本，追求實質正義',
    expertise: ['過失責任認定', '醫療過失判斷', '精神慰撫金計算', '因果關係認定'],
    judgment_stats: {
      totalCases: 1500,
      winRate: 0.72,
      avgDuration: 8.5
    }
  },
  {
    id: 'judge_002',
    name: '李秀芬',
    court: '智慧財產法院',
    court_level: '高等法院',
    position: '法官',
    tenure_start: '2012-09-01',
    specialty: ['智慧財產權', '營業秘密', '專利侵權'],
    bio: '具有理工背景，專精於智慧財產權案件',
    style_approach: '技術導向',
    style_tendency: '平衡保護智慧財產權與公共利益',
    philosophy: '智慧財產權保護是創新的基石',
    expertise: ['著作權侵權', '專利有效性審查', '營業秘密保護', '公平交易法'],
    judgment_stats: {
      totalCases: 980,
      winRate: 0.68,
      avgDuration: 12.3
    }
  },
  {
    id: 'judge_003',
    name: '王建國',
    court: '臺灣臺北地方法院',
    court_level: '地方法院',
    position: '法官',
    tenure_start: '2008-01-15',
    specialty: ['刑事案件', '毒品犯罪', '組織犯罪'],
    bio: '資深刑事法官，專精於毒品與組織犯罪案件',
    style_approach: '程序嚴謹',
    style_tendency: '量刑時考量社會危害程度與被告背景',
    philosophy: '正義不應只是懲罰，更應考慮教化可能性',
    expertise: ['毒品危害防制條例', '刑法總則', '證據法則', '刑事訴訟程序'],
    judgment_stats: {
      totalCases: 2100,
      convictionRate: 0.85,
      avgDuration: 6.2
    }
  },
  {
    id: 'judge_004',
    name: '陳美玲',
    court: '行政法院',
    court_level: '高等行政法院',
    position: '法官',
    tenure_start: '2011-06-01',
    specialty: ['行政法', '稅務行政', '土地徵收'],
    bio: '專精於行政救濟與稅務案件',
    style_approach: '法理分析',
    style_tendency: '注重公益與人民權利之平衡',
    philosophy: '行政權應受法律約束，保障人民基本權利',
    expertise: ['行政處分合法性審查', '稅捐稽徵', '都市計畫', '國家賠償'],
    judgment_stats: {
      totalCases: 750,
      winRate: 0.45,
      avgDuration: 15.8
    }
  },
  {
    id: 'judge_005',
    name: '劉文雄',
    court: '臺灣高等法院',
    court_level: '高等法院',
    position: '法官',
    tenure_start: '2014-02-01',
    specialty: ['金融犯罪', '公司法', '證券交易法'],
    bio: '具有金融背景，專精於複雜商業犯罪案件',
    style_approach: '專業精準',
    style_tendency: '強調被害人保護與市場秩序維護',
    philosophy: '金融市場健全依賴公平透明',
    expertise: ['內線交易', '操縱股價', '銀行法', '洗錢防制'],
    judgment_stats: {
      totalCases: 320,
      convictionRate: 0.78,
      avgDuration: 18.5
    }
  }
];

function seedJudges() {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO judge_profiles 
    (id, name, court, court_level, position, tenure_start, specialty, bio, style_approach, style_tendency, philosophy, expertise, judgment_stats)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const specialtyStmt = db.prepare(`
    INSERT OR IGNORE INTO judge_specialties (judge_id, specialty) VALUES (?, ?)
  `);

  for (const judge of judges) {
    stmt.run(
      judge.id,
      judge.name,
      judge.court,
      judge.court_level,
      judge.position,
      judge.tenure_start,
      JSON.stringify(judge.specialty),
      judge.bio,
      judge.style_approach,
      judge.style_tendency,
      judge.philosophy,
      JSON.stringify(judge.expertise),
      JSON.stringify(judge.judgment_stats)
    );

    // 插入擅長領域
    for (const specialty of judge.specialty) {
      specialtyStmt.run(judge.id, specialty);
    }
  }

  console.log(`✅ Seeded ${judges.length} judges`);
}

module.exports = { seedJudges, judges };
