// 法官數位孿生模組

let currentJudgeId = null;

// 初始化法官模組
function initJudgeModule() {
    renderJudgeList();
    bindJudgeEvents();
}

// 渲染法官列表
function renderJudgeList() {
    const judgeList = document.getElementById('judge-list');
    if (!judgeList) return;
    
    const judges = getJudgesList();
    
    let html = '';
    judges.forEach(judge => {
        html += `
            <div class="judge-item" data-judge-id="${judge.id}">
                <div class="judge-item-avatar">👨‍⚖️</div>
                <div class="judge-item-info">
                    <h4>${judge.name}</h4>
                   <p>${judge.court} · ${judge.years}</p>
                </div>
            </div>
        `;
    });
    
    judgeList.innerHTML = html;
}

// 綁定法官相關事件
function bindJudgeEvents() {
    // 法官選擇
    document.getElementById('judge-list')?.addEventListener('click', function(e) {
        const judgeItem = e.target.closest('.judge-item');
        if (judgeItem) {
            const judgeId = judgeItem.dataset.judgeId;
            selectJudge(judgeId);
        }
    });
    
    // 案件篩選
    document.getElementById('case-type-filter')?.addEventListener('change', function() {
        if (currentJudgeId) {
            filterCases();
        }
    });
    
    document.getElementById('case-search')?.addEventListener('input', function() {
        if (currentJudgeId) {
            filterCases();
        }
    });
    
    // 判決預測
    document.getElementById('predict-btn')?.addEventListener('click', function() {
        if (currentJudgeId) {
            doPrediction();
        } else {
            alert('請先選擇法官');
        }
    });
    
    // 相似案例搜尋
    document.getElementById('similar-search-btn')?.addEventListener('click', function() {
        if (currentJudgeId) {
            searchSimilarCases();
        } else {
            alert('請先選擇法官');
        }
    });
    
    document.getElementById('similar-query')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && currentJudgeId) {
            searchSimilarCases();
        }
    });
}

// 選擇法官
function selectJudge(judgeId) {
    currentJudgeId = judgeId;
    
    // 更新列表 active 狀態
    document.querySelectorAll('.judge-item').forEach(item => {
        item.classList.toggle('active', item.dataset.judgeId === judgeId);
    });
    
    // 渲染法官檔案
    renderJudgeProfile(judgeId);
}

// 渲染法官檔案
function renderJudgeProfile(judgeId) {
    const judge = getJudgeById(judgeId);
    if (!judge) return;
    
    // 基本資料
    document.getElementById('judge-name').textContent = judge.name;
    document.getElementById('judge-title').textContent = judge.title;
    document.getElementById('judge-court').textContent = judge.court;
    document.getElementById('judge-years').textContent = judge.years;
    
    // 統計數據
    const stats = judge.stats;
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-civil').textContent = stats.civil;
    document.getElementById('stat-criminal').textContent = stats.criminal;
    document.getElementById('stat-admin').textContent = stats.admin;
    
    // 裁決傾向圖表
    const total = stats.維持 + stats.撤銷 + stats.和解;
    const 維持Pct = Math.round((stats.維持 / total) * 100);
    const 撤銷Pct = Math.round((stats.撤銷 / total) * 100);
    const 和解Pct = Math.round((stats.和解 / total) * 100);
    
    document.getElementById('bar-維持').style.width = `${維持Pct}%`;
    document.getElementById('bar-維持').textContent = `維持 ${維持Pct}%`;
    
    document.getElementById('bar-撤銷').style.width = `${撤銷Pct}%`;
    document.getElementById('bar-撤銷').textContent = `撤銷 ${撤銷Pct}%`;
    
    document.getElementById('bar-和解').style.width = `${和解Pct}%`;
    document.getElementById('bar-和解').textContent = `和解 ${和解Pct}%`;
    
    // 審理天數
    const daysPct = Math.min((stats.avgDays / 90) * 100, 100);
    document.getElementById('bar-duration').style.width = `${daysPct}%`;
    document.getElementById('bar-duration').textContent = `${stats.avgDays} 天`;
    
    // 上訴維持率
    document.getElementById('bar-appeal').style.width = `${stats.appealRate}%`;
    document.getElementById('bar-appeal').textContent = `${stats.appealRate}%`;
    
    // 渲染判決列表
    renderJudgeCases(judge.cases);
}

