// Legal-RAG 主程式

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

// 執行搜尋 - 改為非同步
async function doSearch() {
    const query = document.getElementById('search-input').value;
    if (!query) return;
    
    // 顯示載入中
    const casesList = document.getElementById('cases-list');
    casesList.innerHTML = '<div class="case-empty">搜尋中...</div>';
    
    const results = await handleSearch(query);
    renderSearchResults(results);
}

// 執行問答 - 改為非同步
async function doAsk() {
    const question = document.getElementById('qa-input').value;
    if (!question) return;
    
    // 執行 RAG 問答
    const result = askRAG(question);
    
    // 渲染回答
    renderQA(result);
    
    // 更新判例列表
    const searchResults = await handleSearch(question);
    renderSearchResults(searchResults);
    
    // 清空輸入
    document.getElementById('qa-input').value = '';
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
