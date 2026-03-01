// Legal-RAG 搜尋模組

const API_BASE = '/api/judicial';

// 搜尋處理器 - 改為呼叫後端 API
async function handleSearch(query) {
    if (!query || query.trim() === '') return null;
    
    const trimmedQuery = query.trim();
    
    try {
        // 呼叫後端 API 搜尋
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(trimmedQuery)}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            const cases = result.data || [];
            
            // 搜尋法規（本地）
            const laws = searchLaws(trimmedQuery);
            
            // 熱門問題
            const hotAnswers = getHotAnswers(trimmedQuery);
            
            return {
                query: trimmedQuery,
                cases: cases,
                laws: laws.slice(0, 3),
                hotAnswers: hotAnswers
            };
        }
    } catch (error) {
        console.error('搜尋API錯誤:', error);
    }
    
    // 如果 API 失敗，使用本地備援
    const cases = searchCases(trimmedQuery);
    const laws = searchLaws(trimmedQuery);
    const hotAnswers = getHotAnswers(trimmedQuery);
    
    return {
        query: trimmedQuery,
        cases: cases,
        laws: laws.slice(0, 3),
        hotAnswers: hotAnswers
    };
}

// 同步版本（用於向後相容）
function handleSearchSync(query) {
    if (!query || query.trim() === '') return null;
    
    const trimmedQuery = query.trim();
    const cases = searchCases(trimmedQuery);
    const laws = searchLaws(trimmedQuery);
    const hotAnswers = getHotAnswers(trimmedQuery);
    
    return {
        query: trimmedQuery,
        cases: cases,
        laws: laws.slice(0, 3),
        hotAnswers: hotAnswers
    };
}

// 熱門問題回答
function getHotAnswers(query) {
    const q = query.toLowerCase();
    
    const answers = {
        '車禍': {
            title: '車禍責任與賠償',
            content: `車禍發生時，責任認定主要依據過失責任原則：

1. **過失認定**：根據民法第184條，行為人因過失不法侵害他人權利者，應負損害賠償責任。

2. **請求項目**：
   - 醫療費用（民法第193條）
   - 財產損失
   - 精神慰撫金（民法第195條）
   - 誤工損失

3. **刑事責任**：
   - 過失傷害：刑法第284條
   - 過失致死：刑法第276條

4. **處理建議**：
   - 保留事故現場照片
   - 報警並取得事故證明
   - 就醫並保留單據
   - 必要時聘請律師提告`,
            relatedCases: ['109台上1234', '109犯罪偵查']
        },
        '離婚': {
            title: '離婚程序與            content: `台灣離婚主要有監護權',
兩種方式：

1. **協議離婚**（民法第1049條）：
   - 雙方同意
   - 簽訂離婚協議書
   - 至少有2名證人簽名
   - 戶政機關登記

2. **裁判離婚**（民法第1052條）：
   - 一方有重大過失
   - 分居達一定期間
   - 其他法定原因

3. **子女監護權**（民法第1055條）：
   - 以子女最佳利益為原則
   - 父母雙方都有權利義務
   - 可協議或由法院裁定

4. **財產分配**：
   - 剩餘財產分配請求權（民法第1030-1條）`,
            relatedCases: ['108台上5678']
        },
        '租屋': {
            title: '租屋糾紛處理',
            content: `常見租屋糾紛處理方式：

1. **押金爭議**（民法第423條、第429條）：
   - 押金最高不得超過2個月租金
   - 租期滿或提前終止租約時應退還
   - 扣除費用應提出單據

2. **提前終止租約**：
   - 須符合法定事由
   - 提前通知對方
   - 賠償要約定或依法

3. **房屋損害**：
   - 正常損耗由房東負責
   - 承租人過失造成的損壞應賠償

4. **調解途徑**：
   - 鄉鎮市調解委員會
   - 法院調解
   - 消保會申訴`,
            relatedCases: ['109重上912', '108簡上2045']
        },
        '繼承': {
            title: '繼承順位與分配',
            content: `台灣繼承制度說明：

1. **法定繼承順位**（民法第1138條）：
   - 第一順位：直系血親卑親屬
   - 第二順位：父母
   - 第三順位：兄弟姐妹
   - 第四順位：祖父母

2. **特留分**（民法第1223條）：
   - 直系血親卑親屬：應繼分1/2
   - 父母：應繼分1/2
   - 兄弟姐妹：應繼分1/3
   - 祖父母：應繼分1/3

3. **拋棄繼承**：
   - 須在知悉繼承時起3個月內
   - 向法院聲請
   - 書面表示

4. **遺產分配**：
   - 可用遺囑指定分配
   - 無遺囑時依法定比例`,
            relatedCases: ['107台上3456']
        },
        '勞動': {
            title: '勞動權益與爭議',
            content: `勞工權益說明：

1. **雇主終止契約**（勞動基準法第11條）：
   - 須符合法定事由
   - 須預告期間
   - 違法解僱可請求復職或資遣費

2. **資遣費**（勞動基準法第17條）：
   - 每滿1年發給1個月平均工資
   - 未滿1年按比例計算

3. **職業災害**：
   - 雇主應負補償責任
   - 包括醫療費用、薪資補償等

4. **勞動爭議處理**：
   - 勞動部調解
   - 勞動裁決
   - 民事訴訟`,
            relatedCases: ['110台上789', '110勞動裁決']
        }
    };
    
    // 找到最相關的回答
    for (const [key, answer] of Object.entries(answers)) {
        if (q.includes(key)) {
            return answer;
        }
    }
    
    return null;
}

// 渲染搜尋結果
function renderSearchResults(results) {
    const casesList = document.getElementById('cases-list');
    
    if (!results || (results.cases.length === 0 && results.laws.length === 0 && !results.hotAnswers)) {
        casesList.innerHTML = '<div class="case-empty">找不到相關資料，請嘗試其他關鍵字</div>';
        return;
    }
    
    let html = '';
    
    // 顯示相關判例
    if (results.cases.length > 0) {
        results.cases.forEach(c => {
            html += `
                <div class="case-item" onclick="showCaseDetail('${c.JID || c.id}')">
                    <div class="case-title">${c.JTITLE || c.title || '案件'}</div>
                    <div class="case-meta">${c.JDATE || c.date || ''}</div>
                    <div class="case-summary">${c.JFULLX?.JFULLCONTENT || c.summary || ''}</div>
                    <div class="case-tags">
                        ${(c.keywords || []).map(k => `<span class="case-tag">${k}</span>`).join('')}
                    </div>
                </div>
            `;
        });
    }
    
    // 顯示相關法規
    if (results.laws && results.laws.length > 0) {
        html += '<h4 style="margin-top:20px;color:var(--gold);">相關法規：</h4>';
        results.laws.forEach(l => {
            html += `
                <div class="case-item" onclick="showLawDetail('${l.id}')">
                    <div class="case-title">${l.name}</div>
                    <div class="case-summary">${l.content.substring(0, 100)}...</div>
                </div>
            `;
        });
    }
    
    casesList.innerHTML = html;
}
