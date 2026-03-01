// 法官資料庫
const JUDGES_DATA = [
    {
        id: "judge-001",
        name: "王志明",
        title: "地方法院法官",
        court: "台北地方法院",
        years: "15年",
        specialties: ["民事", "家事"],
        stats: {
            total: 1247,
            civil: 823,
            criminal: 312,
            admin: 112,
            維持: 68,
            撤銷: 22,
            和解: 10,
            avgDays: 45,
            appealRate: 75
        },
        cases: [
            { id: "109台上2345", date: "2020-04-15", type: "民事", title: "請求損害賠償", result: "維持", court: "最高法院" },
            { id: "108重上1234", date: "2019-11-20", type: "民事", title: "離婚事件", result: "和解", court: "高等法院" },
            { id: "109簡上5678", date: "2020-06-10", type: "民事", title: "租屋押金糾紛", result: "維持", court: "地方法院" },
            { id: "108台上9012", date: "2019-08-05", type: "民事", title: "繼承分割", result: "撤銷", court: "高等法院" },
            { id: "107重上3456", date: "2018-12-18", type: "民事", title: "債權請求", result: "維持", court: "地方法院" }
        ]
    },
    {
        id: "judge-002",
        name: "李文華",
        title: "地方法院法官",
        court: "新北地方法院",
        years: "12年",
        specialties: ["刑事", "毒品"],
        stats: {
            total: 892,
            civil: 234,
            criminal: 589,
            admin: 69,
            維持: 72,
            撤銷: 18,
            和解: 10,
            avgDays: 38,
            appealRate: 82
        },
        cases: [
            { id: "109毒偵1234", date: "2020-05-20", type: "刑事", title: "毒品危害防制", result: "維持", court: "高等法院" },
            { id: "108訴1234", date: "2019-09-15", type: "刑事", title: "傷害罪", result: "維持", court: "地方法院" },
            { id: "109上訴567", date: "2020-03-10", type: "刑事", title: "竊盜罪", result: "撤銷", court: "高等法院" },
            { id: "108毒偵890", date: "2019-07-22", type: "刑事", title: "毒品案件", result: "維持", court: "地方法院" }
        ]
    },
    {
        id: "judge-003",
        name: "張美玲",
        title: "高等法院法官",
        court: "高等法院",
        years: "20年",
        specialties: ["行政", "智慧財產"],
        stats: {
            total: 567,
            civil: 123,
            criminal: 89,
            admin: 355,
            維持: 65,
            撤銷: 25,
            和解: 10,
            avgDays: 62,
            appealRate: 70
        },
        cases: [
            { id: "109行政5678", date: "2020-04-28", type: "行政", title: "稅務行政救濟", result: "維持", court: "最高行政法院" },
            { id: "108行政2345", date: "2019-10-12", type: "行政", title: "專利侵權", result: "撤銷", court: "高等法院" },
            { id: "109知產1234", date: "2020-02-18", type: "行政", title: "商標異議", result: "維持", court: "智慧財產法院" }
        ]
    },
    {
        id: "judge-004",
        name: "陳建國",
        title: "地方法院法官",
        court: "台中地方法院",
        years: "8年",
        specialties: ["民事", "勞動"],
        stats: {
            total: 456,
            civil: 312,
            criminal: 98,
            admin: 46,
            維持: 58,
            撤銷: 28,
            和解: 14,
            avgDays: 52,
            appealRate: 65
        },
        cases: [
            { id: "109勞動2345", date: "2020-05-10", type: "民事", title: "勞動爭議", result: "和解", court: "地方法院" },
            { id: "108重上7890", date: "2019-08-22", type: "民事", title: "僱傭關係", result: "維持", court: "高等法院" },
            { id: "109簡上3456", date: "2020-01-15", type: "民事", title: "工資請求", result: "撤銷", court: "地方法院" }
        ]
    },
    {
        id: "judge-005",
        name: "劉志強",
        title: "地方法院法官",
        court: "高雄地方法院",
        years: "18年",
        specialties: ["刑事", "金融"],
        stats: {
            total: 1089,
            civil: 234,
            criminal: 789,
            admin: 66,
            維持: 70,
            撤銷: 20,
            和解: 10,
            avgDays: 41,
            appealRate: 78
        },
        cases: [
            { id: "109金檢5678", date: "2020-06-05", type: "刑事", title: "銀行法案件", result: "維持", court: "高等法院" },
            { id: "108訴2345", date: "2019-11-18", type: "刑事", title: "侵占罪", result: "維持", court: "地方法院" },
            { id: "109上訴8901", date: "2020-04-20", type: "刑事", title: "偽造文書", result: "撤銷", court: "高等法院" }
        ]
    }
];

// 取得所有法官列表
function getJudgesList() {
    return JUDGES_DATA;
}

// 依 ID 取得法官資料
function getJudgeById(judgeId) {
    return JUDGES_DATA.find(j => j.id === judgeId);
}

// 依 ID 取得法官判決
function getJudgeCases(judgeId) {
    const judge = getJudgeById(judgeId);
    return judge ? judge.cases : [];
}

// 過濾法官判決
function filterJudgeCases(judgeId, type, keyword) {
    let cases = getJudgeCases(judgeId);
    
    if (type && type !== "") {
        cases = cases.filter(c => c.type === type);
    }
    
    if (keyword && keyword.trim() !== "") {
        const k = keyword.toLowerCase();
        cases = cases.filter(c => 
            c.title.toLowerCase().includes(k) || 
            c.id.toLowerCase().includes(k)
        );
    }
    
    return cases;
}