// 渲染法官判決列表
function renderJudgeCases(cases) {
    const container = document.getElementById('judge-cases-list');
    if (!container) return;
    
    if (!cases || cases.length === 0) {
        container.innerHTML = '<div class="case-empty">找不到相關判決</div>';
        return;
    }
    
    let html = '';
    cases.forEach(c => {
        html += `
            <div class="timeline-item" onclick="showCaseDetail('${c.id}')">
                <div class="timeline-date">${c.date}</div>
                <div class="timeline-content">
                    <div class="timeline-title">${c.title}</div>
                    <div class="timeline-meta">${c.id} · ${c.court}</div>
                    <span class="timeline-result result-${c.result}">${c.result}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 過濾案件
function filterCases() {
    const type = document.getElementById('case-type-filter').value;
    const keyword = document.getElementById('case-search').value;
    
    const filteredCases = filterJudgeCases(currentJudgeId, type, keyword);
    renderJudgeCases(filteredCases);
}

// 判決預測
function doPrediction() {
    const caseType = document.getElementById('pred-case-type').value;
    const caseCategory = document.getElementById('pred-case-category').value;
    const plaintiff = document.getElementById('pred-plaintiff').value;
    const facts = document.getElementById('pred-facts').value;
    
    if (!caseType || !caseCategory) {
        alert('請至少選擇案件類型和類別');
        return;
    }
    
    // 顯示預測結果區塊
    const resultDiv = document.getElementById('prediction-result');
    resultDiv.classList.remove('hidden');
    
    // 模擬預測（實際應串接後端 API）
    const prediction = generatePrediction(caseType, caseCategory, plaintiff, facts);
    
    // 渲染結果
    document.getElementById('verdict-text').textContent = prediction.verdict;
    document.getElementById('confidence-value').textContent = `${prediction.confidence}%`;
    document.getElementById('confidence-bar').style.width = `${prediction.confidence}%`;
    document.getElementById('analysis-text').textContent = prediction.analysis;
}

// 生成預測結果（本地模擬）
function generatePrediction(caseType, caseCategory, plaintiff, facts) {
    const judge = getJudgeById(currentJudgeId);
    const stats = judge.stats;
    
    // 根據法官歷史統計計算傾向
    let verdict = "維持";
    let confidence = 60;
    let analysis = "";
    
    // 根據案件類型調整
    if (caseCategory === "車禍" || caseCategory === "租屋") {
        if (stats.和解 > stats.維持 * 0.1) {
            verdict = "和解";
            confidence = 65;
        }
    }
    
    if (caseCategory === "離婚") {
        verdict = "和解";
        confidence = 58;
    }
    
    // 根據法官風格調整信心指數
    const styleBonus = (stats.維持 - stats.撤銷) / 10;
    confidence = Math.min(Math.max(confidence + styleBonus, 45), 92);
    confidence = Math.round(confidence);
    
    // 生成分析文字
    const caseTypeName = caseType || "案件";
    const categoryName = caseCategory || "類型";
    
    analysis = `根據 ${judge.name} 法官過去 ${stats.total} 件案件的統計分析：
    
• 法官偏好的裁決方式主要為「維持原判」(${Math.round((stats.維持/(stats.維持+stats.撤銷+stats.和解))*100)}%)
• 平均審理天數為 ${stats.avgDays} 天
• 上訴維持率達 ${stats.appealRate}%

在此案件中，法官對 ${categoryName} 類型案件有豐富經驗，預測最可能的結果為「${verdict}」，信心指數為 ${confidence}%。

注意：此預測僅供參考，實際裁決仍需依據案件具體事證及法律規定。`;
    
    return {
        verdict: verdict,
        confidence: confidence,
        analysis: analysis
    };
}

// 相似案例搜尋
function searchSimilarCases() {
    const query = document.getElementById('similar-query').value.trim();
    const container = document.getElementById('similar-results');
    
    if (!query) {
        container.innerHTML = '<div class="case-empty">請輸入案件描述以尋找相似案例</div>';
        return;
    }
    
    // 模擬相似案例搜尋
    const similarCases = findSimilarCases(query);
    
    if (similarCases.length === 0) {
        container.innerHTML = '<div class="case-empty">找不到相似案例</div>';
        return;
    }
    
    // 渲染相似案例
    let html = '';
    similarCases.forEach(item => {
        html += `
            <div class="similar-item" onclick="showCaseDetail('${item.case.id}')">
                <div class="similarity-score">
                    <span class="similarity-value">${item.similarity}%</span>
                    <span class="similarity-label">相似度</span>
                </div>
                <div class="similar-content">
                    <div class="similar-title">${item.case.title}</div>
                    <div class="similar-meta">${item.case.id} · ${item.case.date} · ${item.case.type}</div>
                    <div class="similar-summary">${item.case.summary}</div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 找相似案例（本地模擬）
function findSimilarCases(query) {
    const judge = getJudgeById(currentJudgeId);
    const allCases = judge.cases;
    
    // 簡單關鍵字比對
    const q = query.toLowerCase();
    const queryKeywords = q.split(/[\s,，]+/).filter(k => k.length > 1);
    
    // 計算每個案例的相似度
    const scored = allCases.map(c => {
        let score = 0;
        const title = c.title.toLowerCase();
        
        queryKeywords.forEach(kw => {
            if (title.includes(kw)) score += 30;
        });
        
        // 如果有類型關鍵字
        if (q.includes('車禍') && title.includes('車禍')) score += 20;
        if (q.includes('離婚') && title.includes('離婚')) score += 20;
        if (q.includes('租屋') && (title.includes('租') || title.includes('押金'))) score += 20;
        
        return { case: c, similarity: Math.min(score, 95) };
    });
    
    // 排序並取前5個
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.filter(s => s.similarity > 0).slice(0, 5);
}

// 導出全域函數
window.initJudgeModule = initJudgeModule;
window.selectJudge = selectJudge;
window.renderJudgeProfile = renderJudgeProfile;
window.renderJudgeCases = renderJudgeCases;
window.filterCases = filterCases;
window.doPrediction = doPrediction;
window.searchSimilarCases = searchSimilarCases;
