// Legal-RAG 判例資料庫
// 資料來源：司法院公開判例（模擬資料）

const CASES_DATA = [
    {
        id: "109台上1234",
        court: "最高法院",
        year: 109,
        caseNumber: "台上字第1234號",
        type: "民事",
        title: "車禍損害賠償",
        summary: "原告主張被告駕駛車輛過失撞擊原告，請求被告賠償醫療費用、財產損失及精神慰撫金。法院認定被告應負過失責任。",
        result: "上訴駁回",
        relatedLaws: ["民法第184條", "民法第193條", "民法第195條"],
        keywords: ["車禍", "過失", "損害賠償", "精神慰撫金"],
        date: "2020-05-20"
    },
    {
        id: "108台上5678",
        court: "最高法院",
        year: 108,
        caseNumber: "台上字第5678號",
        type: "民事",
        title: "離婚後子女監護權",
        summary: "夫妻離婚後就子女監護權產生爭議，法院依子女最佳利益原則裁判。",
        result: "原審判決廢棄，發回更審",
        relatedLaws: ["民法第1055條", "民法第1055-1條"],
        keywords: ["離婚", "監護權", "子女最佳利益"],
        date: "2019-08-15"
    },
    {
        id: "109重上912",
        court: "高等法院",
        year: 109,
        caseNumber: "重上字第912號",
        type: "民事",
        title: "租屋押金糾紛",
        summary: "房客主張房東不退還押金，房東主張房屋有損壞需扣押修復費用。法院認定雙方各有責任。",
        result: "和解成立",
        relatedLaws: ["民法第423條", "民法第429條"],
        keywords: ["租屋", "押金", "損害賠償", "租賃"],
        date: "2020-03-10"
    },
    {
        id: "107台上3456",
        court: "最高法院",
        year: 107,
        caseNumber: "台上字第3456號",
        type: "民事",
        title: "繼承順位與特留分",
        summary: "被繼承人死亡後，繼承人就遺產分配產生爭議，涉及法定繼承順位及特留分計算。",
        result: "上訴駁回",
        relatedLaws: ["民法第1138條", "民法第1223條", "民法第1225條"],
        keywords: ["繼承", "特留分", "法定繼承", "遺產"],
        date: "2018-11-22"
    },
    {
        id: "110台上789",
        court: "最高法院",
        year: 110,
        caseNumber: "台上字第789號",
        type: "民事",
        title: "勞動契約爭議",
        summary: "勞工主張雇主違法解僱，請求資遣費及職業災害補償。法院認定雇主解僱違法。",
        result: "上訴一部成立",
        relatedLaws: ["勞動基準法第11條", "勞動基準法第17條", "職業災害勞工保護法"],
        keywords: ["勞動", "解僱", "資遣費", "職業災害"],
        date: "2021-02-28"
    },
    {
        id: "108簡上2045",
        court: "高等法院",
        year: 108,
        caseNumber: "簡上字第2045號",
        type: "民事",
        title: "鄰居噪音糾紛",
        summary: "住戶主張鄰居製造噪音影響居住安寧，請求排除侵害及損害賠償。",
        result: "原告勝訴",
        relatedLaws: ["民法第793條", "民法第184條"],
        keywords: ["噪音", "鄰居", "排除侵害", "住居安寧"],
        date: "2019-06-18"
    },
    {
        id: "109犯罪偵查",
        court: "高等法院",
        year: 109,
        caseNumber: "偵字第5678號",
        type: "刑事",
        title: "過失致死",
        summary: "被告駕車過失撞擊行人致人死亡，依過失致死罪起訴。",
        result: "判處有期徒刑6月",
        relatedLaws: ["刑法第276條"],
        keywords: ["過失致死", "車禍", "刑事責任", "過失"],
        date: "2020-09-05"
    },
    {
        id: "108民事執行",
        court: "士林地方法院",
        year: 108,
        caseNumber: "民事執行字第123號",
        type: "民事",
        title: "強制執行",
        summary: "債權人聲請強制執行債務人財產，經拍賣後分配債權。",
        result: "執行完成",
        relatedLaws: ["強制執行法"],
        keywords: ["強制執行", "拍賣", "債權", "債務"],
        date: "2019-12-15"
    },
    {
        id: "110勞動裁決",
        court: "勞動部",
        year: 110,
        caseNumber: "勞裁字第456號",
        type: "行政",
        title: "勞動裁決",
        summary: "勞工不服雇主資遣決定，向勞動部申請裁決。",
        result: "雇主敗訴",
        relatedLaws: ["勞動基準法", "大量解僱勞工保護法"],
        keywords: ["勞動裁決", "資遣", "不當解僱"],
        date: "2021-04-20"
    },
    {
        id: "107智慧財產",
        court: "智慧財產法院",
        year: 107,
        caseNumber: "民專上字第78號",
        type: "民事",
        title: "專利侵權",
        summary: "原告主張被告產品侵害其專利權，請求損害賠償及禁止製造。",
        result: "原告勝訴",
        relatedLaws: ["專利法", "民法第184條"],
        keywords: ["專利", "侵權", "智慧財產", "損害賠償"],
        date: "2018-07-30"
    }
];

// 搜尋判例
function searchCases(query) {
    const keywords = query.toLowerCase().split(/\s+/);
    
    return CASES_DATA.filter(c => {
        const searchText = [
            c.title,
            c.summary,
            c.type,
            ...c.keywords,
            ...c.relatedLaws
        ].join(' ').toLowerCase();
        
        return keywords.some(k => searchText.includes(k));
    });
}

// 取得判例詳情
function getCaseById(id) {
    return CASES_DATA.find(c => c.id === id);
}

// 取得相關判例
function getRelatedCases(caseId, limit = 3) {
    const currentCase = getCaseById(caseId);
    if (!currentCase) return [];
    
    return CASES_DATA
        .filter(c => c.id !== caseId)
        .map(c => {
            const commonKeywords = c.keywords.filter(k => 
                currentCase.keywords.includes(k)
            ).length;
            return { ...c, score: commonKeywords };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}
