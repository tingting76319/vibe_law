// 法官案件時間線 & 案件脈絡圖模組 v1.4
// Graph RAG 強化功能

let currentCaseId = null;

// 初始化時間線模組
function initTimelineModule() {
    console.log('[Timeline] 初始化法官案件時間線模組');
    bindTimelineEvents();
}

// 初始化脈絡圖模組
function initContextGraphModule() {
    console.log('[ContextGraph] 初始化案件脈絡圖模組');
    bindContextGraphEvents();
}

// ========== 法官案件時間線功能 ==========

// 綁定時間線事件
function bindTimelineEvents() {
    // 法官選擇變更
    document.getElementById('judge-list')?.addEventListener('click', function(e) {
        const judgeCard = e.target.closest('.judge-card');
        if (judgeCard) {
            const judgeId = judgeCard.dataset.judgeId;
            loadJudgeTimeline(judgeId);
        }
    });

    // 時間線篩選
    document.getElementById('timeline-type-filter')?.addEventListener('change', function() {
        if (currentJudgeId) {
            loadJudgeTimeline(currentJudgeId);
        }
    });

    // 相似案件點擊
    document.getElementById('similar-cases-list')?.addEventListener('click', function(e) {
        const caseItem = e.target.closest('.similar-case-item');
        if (caseItem) {
            const caseId = caseItem.dataset.caseId;
            showCaseContext(caseId);
        }
    });
}

// 載入法官時間線
async function loadJudgeTimeline(judgeId) {
    currentJudgeId = judgeId;
    const timelineContainer = document.getElementById('judge-timeline');
    const similarCasesContainer = document.getElementById('similar-cases-list');
    
    if (!timelineContainer) return;

    // 顯示載入中
    timelineContainer.innerHTML = '<div class="loading">載入時間線中...</div>';

    try {
        // 取得法官資料
        const judge = getJudgeById(judgeId);
        if (!judge) {
            timelineContainer.innerHTML = '<div class="error">找不到法官資料</div>';
            return;
        }

        // 取得法官案件
        let cases = getJudgeCases(judgeId);
        
        // 套用篩選
        const typeFilter = document.getElementById('timeline-type-filter')?.value;
        if (typeFilter && typeFilter !== 'all') {
            cases = cases.filter(c => c.type === typeFilter);
        }

        // 依日期排序
        cases.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 渲染時間線
        renderJudgeTimeline(cases, judge);

        // 載入相似案件
        loadSimilarCases(judgeId, cases);

    } catch (error) {
        console.error('[Timeline] 載入錯誤:', error);
        timelineContainer.innerHTML = '<div class="error">載入失敗: ' + error.message + '</div>';
    }
}

