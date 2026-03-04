// Legal-RAG 法規資料庫
// 資料來源：全國法規資料庫（模擬資料）

const LAWS_DATA = {
    civil: [
        {
            id: "civil-184",
            name: "民法第184條（侵權行為）",
            category: "民法",
            chapter: "債編",
            content: "因故意或過失，不法侵害他人之權利者，負損害賠償責任。",
            lastAmended: "2023-01-18"
        }
    ],
    criminal: [
        {
            id: "criminal-271",
            name: "刑法第271條（普通殺人罪）",
            category: "刑法",
            chapter: "殺人罪",
            content: "殺人者，處死刑、無期徒刑或十年以上有期徒刑。",
            lastAmended: "2022-12-30"
        }
    ],
    administrative: [
        {
            id: "admin-行政处罚法",
            name: "行政罰法",
            category: "行政法",
            chapter: "總則",
            content: "違反行政法上義務之處罰，以裁處機關所在地之法院為管轄法院。",
            lastAmended: "2021-05-26"
        }
    ]
};

// 取得法規列表
function getLawsByCategory(category) {
    return LAWS_DATA[category] || [];
}

// 搜尋法規
function searchLaws(query) {
    const keywords = query.toLowerCase().split(/\s+/);
    const results = [];
    
    for (const category of Object.values(LAWS_DATA)) {
        category.forEach(law => {
            const searchText = [
                law.name,
                law.content,
                law.category
            ].join(' ').toLowerCase();
            
            if (keywords.some(k => searchText.includes(k))) {
                results.push(law);
            }
        });
    }
    
    return results;
}

// 取得法規詳情
function getLawById(id) {
    for (const category of Object.values(LAWS_DATA)) {
        const law = category.find(l => l.id === id);
        if (law) return law;
    }
    return null;
}
