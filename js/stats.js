// Legal-RAG 判決分類統計儀表板

// 統計數據緩存
let statsData = {
    summary: {},
    byType: {},
    byYear: {},
    yearlyTrend: []
};

// 當前選擇的時間區間
let currentTimeRange = '1y';

// 初始化統計模組
function initStatsModule() {
    console.log('[Stats] 初始化判決分類統計模組');
    
    // 綁定時間篩選器
    bindTimeFilter();
    
    // 綁定深色模式切換
    bindDarkMode();
    
    // 載入統計數據
    loadStatsData();
}

// 綁定時間篩選器
function bindTimeFilter() {
    document.querySelectorAll('.time-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 更新UI
            document.querySelectorAll('.time-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 更新數據
            currentTimeRange = this.dataset.range;
            loadStatsData();
        });
    });
}

// 綁定深色模式
function bindDarkMode() {
    const darkModeBtn = document.getElementById('toggle-dark-mode');
    if (darkModeBtn) {
        darkModeBtn.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            this.textContent = isDark ? '☀️ 淺色模式' : '🌙 深色模式';
            localStorage.setItem('darkMode', isDark ? 'dark' : 'light');
        });
        
        // 恢復深色模式設定
        const savedMode = localStorage.getItem('darkMode');
        if (savedMode === 'dark') {
            document.body.classList.add('dark-mode');
            darkModeBtn.textContent = '☀️ 淺色模式';
        }
    }
}

// 載入統計數據
async function loadStatsData() {
    showSkeleton();
    
    try {
        // 模擬API調用 - 實際應從後端獲取
        const data = await fetchStatsFromAPI(currentTimeRange);
        
        // 緩存數據
        statsData = data;
        
        // 渲染統計數據
        renderStatsCards(data.summary);
        renderPieChart(data.byType);
        renderBarChart(data.byType);
        renderTrendChart(data.yearlyTrend);
        
        hideSkeleton();
    } catch (error) {
        console.error('[Stats] 載入數據失敗:', error);
        // 使用模擬數據
        const mockData = generateMockData();
        statsData = mockData;
        
        renderStatsCards(mockData.summary);
        renderPieChart(mockData.byType);
        renderBarChart(mockData.byType);
        renderTrendChart(mockData.yearlyTrend);
        
        hideSkeleton();
    }
}

// 從API獲取統計數據
async function fetchStatsFromAPI(timeRange) {
    try {
        const response = await fetch(`/api/stats?range=${timeRange}`);
        if (!response.ok) throw new Error('API Error');
        return await response.json();
    } catch (e) {
        // 如果API不可用，返回模擬數據
        return generateMockData();
    }
}

// 生成模擬數據
function generateMockData() {
    const currentYear = new Date().getFullYear();
    const yearRange = currentTimeRange === '1y' ? 1 : 
                       currentTimeRange === '3y' ? 3 : 
                       currentTimeRange === '5y' ? 5 : 10;
    
    const summary = {
        total: Math.floor(Math.random() * 50000) + 30000,
        civil: Math.floor(Math.random() * 20000) + 15000,
        criminal: Math.floor(Math.random() * 10000) + 8000,
        administrative: Math.floor(Math.random() * 8000) + 5000,
        family: Math.floor(Math.random() * 5000) + 3000,
        youth: Math.floor(Math.random() * 2000) + 1000,
        constitutional: Math.floor(Math.random() * 500) + 100
    };
    
    const byType = {
        civil: summary.civil,
        criminal: summary.criminal,
        administrative: summary.administrative,
        family: summary.family,
        youth: summary.youth,
        constitutional: summary.constitutional
    };
    
    // 生成年度趨勢數據
    const yearlyTrend = [];
    for (let i = yearRange - 1; i >= 0; i--) {
        const year = currentYear - i;
        const base = Math.floor(Math.random() * 3000) + 2000;
        yearlyTrend.push({
            year: year,
            total: base + Math.floor(Math.random() * 1000),
            civil: Math.floor(base * 0.5 + Math.random() * 500),
            criminal: Math.floor(base * 0.25 + Math.random() * 300),
            administrative: Math.floor(base * 0.15 + Math.random() * 200),
            family: Math.floor(base * 0.07 + Math.random() * 100),
            youth: Math.floor(base * 0.02 + Math.random() * 50),
            constitutional: Math.floor(base * 0.01 + Math.random() * 20)
        });
    }
    
    return { summary, byType, yearlyTrend };
}

// 顯示骨架屏
function showSkeleton() {
    const skeleton = document.getElementById('stats-skeleton');
    const cards = document.getElementById('stats-cards');
    const charts = document.getElementById('charts-grid');
    const trend = document.getElementById('trend-chart');
    
    if (skeleton) skeleton.style.display = 'block';
    if (cards) cards.style.display = 'none';
    if (charts) charts.style.display = 'none';
    if (trend) trend.style.display = 'none';
}

// 隱藏骨架屏
function hideSkeleton() {
    const skeleton = document.getElementById('stats-skeleton');
    const cards = document.getElementById('stats-cards');
    const charts = document.getElementById('charts-grid');
    const trend = document.getElementById('trend-chart');
    
    if (skeleton) skeleton.style.display = 'none';
    if (cards) cards.style.display = 'grid';
    if (charts) charts.style.display = 'grid';
    if (trend) trend.style.display = 'block';
    
    // 添加淡入動畫
    cards?.classList.add('fade-in');
    charts?.classList.add('fade-in');
    trend?.classList.add('fade-in');
}