// 渲染法官時間線
function renderJudgeTimeline(cases, judge) {
    const timelineContainer = document.getElementById('judge-timeline');
    if (!timelineContainer) return;

    if (cases.length === 0) {
        timelineContainer.innerHTML = '<div class="empty">尚無案件資料</div>';
        return;
    }

    let html = `
        <div class="timeline-header">
            <h3>📅 ${judge.name} 法官案件時間線</h3>
            <div class="timeline-filters">
                <select id="timeline-type-filter" class="filter-select">
                    <option value="all">全部案件類型</option>
                    <option value="民事">民事</option>
                    <option value="刑事">刑事</option>
                    <option value="行政">行政</option>
                </select>
            </div>
        </div>
        <div class="timeline-list">
    `;

    cases.forEach((caseItem, index) => {
        const resultClass = getResultClass(caseItem.result);
        const typeIcon = getCaseTypeIcon(caseItem.type);
        
        html += `
            <div class="timeline-item ${resultClass}" data-case-id="${caseItem.id}">
                <div class="timeline-marker">
                    <div class="marker-dot"></div>
                    ${index < cases.length - 1 ? '<div class="marker-line"></div>' : ''}
                </div>
                <div class="timeline-content">
                    <div class="timeline-date">${formatDate(caseItem.date)}</div>
                    <div class="timeline-case">
                        <span class="case-type-badge">${typeIcon} ${caseItem.type}</span>
                        <span class="case-result-badge ${resultClass}">${caseItem.result}</span>
                    </div>
                    <div class="timeline-title">${caseItem.title}</div>
                    <div class="timeline-meta">
                        <span class="case-id">${caseItem.id}</span>
                        <span class="case-court">${caseItem.court}</span>
                    </div>
                    <button class="btn-view-context" data-case-id="${caseItem.id}">
                        查看脈絡 🔗
                    </button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    timelineContainer.innerHTML = html;

    // 綁定脈絡圖按鈕事件
    timelineContainer.querySelectorAll('.btn-view-context').forEach(btn => {
        btn.addEventListener('click', function() {
            const caseId = this.dataset.caseId;
            switchView('case-context');
            loadCaseContextGraph(caseId);
        });
    });
}

// 載入相似案件
function loadSimilarCases(judgeId, currentCases) {
    const container = document.getElementById('similar-cases-list');
    if (!container) return;

    // 模擬相似案件（基於案件類型和關鍵字）
    const allCases = getJudgesList()
        .filter(j => j.id !== judgeId)
        .flatMap(j => j.cases.map(c => ({...c, judgeName: j.name, judgeId: j.id})));

    // 找出相似案件
    const similarCases = findSimilarCases(currentCases, allCases, 5);

    if (similarCases.length === 0) {
        container.innerHTML = '<div class="empty">無相似案件</div>';
        return;
    }

    let html = '<h4>🔍 相似案件</h4><div class="similar-cases-grid">';
    similarCases.forEach(caseItem => {
        html += `
            <div class="similar-case-item" data-case-id="${caseItem.id}">
                <div class="similar-case-header">
                    <span class="case-type">${caseItem.type}</span>
                    <span class="case-score">相似度 ${caseItem.similarity}%</span>
                </div>
                <div class="similar-case-title">${caseItem.title}</div>
                <div class="similar-case-meta">
                    <span>${caseItem.judgeName} 法官</span>
                    <span>${formatDate(caseItem.date)}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// 找出相似案件
function findSimilarCases(currentCases, allCases, limit) {
    const currentTypes = [...new Set(currentCases.map(c => c.type))];
    const currentKeywords = currentCases.flatMap(c => c.title.split('')).slice(0, 10);

    return allCases
        .map(c => {
            let score = 0;
            // 案件類型匹配
            if (currentTypes.includes(c.type)) score += 30;
            // 關鍵字匹配
            const keywords = c.title.split('');
            score += keywords.filter(k => currentKeywords.includes(k)).length * 5;
            // 時間接近度
            const currentYears = currentCases.map(c => new Date(c.date).getFullYear());
            const caseYear = new Date(c.date).getFullYear();
            if (currentYears.includes(caseYear)) score += 20;

            return {...c, similarity: Math.min(score, 100)};
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
}

// ========== 案件脈絡圖功能 ==========

// 綁定脈絡圖事件
function bindContextGraphEvents() {
    // 案件搜尋
    document.getElementById('context-case-search')?.addEventListener('click', function() {
        const caseId = document.getElementById('context-search-input')?.value;
        if (caseId) {
            loadCaseContextGraph(caseId);
        }
    });

    // 鍵盤事件
    document.getElementById('context-search-input')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadCaseContextGraph(this.value);
        }
    });
}

// 載入案件脈絡圖
async function loadCaseContextGraph(caseId) {
    const graphContainer = document.getElementById('case-context-graph');
    const timelineContainer = document.getElementById('case-timeline-visual');
    
    if (!graphContainer) return;

    // 顯示載入中
    graphContainer.innerHTML = '<div class="loading">載入脈絡圖中...</div>';

    try {
        // 取得案件脈絡資料
        const contextData = getCaseContext(caseId);
        
        if (!contextData) {
            graphContainer.innerHTML = '<div class="error">找不到案件資料</div>';
            return;
        }

        // 渲染脈絡圖
        renderCaseContextGraph(contextData, graphContainer);
        
        // 渲染時間線視覺化
        if (timelineContainer) {
            renderCaseTimelineVisual(contextData, timelineContainer);
        }

    } catch (error) {
        console.error('[ContextGraph] 載入錯誤:', error);
        graphContainer.innerHTML = '<div class="error">載入失敗: ' + error.message + '</div>';
    }
}

// 取得案件脈絡資料（模擬）
function getCaseContext(caseId) {
    // 模擬脈絡資料
    const caseData = getCaseById(caseId) || searchCases(caseId)[0];
    
    if (!caseData) {
        // 嘗試從法官資料中找
        const allJudges = getJudgesList();
        for (const judge of allJudges) {
            const found = judge.cases.find(c => c.id === caseId);
            if (found) {
                return {
                    mainCase: found,
                    history: generateCaseHistory(found),
                    relatedCases: findRelatedFromJudge(judge, found),
                    appeal: generateAppealHistory(found)
                };
            }
        }
        return null;
    }

    return {
        mainCase: caseData,
        history: generateCaseHistory(caseData),
        relatedCases: [],
        appeal: generateAppealHistory(caseData)
    };
}

// 生成案件歷史
function generateCaseHistory(caseData) {
    // 模擬上訴、發回、更審歷史
    const history = [];
    const year = new Date(caseData.date).getFullYear();
    
    // 添加初始案件
    history.push({
        id: caseData.id,
        date: caseData.date,
        court: caseData.court || '地方法院',
        type: '一審',
        result: caseData.result || '判決',
        description: '案件起始'
    });

    // 模擬上訴歷程
    if (Math.random() > 0.3) {
        history.push({
            id: `${caseData.id}-上訴`,
            date: `${year + 1}-03-${Math.floor(Math.random() * 28) + 1}`,
            court: '高等法院',
            type: '二審',
            result: Math.random() > 0.5 ? '上訴駁回' : '發回更審',
            description: '上訴至高等法院'
        });

        // 模擬更審
        if (Math.random() > 0.5) {
            history.push({
                id: `${caseData.id}-更審`,
                date: `${year + 2}-06-${Math.floor(Math.random() * 28) + 1}`,
                court: '地方法院',
                type: '更審',
                result: '和解',
                description: '發回地方法院更審'
            });
        }

        // 模擬最終上訴
        if (Math.random() > 0.5) {
            history.push({
                id: `${caseData.id}-最終`,
                date: `${year + 3}-01-${Math.floor(Math.random() * 28) + 1}`,
                court: '最高法院',
                type: '三審',
                result: '上訴駁回',
                description: '最終上訴至最高法院'
            });
        }
    }

    return history.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// 從法官資料找相關案件
function findRelatedFromJudge(judge, currentCase) {
    return judge.cases
        .filter(c => c.id !== currentCase.id)
        .slice(0, 3);
}

// 生成上訴歷史
function generateAppealHistory(caseData) {
    const history = generateCaseHistory(caseData);
    return history.filter(h => h.type !== '一審');
}

// 渲染案件脈絡圖
function renderCaseContextGraph(contextData, container) {
    const { mainCase, history, relatedCases } = contextData;

    let html = `
        <div class="context-graph-header">
            <h3>🔗 案件脈絡圖</h3>
            <div class="context-search-box">
                <input type="text" id="context-search-input" placeholder="輸入案件編號" value="${mainCase.id}">
                <button id="context-case-search" class="search-btn">🔍</button>
            </div>
        </div>
        <div class="context-main-case">
            <div class="case-card primary">
                <div class="case-header">
                    <span class="case-id">${mainCase.id}</span>
                    <span class="case-type">${mainCase.type}</span>
                </div>
                <div class="case-title">${mainCase.title || mainCase.summary?.slice(0, 30)}</div>
                <div class="case-result">${mainCase.result}</div>
            </div>
        </div>
        <div class="context-flow">
            <h4>📊 案件流程</h4>
            <div class="flow-chart">
    `;

    // 渲染流程圖
    history.forEach((step, index) => {
        const isLast = index === history.length - 1;
        const resultClass = getResultClass(step.result);
        
        html += `
            <div class="flow-node ${resultClass}">
                <div class="flow-step">${step.type}</div>
                <div class="flow-court">${step.court}</div>
                <div class="flow-result">${step.result}</div>
                <div class="flow-date">${formatDate(step.date)}</div>
                ${!isLast ? '<div class="flow-arrow">↓</div>' : ''}
            </div>
        `;
    });

    html += '</div></div>';

    // 顯示相關案件
    if (relatedCases.length > 0) {
        html += `
            <div class="context-related">
                <h4>📎 相關案件</h4>
                <div class="related-cases-list">
        `;
        relatedCases.forEach(c => {
            html += `
                <div class="related-case-item" data-case-id="${c.id}">
                    <span class="case-id">${c.id}</span>
                    <span class="case-title">${c.title}</span>
                    <span class="case-result">${c.result}</span>
                </div>
            `;
        });
        html += '</div></div>';
    }

    container.innerHTML = html;

    // 綁定相關案件點擊
    container.querySelectorAll('.related-case-item').forEach(item => {
        item.addEventListener('click', function() {
            const caseId = this.dataset.caseId;
            loadCaseContextGraph(caseId);
        });
    });
}

// 渲染時間線視覺化
function renderCaseTimelineVisual(contextData, container) {
    const { history } = contextData;
    
    if (!container || history.length === 0) return;

    const startDate = new Date(history[0].date);
    const endDate = new Date(history[history.length - 1].date);
    const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

    let html = '<div class="visual-timeline">';
    
    history.forEach((step, index) => {
        const stepDate = new Date(step.date);
        const daysFromStart = (stepDate - startDate) / (1000 * 60 * 60 * 24);
        const position = totalDays > 0 ? (daysFromStart / totalDays) * 100 : 50;
        
        html += `
            <div class="visual-timeline-item" style="left: ${position}%">
                <div class="visual-marker ${getResultClass(step.result)}"></div>
                <div class="visual-label">
                    <span class="step-type">${step.type}</span>
                    <span class="step-date">${formatDate(step.date)}</span>
                </div>
            </div>
        `;
    });

    html += '<div class="visual-line"></div></div>';
    container.innerHTML = html;
}

// ========== 輔助函數 ==========

// 取得結果樣式類別
function getResultClass(result) {
    if (!result) return 'neutral';
    if (result.includes('維持') || result.includes('駁回') || result.includes('勝訴')) return 'success';
    if (result.includes('撤銷') || result.includes('發回') || result.includes('敗訴')) return 'warning';
    if (result.includes('和解')) return 'info';
    return 'neutral';
}

// 取得案件類型圖示
function getCaseTypeIcon(type) {
    const icons = {
        '民事': '⚖️',
        '刑事': '🔨',
        '行政': '🏛️',
        '家事': '👨‍👩‍👧',
        '少年': '👦',
        '憲法': '📜'
    };
    return icons[type] || '📄';
}

// 格式化日期
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-TW', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// 顯示案件脈絡
function showCaseContext(caseId) {
    switchView('case-context');
    loadCaseContextGraph(caseId);
}

// ========== API 模擬 ==========

// 模擬 API 請求（實際請替换為真實 API）
async function fetchJudgeTimeline(judgeId) {
    // 模擬延遲
    await new Promise(resolve => setTimeout(resolve, 500));
    return getJudgeCases(judgeId);
}

async function fetchCaseContext(caseId) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return getCaseContext(caseId);
}
