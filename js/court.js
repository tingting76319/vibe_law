// 法院分析模組 v0.7
// 法院檔案、案件分布、判決模式

let currentCourtId = null;

// 法院層級
const COURT_LEVELS = {
    '最高法院': { icon: '⚖️', color: '#e53e3e', description: '最終審法院' },
    '高等法院': { icon: '⚖️', color: '#dd6b20', description: '二審法院' },
    '地方法院': { icon: '⚖️', color: '#38a169', description: '一審法院' },
    '行政法院': { icon: '📋', color: '#3182ce', description: '行政訴訟法院' },
    '智慧財產法院': { icon: '💡', color: '#805ad5', description: '智慧財產案件' }
};

// 案件類型映射
const CASE_TYPE_ICONS = {
    '民事': '💼',
    '刑事': '⚔️',
    '行政': '📋',
    '智慧財產': '💡'
};

// 初始化法院模組
function initCourtModule() {
    renderCourtList();
    bindCourtEvents();
}

// 取得法院列表
function getCourtList() {
    // 從法官資料中提取法院列表
    const judges = getJudgesList();
    const courtMap = new Map();
    
    judges.forEach(judge => {
        if (!courtMap.has(judge.court)) {
            courtMap.set(judge.court, {
                id: judge.court,
                name: judge.court,
                level: getCourtLevel(judge.court),
                judgeCount: 0,
                totalCases: 0,
                civil: 0,
                criminal: 0,
                admin: 0,
                judges: []
            });
        }
        
        const court = courtMap.get(judge.court);
        court.judgeCount++;
        court.judges.push(judge);
        
        if (judge.stats) {
            court.totalCases += judge.stats.total || 0;
            court.civil += judge.stats.civil || 0;
            court.criminal += judge.stats.criminal || 0;
            court.admin += judge.stats.admin || 0;
        }
    });
    
    return Array.from(courtMap.values());
}

// 判斷法院層級
function getCourtLevel(courtName) {
    if (courtName.includes('最高法院')) return '最高法院';
    if (courtName.includes('高等法院')) return '高等法院';
    if (courtName.includes('行政法院')) return '行政法院';
    if (courtName.includes('智慧財產')) return '智慧財產法院';
    return '地方法院';
}