// 渲染統計卡片
function renderStatsCards(summary) {
    document.getElementById('stat-total').textContent = formatNumber(summary.total);
    document.getElementById('stat-civil').textContent = formatNumber(summary.civil);
    document.getElementById('stat-criminal').textContent = formatNumber(summary.criminal);
    document.getElementById('stat-administrative').textContent = formatNumber(summary.administrative);
    document.getElementById('stat-family').textContent = formatNumber(summary.family);
    document.getElementById('stat-youth').textContent = formatNumber(summary.youth);
    document.getElementById('stat-constitutional').textContent = formatNumber(summary.constitutional);
}

// 渲染圓餅圖
function renderPieChart(byType) {
    const total = Object.values(byType).reduce((a, b) => a + b, 0);
    const percentages = {};
    
    // 計算角度
    let currentAngle = 0;
    const angles = {};
    const colors = {
        civil: '#48bb78',
        criminal: '#fc8181',
        administrative: '#4299e1',
        family: '#ed8936',
        youth: '#9f7aea',
        constitutional: '#38b2ac'
    };
    
    for (const [type, count] of Object.entries(byType)) {
        const pct = total > 0 ? (count / total) * 100 : 0;
        percentages[type] = pct.toFixed(1);
        angles[type] = { start: currentAngle, end: currentAngle + (pct * 3.6) };
        currentAngle += pct * 3.6;
    }
    
    // 更新圓餅圖
    const pieChart = document.getElementById('pie-chart');
    if (pieChart) {
        let gradientStr = '';
        let tooltip = '';
        let prevAngle = 0;
        
        for (const [type, angle] of Object.entries(angles)) {
            if (byType[type] > 0) {
                const endAngle = prevAngle + (angle.end - angle.start);
                gradientStr += `${colors[type]} ${prevAngle}deg ${endAngle}deg,`;
                prevAngle = endAngle;
            }
        }
        
        gradientStr = gradientStr.slice(0, -1);
        pieChart.style.background = `conic-gradient(${gradientStr})`;
    }
    
    // 更新中心數值
    document.getElementById('pie-center-value').textContent = formatNumber(total);
    
    // 更新圖例
    for (const [type, pct] of Object.entries(percentages)) {
        const legendEl = document.getElementById(`legend-${type}`);
        if (legendEl) {
            legendEl.textContent = `${pct}%`;
        }
    }
}

// 渲染長條圖
function renderBarChart(byType) {
    const container = document.getElementById('bar-chart');
    if (!container) return;
    
    const maxValue = Math.max(...Object.values(byType));
    const types = [
        { key: 'civil', label: '民事判決', color: 'civil' },
        { key: 'criminal', label: '刑事判決', color: 'criminal' },
        { key: 'administrative', label: '行政判決', color: 'administrative' },
        { key: 'family', label: '家事判決', color: 'family' },
        { key: 'youth', label: '少年判決', color: 'youth' },
        { key: 'constitutional', label: '憲法判決', color: 'constitutional' }
    ];
    
    let html = '';
    for (const type of types) {
        const value = byType[type.key] || 0;
        const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
        
        html += `
            <div class="bar-chart-row">
                <div class="bar-chart-label">${type.label}</div>
                <div class="bar-chart-track">
                    <div class="bar-chart-fill ${type.color}" style="width: ${width}%">
                        ${value > 0 ? formatNumber(value) : ''}
                    </div>
                </div>
                <div class="bar-chart-value">${formatNumber(value)}</div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// 渲染年度趨勢圖
function renderTrendChart(yearlyTrend) {
    const container = document.getElementById('trend-bars');
    if (!container) return;
    
    if (!yearlyTrend || yearlyTrend.length === 0) {
        container.innerHTML = '<div class="empty-placeholder">尚無趨勢數據</div>';
        return;
    }
    
    // 找出最大值用於正規化
    const maxTotal = Math.max(...yearlyTrend.map(y => y.total));
    
    let html = '<div class="trend-bars-row">';
    
    for (const yearData of yearlyTrend) {
        const totalHeight = maxTotal > 0 ? (yearData.total / maxTotal) * 100 : 0;
        const civilHeight = maxTotal > 0 ? (yearData.civil / maxTotal) * 100 : 0;
        const criminalHeight = maxTotal > 0 ? (yearData.criminal / maxTotal) * 100 : 0;
        
        html += `
            <div class="trend-bar-wrapper">
                <div class="trend-bar total" style="height: ${totalHeight}%;">
                    <div class="trend-bar-tooltip">
                        <strong>${yearData.year}年</strong><br>
                        總判決: ${formatNumber(yearData.total)}<br>
                        民事: ${formatNumber(yearData.civil)}<br>
                        刑事: ${formatNumber(yearData.criminal)}
                    </div>
                </div>
                <div class="trend-year-label">${yearData.year}</div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// 格式化數字
function formatNumber(num) {
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + '萬';
    }
    return num.toLocaleString();
}

// 導出函數供外部調用
window.initStatsModule = initStatsModule;
window.loadStatsData = loadStatsData;
