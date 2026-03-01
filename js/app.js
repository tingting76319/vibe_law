// Legal-RAG 主程式

// API 端點配置
const API_BASE = '/api';

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    // 初始化法規顯示
    renderLaws('civil');
    
    // 綁定事件
    bindEvents();
}

function bindEvents() {
    // 搜尋按鈕
    document.getElementById('search-btn').addEventListener('click', doSearch);
    
    // 搜尋框 Enter 鍵
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') doSearch();
    });
    
    // 問答輸入
    document.getElementById('ask-btn').addEventListener('click', doAsk);
    document.getElementById('qa-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') doAsk();
    });
    
    // 清除按鈕
    document.getElementById('clear-chat').addEventListener('click', function() {
        clearQA();
    });
    
    // 快速搜尋標籤
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const query = this.dataset.query;
            document.getElementById('search-input').value = query;
            document.getElementById('qa-input').value = query;
            doSearch();
            doAsk();
        });
    });
    
    // 熱門問題卡片
    document.querySelectorAll('.topic-card').forEach(card => {
        card.addEventListener('click', function() {
            const query = this.dataset.query;
            document.getElementById('search-input').value = query;
            document.getElementById('qa-input').value = query;
            doSearch();
            doAsk();
        });
    });
    
    // 法規分類標籤
    document.querySelectorAll('.law-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // 更新 active 狀態
            document.querySelectorAll('.law-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 渲染法規
            const category = this.dataset.law;
            renderLaws(category);
        });
    });
}

// 執行搜尋
async function doSearch() {
    const query = document.getElementById('search-input').value;
    if (!query) return;
    
    // 顯示載入中
    const casesList = document.getElementById('cases-list');
    casesList.innerHTML = '<div class="case-empty"><span class="loading-spinner"></span> 搜尋中...</div>';
    
    const results = await handleSearch(query);
    renderSearchResults(results);
}

// 執行問答 - 串接 RAG API
async function doAsk() {
    const question = document.getElementById('qa-input').value;
    if (!question) return;
    
    // 顯示載入狀態
    const qaHistory = document.getElementById('qa-history');
    const loadingHtml = `
        <div class="qa-item loading-item">
            <div class="question">
                <span class="question-label">問題</span>
                <span>${question}</span>
            </div>
            <div class="answer">
                <span class="answer-label">回答</span>
                <div class="answer-content">
                    <div class="loading-indicator">
                        <span class="loading-spinner"></span>
                        <span>AI 正在分析問題並生成回答...</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除歡迎訊息
    const welcomeMsg = qaHistory.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    // 添加載入中的問答
    qaHistory.insertAdjacentHTML('afterbegin', loadingHtml);
    qaHistory.scrollTop = 0;
    
    try {
        // 呼叫 RAG API
        const response = await fetch(`${API_BASE}/rag/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: question })
        });
        
        const result = await response.json();
        
        // 移除載入中的問答
        const loadingItem = qaHistory.querySelector('.loading-item');
        if (loadingItem) {
            loadingItem.remove();
        }
        
        if (result.status === 'success') {
            // 渲染 AI 回答
            renderQA({
                question: question,
                answer: {
                    title: result.data?.title || 'AI 回答',
                    content: result.data?.answer || result.data?.content || '無法取得回答'
                },
                relatedCases: result.data?.relatedCases || [],
                sources: result.data?.sources || []
            });
        } else {
            // API 回傳錯誤，使用本地備援
            console.error('RAG API 錯誤:', result.message);
            const fallbackResult = askRAGLocal(question);
            renderQA(fallbackResult);
        }
    } catch (error) {
        console.error('RAG API 請求失敗:', error);
        
        // 移除載入中的問答
        const loadingItem = qaHistory.querySelector('.loading-item');
        if (loadingItem) {
            loadingItem.remove();
        }
        
        // 使用本地備援
        const fallbackResult = askRAGLocal(question);
        renderQA(fallbackResult);
    }
    
    // 更新判例列表
    const searchResults = await handleSearch(question);
    renderSearchResults(searchResults);
    
    // 清空輸入
    document.getElementById('qa-input').value = '';
}

// 本地備援 RAG 問答（當 API 不可用時）
function askRAGLocal(question) {
    const searchResults = handleSearch(question);
    return generateLocalAnswer(question, searchResults);
}

// 生成本地回答
function generateLocalAnswer(question, searchResults) {
    const q = question.toLowerCase();
    
    // 預設回答模板
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
   - 必要時聘請律師提告`
        },
        '離婚': {
            title: '離婚程序與監護權',
            content: `台灣離婚主要有兩種方式：

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
   - 剩餘財產分配請求權（民法第1030-1條）`
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
   - 消保會申訴`
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
   - 無遺囑時依法定比例`
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
   - 民事訴訟`
        }
    };
    
    // 找到最相關的回答
    for (const [key, answer] of Object.entries(answers)) {
        if (q.includes(key)) {
            return {
                question: question,
                answer: answer,
                relatedCases: searchResults?.cases || [],
                sources: []
            };
        }
    }
    
    // 沒有預設回答時，使用搜尋結果生成
    const cases = searchResults?.cases || [];
    const laws = searchResults?.laws || [];
    
    let content = `根據搜尋結果，找到 ${cases.length} 個相關判例和 ${laws.length} 條相關法規：\n\n`;
    
    if (laws.length > 0) {
        content += `## 相關法規\n\n`;
        laws.forEach(law => {
            content += `**${law.name}**\n`;
            content += law.content.substring(0, 300) + '...\n\n';
        });
    }
    
    if (cases.length > 0) {
        content += `## 相關判例\n\n`;
        cases.slice(0, 2).forEach(c => {
            content += `- ${c.court || ''} ${c.year || ''}年 ${c.caseNumber || ''}：${c.title || ''}\n`;
            content += `  ${(c.summary || '').substring(0, 80)}...\n\n`;
        });
    }
    
    content += `---\n\n以上資訊僅供參考，不構成法律意見。如有具體法律問題，建議諮詢專業律師。`;
    
    return {
        question: question,
        answer: {
            title: '搜尋結果',
            content: content
        },
        relatedCases: cases,
        sources: []
    };
}

// 渲染法規
function renderLaws(category) {
    const container = document.getElementById('laws-content');
    const laws = getLawsByCategory(category);
    
    if (laws.length === 0) {
        container.innerHTML = '<div class="case-empty">載入中...</div>';
        return;
    }
    
    let html = '';
    laws.forEach(law => {
        html += `
            <div class="law-item">
                <div class="law-name">${law.name}</div>
                <div class="law-content">${law.content}</div>
                <div class="law-meta">最近修訂：${law.lastAmended}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 顯示判例詳情（全局）
window.showCaseDetail = showCaseDetail;
window.showLawDetail = showLawDetail;
window.getCaseById = getCaseById;
window.getLawById = getLawById;