// 渲染法院列表
function renderCourtList() {
    const courtList = document.getElementById('court-list');
    if (!courtList) return;
    
    const courts = getCourtList();
    
    if (courts.length === 0) {
        courtList.innerHTML = '<div class="court-empty">載入中...</div>';
        return;
    }
    
    let html = '';
    courts.forEach(court => {
        const levelInfo = COURT_LEVELS[court.level] || COURT_LEVELS['地方法院'];
        
        html += `
            <div class="court-item ${court.id === currentCourtId ? 'active' : ''}" data-court-id="${court.id}">
                <div class="court-item-avatar">${levelInfo.icon}</div>
                <div class="court-item-info">
                    <h4>${court.name}</h4>
                    <p>${levelInfo.description} · ${court.judgeCount} 位法官</p>
                    <div class="court-item-tags">
                        <span class="court-tag">${court.totalCases} 件案件</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    courtList.innerHTML = html;
}

// 過濾法院
function filterCourts() {
    const keyword = document.getElementById('court-search-input')?.value?.toLowerCase() || '';
    const level = document.getElementById('court-level-filter')?.value || '';
    
    let courts = getCourtList();
    
    // 按關鍵字過濾
    if (keyword) {
        courts = courts.filter(c => 
            c.name.toLowerCase().includes(keyword) ||
            c.level.includes(keyword)
        );
    }
    
    // 按層級過濾
    if (level) {
        courts = courts.filter(c => c.level === level);
    }
    
    renderFilteredCourts(courts);
}

// 渲染過濾後的法院列表
function renderFilteredCourts(courts) {
    const courtList = document.getElementById('court-list');
    if (!courtList) return;
    
    if (courts.length === 0) {
        courtList.innerHTML = '<div class="court-empty">找不到符合條件的法院</div>';
        return;
    }
    
    let html = '';
    courts.forEach(court => {
        const levelInfo = COURT_LEVELS[court.level] || COURT_LEVELS['地方法院'];
        
        html += `
            <div class="court-item ${court.id === currentCourtId ? 'active' : ''}" data-court-id="${court.id}">
                <div class="court-item-avatar">${levelInfo.icon}</div>
                <div class="court-item-info">
                    <h4>${court.name}</h4>
                    <p>${levelInfo.description} · ${court.judgeCount} 位法官</p>
                    <div class="court-item-tags">
                        <span class="court-tag">${court.totalCases} 件案件</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    courtList.innerHTML = html;
}

// 選擇法院
function selectCourt(courtId) {
    currentCourtId = courtId;
    
    // 更新列表 active 狀態
    document.querySelectorAll('.court-item').forEach(item => {
        item.classList.toggle('active', item.dataset.courtId === courtId);
    });
    
    // 渲染法院檔案
    renderCourtProfile(courtId);
}

// 渲染法院檔案
function renderCourtProfile(courtId) {
    const court = getCourtById(courtId);
    if (!court) return;
    
    // 基本資料
    document.getElementById('court-name').textContent = court.name;
    document.getElementById('court-level').textContent = getCourtLevel(court.name);
    document.getElementById('court-location').textContent = getCourtLocation(court.name);
    document.getElementById('court-judge-count').textContent = court.judgeCount;
    
    // 統計數據
    document.getElementById('court-stat-total').textContent = court.totalCases;
    document.getElementById('court-stat-civil').textContent = court.civil;
    document.getElementById('court-stat-criminal').textContent = court.criminal;
    document.getElementById('court-stat-admin').textContent = court.admin;
    
    // 渲染案件分布圖表
    renderCaseDistribution(court);
    
    // 渲染判決模式圖表
    renderJudgmentPattern(court);
    
    // 渲染年度趨勢
    renderCourtTrendChart(court);
    
    // 渲染法官列表
    renderCourtJudges(court);
    
    // 渲染熱門案件類型
    renderPopularCases(court);
}

// 取得法院地點
function getCourtLocation(courtName) {
    if (courtName.includes('台北')) return '台北市';
    if (courtName.includes('新北')) return '新北市';
    if (courtName.includes('桃園')) return '桃園市';
    if (courtName.includes('台中')) return '台中市';
    if (courtName.includes('台南')) return '台南市';
    if (courtName.includes('高雄')) return '高雄市';
    if (courtName.includes('最高')) return '台北市';
    if (courtName.includes('高等')) return '台北市';
    if (courtName.includes('智慧')) return '台北市';
    return '全國';
}

// 渲染案件分布圖表
function renderCaseDistribution(court) {
    const container = document.getElementById('case-distribution-chart');
    if (!container) return;
    
    const total = court.civil + court.criminal + court.admin || 1;
    const civilPct = Math.round((court.civil / total) * 100);
    const criminalPct = Math.round((court.criminal / total) * 100);
    const adminPct = Math.round((court.admin / total) * 100);
    
    const html = `
        <div class="distribution-row">
            <span class="distribution-label">💼 民事</span>
            <div class="distribution-bar-container">
                <div class="distribution-bar civil" style="width: ${civilPct}%">${civilPct}%</div>
            </div>
        </div>
        <div class="distribution-row">
            <span class="distribution-label">⚔️ 刑事</span>
            <div class="distribution-bar-container">
                <div class="distribution-bar criminal" style="width: ${criminalPct}%">${criminalPct}%</div>
            </div>
        </div>
        <div class="distribution-row">
            <span class="distribution-label">📋 行政</span>
            <div class="distribution-bar-container">
                <div class="distribution-bar admin" style="width: ${adminPct}%">${adminPct}%</div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// 渲染判決模式圖表
function renderJudgmentPattern(court) {
    const container = document.getElementById('judgment-pattern-chart');
    if (!container) return;
    
    // 匯總法官的判決模式
    let total = { 維持: 0, 撤銷: 0, 發回: 0, 和解: 0 };
    let caseCount = 0;
    
    court.judges.forEach(judge => {
        if (judge.stats) {
            total.維持 += judge.stats.維持 || 0;
            total.撤銷 += judge.stats.撤銷 || 0;
            total.發回 += judge.stats.撤銷 || 0; // 近似
            total.和解 += judge.stats.和解 || 0;
            caseCount += judge.stats.total || 0;
        }
    });
    
    const sum = total.維持 + total.撤銷 + total.發回 + total.和解 || 1;
    const sustainedPct = Math.round((total.維持 / sum) * 100);
    const reversedPct = Math.round((total.撤銷 / sum) * 100);
    const remandedPct = Math.round((total.發回 / sum) * 100);
    const dismissedPct = Math.round((total.和解 / sum) * 100);
    
    const html = `
        <div class="pattern-row">
            <span class="pattern-label">維持</span>
            <div class="pattern-bar-container">
                <div class="pattern-bar sustained" style="width: ${sustainedPct}%"></div>
            </div>
            <span style="min-width: 40px; text-align: right;">${sustainedPct}%</span>
        </div>
        <div class="pattern-row">
            <span class="pattern-label">撤銷</span>
            <div class="pattern-bar-container">
                <div class="pattern-bar reversed" style="width: ${reversedPct}%"></div>
            </div>
            <span style="min-width: 40px; text-align: right;">${reversedPct}%</span>
        </div>
        <div class="pattern-row">
            <span class="pattern-label">發回</span>
            <div class="pattern-bar-container">
                <div class="pattern-bar remanded" style="width: ${remandedPct}%"></div>
            </div>
            <span style="min-width: 40px; text-align: right;">${remandedPct}%</span>
        </div>
        <div class="pattern-row">
            <span class="pattern-label">和解</span>
            <div class="pattern-bar-container">
                <div class="pattern-bar dismissed" style="width: ${dismissedPct}%"></div>
            </div>
            <span style="min-width: 40px; text-align: right;">${dismissedPct}%</span>
        </div>
    `;
    
    container.innerHTML = html;
}

// 渲染年度趨勢圖表
function renderCourtTrendChart(court) {
    const container = document.getElementById('court-trend-chart-container');
    if (!container) return;
    
    // 模擬年度趨勢數據
    const years = ['107', '108', '109', '110', '111'];
    const currentYear = new Date().getFullYear() - 1911;
    
    let html = `
        <div class="trend-chart">
            <h4>📈 案件趨勢 (近5年)</h4>
            <div class="trend-bars">
    `;
    
    years.forEach((year, index) => {
        // 模擬數據：逐年遞增
        const baseCount = Math.floor(court.totalCases / 5);
        const variance = Math.floor(Math.random() * 0.3 * baseCount);
        const count = Math.floor(baseCount * (1 + index * 0.1) + variance);
        
        // 模擬各類型比例
        const civilCount = Math.floor(count * 0.5);
        const criminalCount = Math.floor(count * 0.35);
        const adminCount = count - civilCount - criminalCount;
        
        const civilPct = Math.round((civilCount / count) * 100);
        const criminalPct = Math.round((criminalCount / count) * 100);
        
        html += `
            <div class="trend-year">
                <div class="trend-year-label">${year}</div>
                <div class="trend-bars-row">
                    <div class="trend-bar" style="width: ${civilPct}%; background: #48bb78;" title="民事: ${civilPct}%"></div>
                    <div class="trend-bar" style="width: ${criminalPct}%; background: #fc8181;" title="刑事: ${criminalPct}%"></div>
                </div>
                <div class="trend-year-total">${count} 件</div>
            </div>
        `;
    });
    
    html += `
            </div>
            <div class="trend-legend">
                <span class="legend-item"><span class="legend-dot" style="background: #48bb78"></span> 民事</span>
                <span class="legend-item"><span class="legend-dot" style="background: #fc8181"></span> 刑事</span>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// 渲染法院法官列表
function renderCourtJudges(court) {
    const container = document.getElementById('court-judge-list');
    if (!container) return;
    
    const styleFilter = document.getElementById('court-judge-style-filter')?.value || '';
    let judges = court.judges;
    
    // 按風格過濾
    if (styleFilter) {
        judges = judges.filter(judge => {
            const style = calculateJudgeStyle(judge);
            return style === styleFilter;
        });
    }
    
    if (judges.length === 0) {
        container.innerHTML = '<div class="court-empty">無符合條件的法官</div>';
        return;
    }
    
    let html = '';
    judges.forEach(judge => {
        const style = calculateJudgeStyle(judge);
        const styleInfo = JUDGE_STYLES[style] || { icon: '⚖️', color: '#a0aec0' };
        
        html += `
            <div class="court-judge-item" onclick="selectJudgeByCourt('${judge.id}')">
                <div class="court-judge-avatar">👨‍⚖️</div>
                <div class="court-judge-info">
                    <h5>${judge.name} <span class="judge-style-badge ${style}">${styleInfo.icon} ${style}</span></h5>
                    <p>${judge.title || '法官'}</p>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 通過法院視圖選擇法官
function selectJudgeByCourt(judgeId) {
    // 切換到法官視圖
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.view === 'judge') {
            tab.classList.add('active');
        }
    });
    
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
        if (view.id === 'view-judge') {
            view.classList.remove('hidden');
        }
    });
    
    // 選擇法官
    if (typeof selectJudge === 'function') {
        selectJudge(judgeId);
    }
}

// 渲染熱門案件類型
function renderPopularCases(court) {
    const container = document.getElementById('popular-cases-grid');
    if (!container) return;
    
    // 模擬熱門案件類型
    const popularCases = [
        { name: '車禍理賠', icon: '🚗', count: Math.floor(court.totalCases * 0.15) },
        { name: '離婚案件', icon: '💔', count: Math.floor(court.totalCases * 0.12) },
        { name: '租屋糾紛', icon: '🏠', count: Math.floor(court.totalCases * 0.1) },
        { name: '繼承案件', icon: '📜', count: Math.floor(court.totalCases * 0.08) },
        { name: '勞動爭議', icon: '💼', count: Math.floor(court.totalCases * 0.08) },
        { name: '毒品案件', icon: '⚔️', count: Math.floor(court.totalCases * 0.07) }
    ];
    
    let html = '';
    popularCases.forEach(item => {
        html += `
            <div class="popular-case-item">
                <div class="popular-case-icon">${item.icon}</div>
                <div class="popular-case-name">${item.name}</div>
                <div class="popular-case-count">${item.count} 件</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// 取得法院 by ID
function getCourtById(courtId) {
    const courts = getCourtList();
    return courts.find(c => c.id === courtId);
}

// 綁定法院相關事件
function bindCourtEvents() {
    // 法院選擇
    document.getElementById('court-list')?.addEventListener('click', function(e) {
        const courtItem = e.target.closest('.court-item');
        if (courtItem) {
            const courtId = courtItem.dataset.courtId;
            selectCourt(courtId);
        }
    });
    
    // 法院篩選
    document.getElementById('court-level-filter')?.addEventListener('change', filterCourts);
    document.getElementById('court-search-input')?.addEventListener('input', filterCourts);
    
    // 法官風格篩選
    document.getElementById('court-judge-style-filter')?.addEventListener('change', function() {
        if (currentCourtId) {
            const court = getCourtById(currentCourtId);
            if (court) renderCourtJudges(court);
        }
    });
}

// 確保法院模組在頁面載入時初始化
document.addEventListener('DOMContentLoaded', function() {
    // 延遲初始化確保 DOM 完全載入
    setTimeout(() => {
        if (typeof initCourtModule === 'function') {
            initCourtModule();
        }
    }, 100);
});
