// 法官數位孿生模組 v0.6
// Enhanced with: 統計儀表板、趨勢圖表、風格分類、搜尋功能

let currentJudgeId = null;

// 法官風格分類
const JUDGE_STYLES = {
    '維持派': { icon: '⚖️', color: '#48bb78', description: '傾向維持原判' },
    '撤銷派': { icon: '🔄', color: '#fc8181', description: '傾向撤銷發回' },
    '和解派': { icon: '🤝', color: '#f6ad55', description: '傾向調解和解' },
    '效率派': { icon: '⚡', color: '#63b3ed', description: '審理速度快' },
    '謹慎派': { icon: '📋', color: '#9f7aea', description: '審理較為謹慎' }
};

// 初始化法官模組
function initJudgeModule() {
    renderJudgeList();
    bindJudgeEvents();
    initJudgeSearchFilters();
}

// 初始化法官搜尋篩選器
function initJudgeSearchFilters() {
    // 填充法院選項
    const courtFilter = document.getElementById('judge-court-filter');
    if (courtFilter) {
        const courts = getAllCourts();
        let options = '<option value="">全部法院</option>';
        courts.forEach(court => {
            options += `<option value="${court}">${court}</option>`;
        });
        courtFilter.innerHTML = options;
    }

    // 填充專長選項
    const specialtyFilter = document.getElementById('judge-specialty-filter');
    if (specialtyFilter) {
        const specialties = getAllSpecialties();
        let options = '<option value="">全部專長</option>';
        specialties.forEach(s => {
            options += `<option value="${s}">${s}</option>`;
        });
        specialtyFilter.innerHTML = options;
    }

    // 填充風格選項
    const styleFilter = document.getElementById('judge-style-filter');
    if (styleFilter) {
        let options = '<option value="">全部風格</option>';
        Object.keys(JUDGE_STYLES).forEach(style => {
            options += `<option value="${style}">${JUDGE_STYLES[style].icon} ${style}</option>`;
        });
        styleFilter.innerHTML = options;
    }

    // 綁定篩選事件
    document.getElementById('judge-court-filter')?.addEventListener('change', filterJudges);
    document.getElementById('judge-specialty-filter')?.addEventListener('change', filterJudges);
    document.getElementById('judge-style-filter')?.addEventListener('change', filterJudges);
    document.getElementById('judge-search-input')?.addEventListener('input', filterJudges);
}

// 取得所有法院
function getAllCourts() {
    const judges = getJudgesList();
    const courts = [...new Set(judges.map(j => j.court))];
    return courts.sort();
}

// 取得所有專長
function getAllSpecialties() {
    const judges = getJudgesList();
    const specialties = new Set();
    judges.forEach(j => {
        if (j.specialties) {
            j.specialties.forEach(s => specialties.add(s));
        }
    });
    return [...specialties].sort();
}

// 計算法官風格
function calculateJudgeStyle(judge) {
    const stats = judge.stats;
    const total = stats.維持 + stats.撤銷 + stats.和解;
    
    const 維持率 = (stats.維持 / total) * 100;
    const 撤銷率 = (stats.撤銷 / total) * 100;
    const 和解率 = (stats.和解 / total) * 100;
    
    // 根據統計計算風格
    if (維持率 > 70) return '維持派';
    if (撤銷率 > 25) return '撤銷派';
    if (和解率 > 20) return '和解派';
    if (stats.avgDays < 40) return '效率派';
    if (stats.avgDays > 60) return '謹慎派';
    
    return '維持派'; // 預設
}

// 過濾法官
function filterJudges() {
    const court = document.getElementById('judge-court-filter')?.value || '';
    const specialty = document.getElementById('judge-specialty-filter')?.value || '';
    const style = document.getElementById('judge-style-filter')?.value || '';
    const keyword = document.getElementById('judge-search-input')?.value?.toLowerCase() || '';
    
    let judges = getJudgesList();
    
    // 按法院過濾
    if (court) {
        judges = judges.filter(j => j.court === court);
    }
    
    // 按專長過濾
    if (specialty) {
        judges = judges.filter(j => j.specialties && j.specialties.includes(specialty));
    }
    
    // 按風格過濾
    if (style) {
        judges = judges.filter(j => calculateJudgeStyle(j) === style);
    }
    
    // 按關鍵字過濾
    if (keyword) {
        judges = judges.filter(j => 
            j.name.includes(keyword) || 
            j.court.includes(keyword) ||
            (j.specialties && j.specialties.some(s => s.includes(keyword)))
        );
    }
    
    renderFilteredJudges(judges);
}

