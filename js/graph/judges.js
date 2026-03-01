// Judge Digital Twin v0 - 法官檔案
// 法官個人資訊、判決風格、擅長領域

const JUDGES = [
    {
        id: "judge_001",
        name: "張志明",
        court: "臺灣高等法院",
        level: "高等法院",
        seniority: "15年",
        specialty: ["民事侵權", "醫療糾紛", "損害賠償"],
        expertise: [
            "過失責任認定",
            "醫療過失判斷",
            "精神慰撫金計算",
            "因果關係認定"
        ],
        judgmentStyle: {
            approach: "嚴謹細緻",
           特点: "注重事實認定，強調證據鏈完整性",
            tendency: "傾向保護被害人權益"
        },
        notableCases: [
            {
                caseId: "case_001",
                title: "醫療過失侵權案",
                year: 2022,
                result: "原告勝訴",
                keyIssue: "醫療行為與損害間之因果關係"
            }
        ],
        philosophy: "以人為本，追求實質正義",
        keywords: ["民事侵權", "醫療過失", "損害賠償", "因果關係"]
    },
    {
        id: "judge_002",
        name: "李秀芬",
        court: "智慧財產法院",
        level: "高等法院",
        seniority: "12年",
        specialty: ["智慧財產權", "營業秘密", "專利侵權"],
        expertise: [
            "著作權侵權",
            "專利有效性審查",
            "營業秘密保護",
            "公平交易法"
        ],
        judgmentStyle: {
            approach: "技術導向",
           特点: "熟悉產業技術，能掌握專業爭點",
            tendency: "平衡保護智慧財產權與公共利益"
        },
        notableCases: [
            {
                caseId: "case_002",
                title: "軟體著作權侵權案",
                year: 2023,
                result: "被告敗訴",
                keyIssue: "實質相似性與抄襲認定"
            }
        ],
        philosophy: "智慧財產權保護是創新的基石",
        keywords: ["智慧財產", "著作權", "專利", "營業秘密"]
    },
    {
        id: "judge_003",
        name: "王建國",
        court: "臺灣臺北地方法院",
        level: "地方法院",
        specialty: ["刑事案件", "毒品犯罪", "組織犯罪"],
        expertise: [
            "毒品危害防制條例",
            "刑法總則",
            "證據法則",
            "刑事訴訟程序"
        ],
        judgmentStyle: {
            approach: "程序嚴謹",
           特点: "重視正當程序，確保被告權益",
            tendency: "量刑時考量社會危害程度與被告背景"
        },
        notableCases: [
            {
                caseId: "case_003",
                title: "重大毒品走私案",
                year: 2021,
                result: "被告判處無期徒刑",
                keyIssue: "共同正犯與幫助犯之分界"
            }
        ],
        philosophy: "正義不應只是懲罰，更應考慮教化可能性",
        keywords: ["刑事", "毒品", "組織犯罪", "證據法則"]
    },
    {
        id: "judge_004",
        name: "陳美玲",
        court: "行政法院",
        level: "高等行政法院",
        specialty: ["行政法", "稅務行政", "土地徵收"],
        expertise: [
            "行政處分合法性審查",
            "稅捐稽徵",
            "都市計畫",
            "國家賠償"
        ],
        judgmentStyle: {
            approach: "法理分析",
           特点: "擅長法條解釋，強調依法行政原則",
            tendency: "注重公益與人民權利之平衡"
        },
        notableCases: [
            {
                caseId: "case_004",
                title: "土地徵收補償案",
                year: 2022,
                result: "原告部分勝訴",
                keyIssue: "徵收公益性與必要性審查"
            }
        ],
        philosophy: "行政權應受法律約束，保障人民基本權利",
        keywords: ["行政法", "稅務", "土地徵收", "國家賠償"]
    },
    {
        id: "judge_005",
        name: "劉文雄",
        court: "臺灣高等法院",
        level: "高等法院",
        specialty: ["金融犯罪", "公司法", "證券交易法"],
        expertise: [
            "內線交易",
            "操縱股價",
            "銀行法",
            "洗錢防制"
        ],
        judgmentStyle: {
            approach: "專業精準",
           特点: "熟悉金融市場運作，專精複雜商業案件",
            tendency: "強調被害人保護與市場秩序維護"
        },
        notableCases: [
            {
                caseId: "case_005",
                title: "內線交易案",
                year: 2023,
                result: "被告判處有罪",
                keyIssue: "重大消息明確性與公開時間認定"
            }
        ],
        philosophy: "金融市場健全依賴公平透明",
        keywords: ["金融犯罪", "內線交易", "證券法", "洗錢"]
    }
];

function getJudgeById(id) {
    return JUDGES.find(judge => judge.id === id);
}

function getJudgesByCourt(court) {
    return JUDGES.filter(judge => judge.court.includes(court));
}

function getJudgesBySpecialty(specialty) {
    return JUDGES.filter(judge => 
        judge.specialty.some(s => s.includes(specialty))
    );
}

function searchJudges(keyword) {
    const lower = keyword.toLowerCase();
    return JUDGES.filter(judge =>
        judge.name.includes(keyword) ||
        judge.court.includes(keyword) ||
        judge.specialty.some(s => s.toLowerCase().includes(lower)) ||
        judge.keywords.some(k => k.toLowerCase().includes(lower))
    );
}

function getAllJudges() {
    return JUDGES;
}

function getJudgeSummary(judgeId) {
    const judge = getJudgeById(judgeId);
    if (!judge) return null;
    
    return {
        id: judge.id,
        name: judge.name,
        court: judge.court,
        seniority: judge.seniority,
        specialty: judge.specialty,
        style: judge.judgmentStyle.approach
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        JUDGES, 
        getJudgeById, 
        getJudgesByCourt, 
        getJudgesBySpecialty,
        searchJudges,
        getAllJudges,
        getJudgeSummary
    };
}

// ESM export
export { JUDGES, getJudgeById, getJudgesByCourt, getJudgesBySpecialty, searchJudges, getAllJudges, getJudgeSummary };
