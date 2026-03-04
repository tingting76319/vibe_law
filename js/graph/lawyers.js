/**
 * Lawyer Mock Data - 律師模擬資料
 * v0.8.0 - 律師媒合 MVP
 */

const LAWYERS = [
  {
    id: "lawyer_001",
    name: "陳志明",
    gender: "男",
    bar_number: "A123456789",
    law_firm: "志明法律事���所",
    position: "主持律師",
    contact_email: "chen@lawfirm.com",
    contact_phone: "02-12345678",
    office_address: "台北市大安區忠孝東路一段100號",
    years_of_experience: 18,
    education: "台灣大學法律系碩士",
    bar_admission_year: 2006,
    specialty: ["民事侵權", "醫療糾紛", "損害賠償"],
    expertise: ["過失責任認定", "因果關係審查", "精神慰撫金計算", "醫療過失判斷"],
    court_admission: ["臺灣高等法院", "臺北地方法院", "新北地方法院", "最高法院"],
    languages: ["中文", "英文"],
    bio: "18年執業經驗，專精民事侵權與醫療糾紛領域，處理超過500件醫療訴訟案件",
    style_vector: {
      aggressiveness: 0.6,
      mediationWillingness: 0.7,
      technicalOrientation: 0.8,
      conservatism: 0.7,
      communicationStyle: 0.75,
      riskTolerance: 0.65
    },
    rating: 4.8,
    case_stats: {
      total_cases: 520,
      wins: 342,
      losses: 128,
      settlements: 50,
      appeals: 45,
      avg_case_value: 2500000
    },
    win_rate_by_court: {
      "臺灣高等法院": 68,
      "臺北地方法院": 72,
      "最高法院": 55
    },
    win_rate_by_type: {
      "民事侵權": 70,
      "醫療糾紛": 65,
      "調解": 75
    },
    hourly_rate: 15000,
    availability_status: "available"
  },
  {
    id: "lawyer_002",
    name: "林怡君",
    gender: "女",
    bar_number: "B987654321",
    law_firm: "怡君智慧財產律師事務所",
    position: "合夥律師",
    contact_email: "lin@iplaw.com",
    contact_phone: "02-23456789",
    office_address: "台北市信義區忠孝東路五段100號",
    years_of_experience: 12,
    education: "臺灣大學法律系",
    bar_admission_year: 2012,
    specialty: ["智慧財產", "著作權侵權", "專利侵權", "營業秘密"],
    expertise: ["侵權分析", "權利範圍認定", "損害賠償計算", "禁令救濟"],
    court_admission: ["智慧財產法院", "臺灣高等法院", "臺北地方法院"],
    languages: ["中文", "英文", "日文"],
    bio: "智慧財產權領域專家，曾任科技公司法務主管，專精專利與著作權侵權訴訟",
    style_vector: {
      aggressiveness: 0.75,
      mediationWillingness: 0.5,
      technicalOrientation: 0.95,
      conservatism: 0.5,
      communicationStyle: 0.8,
      riskTolerance: 0.7
    },
    rating: 4.9,
    case_stats: {
      total_cases: 280,
      wins: 196,
      losses: 62,
      settlements: 22,
      appeals: 35,
      avg_case_value: 5000000
    },
    win_rate_by_court: {
      "智慧財產法院": 78,
      "臺灣高等法院": 70
    },
    win_rate_by_type: {
      "智慧財產": 75,
      "專利侵權": 72,
      "著作權侵權": 80
    },
    hourly_rate: 18000,
    availability_status: "available"
  },
  {
    id: "lawyer_003",
    name: "張建國",
    gender: "男",
    bar_number: "C456789123",
    law_firm: "建國刑事辯護律師事務所",
    position: "主持律師",
    contact_email: "chang@criminallaw.com",
    contact_phone: "02-34567890",
    office_address: "台北市中正區博愛路100號",
    years_of_experience: 25,
    education: "東吳大學法律系",
    bar_admission_year: 1999,
    specialty: ["刑事辯護", "毒品犯罪", "白領犯罪"],
    expertise: ["辯護策略", "證據分析", "量刑建議", "羈押抗告"],
    court_admission: ["臺灣高等法院", "臺北地方法院", "最高法院", "福建高等法院"],
    languages: ["中文", "英文"],
    bio: "25年刑事辯護經驗，專精重大刑事案件，曾成功辯護多起社會矚目案件",
    style_vector: {
      aggressiveness: 0.9,
      mediationWillingness: 0.3,
      technicalOrientation: 0.7,
      conservatism: 0.8,
      communicationStyle: 0.85,
      riskTolerance: 0.8
    },
    rating: 4.7,
    case_stats: {
      total_cases: 680,
      wins: 408,
      losses: 204,
      settlements: 68,
      appeals: 120,
      avg_case_value: 3000000
    },
    win_rate_by_court: {
      "臺灣高等法院": 62,
      "臺北地方法院": 65,
      "最高法院": 48
    },
    win_rate_by_type: {
      "刑事辯護": 60,
      "毒品犯罪": 55,
      "白領犯罪": 68
    },
    hourly_rate: 20000,
    availability_status: "available"
  },
  {
    id: "lawyer_004",
    name: "李美華",
    gender: "女",
    bar_number: "D789123456",
    law_firm: "美華婚姻家庭律師事務所",
    position: "主持律師",
    contact_email: "lee@familylaw.com",
    contact_phone: "02-45678901",
    office_address: "台北市大安區仁愛路四段100號",
    years_of_experience: 15,
    education: "政治大學法律系",
    bar_admission_year: 2009,
    specialty: ["婚姻家庭", "離婚", "子女監護", "遺產繼承"],
    expertise: ["夫妻財產制", "監護權酌定", "遺產分配", "調解談判"],
    court_admission: ["臺灣高等法院", "臺北地方法院", "新北地方法院"],
    languages: ["中文", "英文"],
    bio: "婚姻家庭領域專家，擅長調解與和解，致力於維護當事人與子女最佳利益",
    style_vector: {
      aggressiveness: 0.35,
      mediationWillingness: 0.95,
      technicalOrientation: 0.5,
      conservatism: 0.6,
      communicationStyle: 0.9,
      riskTolerance: 0.4
    },
    rating: 4.6,
    case_stats: {
      total_cases: 420,
      wins: 252,
      losses: 84,
      settlements: 84,
      appeals: 28,
      avg_case_value: 1500000
    },
    win_rate_by_court: {
      "臺灣高等法院": 58,
      "臺北地方法院": 65
    },
    win_rate_by_type: {
      "婚姻家庭": 62,
      "離婚": 68,
      "調解": 82
    },
    hourly_rate: 12000,
    availability_status: "available"
  },
  {
    id: "lawyer_005",
    name: "王文彬",
    gender: "男",
    bar_number: "E321654987",
    law_firm: "文彬行政法律師事務所",
    position: "合夥律師",
    contact_email: "wang@adminlaw.com",
    contact_phone: "02-56789012",
    office_address: "台北市中山區南京東路三段100號",
    years_of_experience: 10,
    education: "臺北大學法律系碩士",
    bar_admission_year: 2014,
    specialty: ["行政救濟", "稅務行政", "土地徵收"],
    expertise: ["行政訴訟", "復查決定", "國家賠償", "法規解釋"],
    court_admission: ["最高行政法院", "臺北高等行政法院", "臺中高等行政法院"],
    languages: ["中文", "英文"],
    bio: "前稅務稽徵人員，專精稅務行政救濟與土地徵收補償案件",
    style_vector: {
      aggressiveness: 0.65,
      mediationWillingness: 0.55,
      technicalOrientation: 0.85,
      conservatism: 0.7,
      communicationStyle: 0.7,
      riskTolerance: 0.6
    },
    rating: 4.5,
    case_stats: {
      total_cases: 180,
      wins: 117,
      losses: 45,
      settlements: 18,
      appeals: 22,
      avg_case_value: 8000000
    },
    win_rate_by_court: {
      "最高行政法院": 65,
      "臺北高等行政法院": 70
    },
    win_rate_by_type: {
      "行政救濟": 68,
      "稅務行政": 72,
      "土地徵收": 65
    },
    hourly_rate: 16000,
    availability_status: "available"
  },
  {
    id: "lawyer_006",
    name: "劉曉寧",
    gender: "女",
    bar_number: "F654987321",
    law_firm: "曉寧金融律師事務所",
    position: "主持律師",
    contact_email: "liu@financelaw.com",
    contact_phone: "02-67890123",
    office_address: "台北市松山區敦化北路100號",
    years_of_experience: 8,
    education: "美國哥倫比亞大學法學碩士",
    bar_admission_year: 2016,
    specialty: ["金融保險", "銀行法", "證券交易法"],
    expertise: ["金融法規", "內線交易", "洗錢防制", "消費者保護"],
    court_admission: ["臺灣高等法院", "臺北地方法院", "智慧財產法院"],
    languages: ["中文", "英文", "日文"],
    bio: "海歸律師，專精金融法規與證券交易案件，具備美國紐約律師資格",
    style_vector: {
      aggressiveness: 0.7,
      mediationWillingness: 0.45,
      technicalOrientation: 0.9,
      conservatism: 0.55,
      communicationStyle: 0.8,
      riskTolerance: 0.65
    },
    rating: 4.7,
    case_stats: {
      total_cases: 95,
      wins: 66,
      losses: 22,
      settlements: 7,
      appeals: 15,
      avg_case_value: 15000000
    },
    win_rate_by_court: {
      "臺灣高等法院": 72,
      "臺北地方法院": 75
    },
    win_rate_by_type: {
      "金融保險": 70,
      "證券交易法": 68
    },
    hourly_rate: 22000,
    availability_status: "busy"
  },
  {
    id: "lawyer_007",
    name: "黃志強",
    gender: "男",
    bar_number: "G147258369",
    law_firm: "志強勞動法律師事務所",
    position: "主持律師",
    contact_email: "huang@laborlaw.com",
    contact_phone: "02-78901234",
    office_address: "台北市萬華區西門町100號",
    years_of_experience: 6,
    education: "輔仁大學法律系",
    bar_admission_year: 2018,
    specialty: ["勞動法", "勞動契約", "職業傷害"],
    expertise: ["勞動法規", "薪資計算", "資遣費", "職業災害"],
    court_admission: ["臺灣高等法院", "臺北地方法院", "新北地方法院"],
    languages: ["中文", "英文"],
    bio: "新銳律師，專精勞動法規，價格實惠，服務熱忱",
    style_vector: {
      aggressiveness: 0.55,
      mediationWillingness: 0.8,
      technicalOrientation: 0.6,
      conservatism: 0.4,
      communicationStyle: 0.85,
      riskTolerance: 0.5
    },
    rating: 4.4,
    case_stats: {
      total_cases: 85,
      wins: 51,
      losses: 25,
      settlements: 9,
      appeals: 8,
      avg_case_value: 500000
    },
    win_rate_by_court: {
      "臺北地方法院": 62,
      "新北地方法院": 60
    },
    win_rate_by_type: {
      "勞動法": 60,
      "調解": 72
    },
    hourly_rate: 8000,
    availability_status: "available"
  },
  {
    id: "lawyer_008",
    name: "楊宗翰",
    gender: "男",
    bar_number: "H258369147",
    law_firm: "宗翰不動產律師事務所",
    position: "合夥律師",
    contact_email: "yang@propertlaw.com",
    contact_phone: "02-89012345",
    office_address: "台北市士林區中正路100號",
    years_of_experience: 20,
    education: "臺灣大學法律系",
    bar_admission_year: 2004,
    specialty: ["不動產", "土地徵收", "共有分割"],
    expertise: ["不動產法規", "登記程序", "價金分配", "土地利用"],
    court_admission: ["臺灣高等法院", "臺北地方法院", "新北地方法院", "最高法院"],
    languages: ["中文", "台語"],
    bio: "資深不動產律師，處理眾多土地徵收與都市更新案件",
    style_vector: {
      aggressiveness: 0.6,
      mediationWillingness: 0.65,
      technicalOrientation: 0.7,
      conservatism: 0.75,
      communicationStyle: 0.7,
      riskTolerance: 0.6
    },
    rating: 4.6,
    case_stats: {
      total_cases: 380,
      wins: 247,
      losses: 95,
      settlements: 38,
      appeals: 45,
      avg_case_value: 12000000
    },
    win_rate_by_court: {
      "臺灣高等法院": 68,
      "臺北地方法院": 72
    },
    win_rate_by_type: {
      "不動產": 68,
      "土地徵收": 65
    },
    hourly_rate: 14000,
    availability_status: "available"
  }
];

function getLawyerById(id) {
  return LAWYERS.find(lawyer => lawyer.id === id);
}

function getLawyersByCourt(court) {
  return LAWYERS.filter(lawyer => 
    lawyer.court_admission.some(c => c.includes(court))
  );
}

function getLawyersBySpecialty(specialty) {
  return LAWYERS.filter(lawyer => 
    lawyer.specialty.some(s => s.includes(specialty))
  );
}

function searchLawyers(keyword) {
  const lower = keyword.toLowerCase();
  return LAWYERS.filter(lawyer =>
    lawyer.name.includes(keyword) ||
    lawyer.law_firm.includes(keyword) ||
    lawyer.specialty.some(s => s.toLowerCase().includes(lower)) ||
    lawyer.expertise.some(e => e.toLowerCase().includes(lower))
  );
}

function getAllLawyers() {
  return LAWYERS;
}

module.exports = {
  LAWYERS,
  getLawyerById,
  getLawyersByCourt,
  getLawyersBySpecialty,
  searchLawyers,
  getAllLawyers
};