// 渲染過濾後的法官列表
function renderFilteredJudges(judges) {
    const judgeList = document.getElementById('judge-list');
    if (!judgeList) return;
    
    if (judges.length === 0) {
        judgeList.innerHTML = '<div class="case-empty">找不到符合條件的法官</div>';
        return;
    }
    
    let html = '';
    judges.forEach(judge => {
        const style = calculateJudgeStyle(judge);
        const styleInfo = JUDGE_STYLES[style];
        
        html += `
            <div class="judge-item ${judge.id === currentJudgeId ? 'active' : ''}" data-judge-id="${judge.id}">
                <div class="judge-item-avatar">👨‍⚖️</div>
                <div class="judge-item-info">
                    <h4>${judge.name}</h4>
                    <p>${judge.court} · ${judge.years}</p>
                    <div class="judge-item-tags">
                        <span class="judge-tag style-${style}" style="background: ${styleInfo.color}20; color: ${styleInfo.color}">
                            ${styleInfo.icon} ${style}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });
    
    judgeList.innerHTML = html;
}

// 渲染法官列表
function renderJudgeList() {
    renderFilteredJudges(getJudgesList());
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
    
    // 計算風格
    const style = calculateJudgeStyle(judge);
    const styleInfo = JUDGE_STYLES[style];
    
    // 更新風格標籤
    let styleHtml = document.getElementById('judge-style-tag');
    if (!styleHtml) {
        const metaDiv = document.querySelector('.judge-meta');
        if (metaDiv) {
            styleHtml = document.createElement('span');
            styleHtml.id = 'judge-style-tag';
            styleHtml.className = 'meta-item';
            metaDiv.appendChild(styleHtml);
        }
    }
    if (styleHtml) {
        styleHtml.innerHTML = `🏷️ 風格: <span style="color: ${styleInfo.color}">${styleInfo.icon} ${style}</span>`;
    }
    
    // 裁決傾向圖表
    const total = stats.維持 + stats.撤銷 + stats.和解;
    const 維持Pct = Math.round((stats.維持 / total) * 100);
    const 撤銷Pct = Math.round((stats.撤銷 / total) * 100);
    const 和解Pct = Math.round((stats.和解 / total) * 100);
    
    document.getElementById('bar-維持').style.width = `${維持Pct}%`;
    document.getElementById('bar-維持').textContent = `維持 ${維持Pct}%`;
    document.getElementById('bar-維持').style.background = '#48bb78';
    
    document.getElementById('bar-撤銷').style.width = `${撤銷Pct}%`;
    document.getElementById('bar-撤銷').textContent = `撤銷 ${撤銷Pct}%`;
    document.getElementById('bar-撤銷').style.background = '#fc8181';
    
    document.getElementById('bar-和解').style.width = `${和解Pct}%`;
    document.getElementById('bar-和解').textContent = `和解 ${和解Pct}%`;
    document.getElementById('bar-和解').style.background = '#f6ad55';
    
    // 審理天數
    const daysPct = Math.min((stats.avgDays / 90) * 100, 100);
    document.getElementById('bar-duration').style.width = `${daysPct}%`;
    document.getElementById('bar-duration').textContent = `${stats.avgDays} 天`;
    
    // 上訴維持率
    document.getElementById('bar-appeal').style.width = `${stats.appealRate}%`;
    document.getElementById('bar-appeal').textContent = `${stats.appealRate}%`;
    
    // 渲染判決趨勢圖表
    renderTrendChart(judge);
    
    // 渲染風格分類展示
    renderStyleClassification(judge);
    
    // 渲染判決列表
    renderJudgeCases(judge.cases);
}

// 渲染判決趨勢圖表
function renderTrendChart(judge) {
    const container = document.getElementById('trend-chart-container');
    if (!container) return;
    
    const cases = judge.cases || [];
    
    // 按年份分組統計
    const yearStats = {};
    cases.forEach(c => {
        const year = c.date.substring(0, 4);
        if (!yearStats[year]) {
            yearStats[year] = { 維持: 0, 撤銷: 0, 和解: 0, total: 0 };
        }
        if (yearStats[year][c.result] !== undefined) {
            yearStats[year][c.result]++;
        }
        yearStats[year].total++;
    });
    
    // 排序年份
    const years = Object.keys(yearStats).sort().slice(-5); // 最近5年
    
    if (years.length === 0) {
        container.innerHTML = '<div class="case-empty">無判決趨勢資料</div>';
        return;
    }
    
    // 繪製圖表
    let html = `
        <div class="trend-chart">
            <h4>📈 判決趨勢 (近${years.length}年)</h4>
            <div class="trend-bars">
    `;
    
    years.forEach(year => {
        const s = yearStats[year];
        const 維持Pct = s.total > 0 ? Math.round((s.維持 / s.total) * 100) : 0;
        const 撤銷Pct = s.total > 0 ? Math.round((s.撤銷 / s.total) * 100) : 0;
        const 和解Pct = s.total > 0 ? Math.round((s.和解 / s.total) * 100) : 0;
        
        html += `
            <div class="trend-year">
                <div class="trend-year-label">${year}</div>
                <div class="trend-bars-row">
                    <div class="trend-bar" style="width: ${維持Pct}%; background: #48bb78;" title="維持: ${維持Pct}%"></div>
                    <div class="trend-bar" style="width: ${撤銷Pct}%; background: #fc8181;" title="撤銷: ${撤銷Pct}%"></div>
                    <div class="trend-bar" style="width: ${和解Pct}%; background: #f6ad55;" title="和解: ${和解Pct}%"></div>
                </div>
                <div class="trend-year-total">${s.total} 件</div>
            </div>
        `;
    });
    
    html += `
            </div>
            <div class="trend-legend">
                <span class="legend-item"><span class="legend-dot" style="background: #48bb78"></span> 維持</span>
                <span class="legend-item"><span class="legend-dot" style="background: #fc8181"></span> 撤銷</span>
                <span class="legend-item"><span class="legend-dot" style="background: #f6ad55"></span> 和解</span>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// 渲染風格分類展示
function renderStyleClassification(judge) {
    const container = document.getElementById('style-classification-container');
    if (!container) return;
    
    const stats = judge.stats;
    const total = stats.維持 + stats.撤銷 + stats.和解;
    const avgDays = stats.avgDays;
    const appealRate = stats.appealRate;
    
    // 計算各項指標
    const 維持率 = Math.round((stats.維持 / total) * 100);
    const 撤銷率 = Math.round((stats.撤銷 / total) * 100);
    const 和解率 = Math.round((stats.和解 / total) * 100);
    
    // 計算效率指標
    let efficiency = '適中';
    let efficiencyColor = '#9f7aea';
    if (avgDays < 35) {
        efficiency = '高效率';
        efficiencyColor = '#48bb78';
    } else if (avgDays > 60) {
        efficiency = '謹慎';
        efficiencyColor = '#f6ad55';
    }
    
    // 計算一致性指標
    let consistency = '適中';
    let consistencyColor = '#9f7aea';
    if (appealRate >= 75) {
        consistency = '高度一致';
        consistencyColor = '#48bb78';
    } else if (appealRate < 60) {
        consistency = '較多变数';
        consistencyColor = '#fc8181';
    }
    
    const style = calculateJudgeStyle(judge);
    const styleInfo = JUDGE_STYLES[style];
    
    let html = `
        <div class="style-classification">
            <h4>🎯 風格分析</h4>
            <div class="style-main">
                <div class="style-badge" style="background: ${styleInfo.color}20; border-color: ${styleInfo.color}">
                    ${styleInfo.icon} ${style}
                </div>
                <div class="style-desc">${styleInfo.description}</div>
            </div>
            
            <div class="style-metrics">
                <div class="metric-item">
                    <div class="metric-label">裁決穩定性</div>
                    <div class="metric-value" style="color: ${efficiencyColor}">${efficiency}</div>
                    <div class="metric-detail">平均 ${avgDays} 天/案</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">上訴維持率</div>
                    <div class="metric-value" style="color: ${consistencyColor}">${consistency}</div>
                    <div class="metric-detail">${appealRate}% 維持率</div>
                </div>
            </div>
            
            <div class="style-breakdown">
                <div class="breakdown-item">
                    <span class="breakdown-label">⚖️ 維持率</span>
                    <div class="breakdown-bar">
                        <div class="breakdown-fill" style="width: ${維持率}%; background: #48bb78;"></div>
                    </div>
                    <span class="breakdown-value">${維持率}%</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">🔄 撤銷率</span>
                    <div class="breakdown-bar">
                        <div class="breakdown-fill" style="width: ${撤銷率}%; background: #fc8181;"></div>
                    </div>
                    <span class="breakdown-value">${撤銷率}%</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">🤝 和解率</span>
                    <div class="breakdown-bar">
                        <div class="breakdown-fill" style="width: ${和解率}%; background: #f6ad55;"></div>
                    </div>
                    <span class="breakdown-value">${和解率}%</span>
                </div>
            </div>
            
            <div class="style-specialties">
                <span class="specialties-label">專長領域：</span>
                ${(judge.specialties || []).map(s => `<span class="specialty-tag">${s}</span>`).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = html;
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
        const resultClass = c.result === '維持' ? 'success' : c.result === '撤銷' ? 'danger' : 'warning';
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
    const style = calculateJudgeStyle(judge);
    let styleBonus = 0;
    if (style === '維持派') styleBonus = 10;
    if (style === '撤銷派') {
        verdict = "撤銷";
        styleBonus = 5;
    }
    if (style === '和解派' && (caseCategory === '離婚' || caseCategory === '車禍')) {
        verdict = "和解";
        styleBonus = 15;
    }
    
    confidence = Math.min(Math.max(confidence + styleBonus, 45), 92);
    confidence = Math.round(confidence);
    
    // 生成分析文字
    const caseTypeName = caseType || "案件";
    const categoryName = caseCategory || "類型";
    
    analysis = `根據 ${judge.name} 法官過去 ${stats.total} 件案件的統計分析：
    
• 法官風格：${style}（${JUDGE_STYLES[style].description}）
• 裁決傾向：維持 ${Math.round((stats.維持/(stats.維持+stats.撤銷+stats.和解))*100)}%、撤銷 ${Math.round((stats.撤銷/(stats.維持+stats.撤銷+stats.和解))*100)}%、和解 ${Math.round((stats.和解/(stats.維持+stats.撤銷+stats.和解))*100)}%
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
                    <div class="similar-summary">${item.case.summary || '無摘要'}</div>
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
window.filterJudges = filterJudges;
window.doPrediction = doPrediction;
window.searchSimilarCases = searchSimilarCases;
window.calculateJudgeStyle = calculateJudgeStyle;
