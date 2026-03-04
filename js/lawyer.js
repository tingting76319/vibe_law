/**
 * Lawyer Module - v0.8.0
 * 律師媒合前端邏輯
 */

// API 端點配置
const LAWYER_API_BASE = '/api/lawyers';
const MATCHING_API_BASE = '/api/matching';

// 律師列表快取
let lawyerListCache = [];
let currentFilters = {};

/**
 * 初始化律師模組
 */
function initLawyerModule() {
    console.log('[Lawyer v0.8] 初始化律師模組');
    
    // 綁定事件
    bindLawyerEvents();
    
    // 載入律師列表
    loadLawyers();
}

/**
 * 綁定律師頁面事件
 */
function bindLawyerEvents() {
    // 律師子頁籤切換
    document.querySelectorAll('.lawyer-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.dataset.lawyerView;
            switchLawyerSubView(view);
            
            // 更新 active 狀態
            document.querySelectorAll('.lawyer-tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // 律師搜尋
    const searchBtn = document.getElementById('lawyer-search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchLawyers);
    }
    
    const searchInput = document.getElementById('lawyer-search-input');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') searchLawyers();
        });
    }
    
    // 案件上傳表單
    const uploadForm = document.getElementById('case-upload-form');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleCaseUpload);
    }
    
    // 篩選器變更
    const specialtyFilter = document.getElementById('lawyer-specialty-filter');
    const courtFilter = document.getElementById('lawyer-court-filter');
    const experienceFilter = document.getElementById('lawyer-experience-filter');
    
    if (specialtyFilter) specialtyFilter.addEventListener('change', searchLawyers);
    if (courtFilter) courtFilter.addEventListener('change', searchLawyers);
    if (experienceFilter) experienceFilter.addEventListener('change', searchLawyers);
}

/**
 * 切換律師子視圖
 */
function switchLawyerSubView(viewName) {
    document.querySelectorAll('.lawyer-sub-view').forEach(section => {
        section.classList.add('hidden');
    });
    
    const targetView = document.getElementById(`lawyer-${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }
    
    // 如果切換到列表視圖，重新載入
    if (viewName === 'list') {
        loadLawyers();
    } else if (viewName === 'matches') {
        loadMatchHistory();
    } else if (viewName === 'strategy') {
        // 切換到訴訟策略視圖時，確保案件列表已載入
        if (typeof initStrategyModule === 'function') {
            // 已初始化
        }
    }
}

/**
 * 載入律師列表
 */
async function loadLawyers() {
    const lawyerList = document.getElementById('lawyer-list');
    if (!lawyerList) return;
    
    lawyerList.innerHTML = '<div class="lawyer-loading"><span class="loading-spinner"></span> 載入中...</div>';
    
    try {
        const response = await fetch(`${LAWYER_API_BASE}?limit=50`);
        const result = await response.json();
        
        if (result.status === 'success') {
            lawyerListCache = result.data || [];
            renderLawyerList(lawyerListCache);
        } else {
            // 如果 API 失敗，使用 mock data
            console.warn('[Lawyer] API 失敗，使用 Mock 資料');
            const mockLawyers = getMockLawyers();
            lawyerListCache = mockLawyers;
            renderLawyerList(mockLawyers);
        }
    } catch (error) {
        console.error('[Lawyer] 載入律師列表失敗:', error);
        // 使用 mock data
        const mockLawyers = getMockLawyers();
        lawyerListCache = mockLawyers;
        renderLawyerList(mockLawyers);
    }
}

/**
 * 搜尋律師
 */
async function searchLawyers() {
    const searchInput = document.getElementById('lawyer-search-input');
    const specialtyFilter = document.getElementById('lawyer-specialty-filter');
    const courtFilter = document.getElementById('lawyer-court-filter');
    const experienceFilter = document.getElementById('lawyer-experience-filter');
    
    const query = searchInput?.value?.trim() || '';
    const specialty = specialtyFilter?.value || '';
    const court = courtFilter?.value || '';
    const minExperience = experienceFilter?.value || '';
    
    const lawyerList = document.getElementById('lawyer-list');
    if (!lawyerList) return;
    
    lawyerList.innerHTML = '<div class="lawyer-loading"><span class="loading-spinner"></span> 搜尋中...</div>';
    
    // 建立查詢參數
    const params = new URLSearchParams();
    if (query) params.append('search', query);
    if (specialty) params.append('specialty', specialty);
    if (court) params.append('court', court);
    if (minExperience) params.append('minExperience', minExperience);
    params.append('limit', '50');
    
    try {
        const response = await fetch(`${LAWYER_API_BASE}/search?${params}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            lawyerListCache = result.data || [];
            renderLawyerList(lawyerListCache);
        } else {
            // 本地過濾
            filterLawyersLocal(query, specialty, court, minExperience);
        }
    } catch (error) {
        console.error('[Lawyer] 搜尋失敗:', error);
        // 本地過濾
        filterLawyersLocal(query, specialty, court, minExperience);
    }
}

/**
 * 本地過濾律師
 */
function filterLawyersLocal(query, specialty, court, minExperience) {
    let filtered = [...lawyerListCache];
    
    if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(l => 
            l.name?.toLowerCase().includes(q) || 
            l.law_firm?.toLowerCase().includes(q) ||
            l.specialty?.some(s => s.toLowerCase().includes(q)) ||
            l.expertise?.some(e => e.toLowerCase().includes(q))
        );
    }
    
    if (specialty) {
        filtered = filtered.filter(l => 
            l.specialty?.includes(specialty) || 
            l.expertise?.includes(specialty)
        );
    }
    
    if (court) {
        filtered = filtered.filter(l => 
            l.court_admission?.some(c => c.includes(court))
        );
    }
    
    if (minExperience) {
        filtered = filtered.filter(l => 
            (l.years_of_experience || 0) >= parseInt(minExperience)
        );
    }
    
    renderLawyerList(filtered);
}

/**
 * 渲染律師列表
 */
function renderLawyerList(lawyers) {
    const lawyerList = document.getElementById('lawyer-list');
    if (!lawyerList) return;
    
    if (!lawyers || lawyers.length === 0) {
        lawyerList.innerHTML = `
            <div class="lawyer-empty">
                <div class="lawyer-empty-icon">👔</div>
                <p class="lawyer-empty-text">沒有找到符合條件的律師</p>
            </div>
        `;
        return;
    }
    
    lawyerList.innerHTML = lawyers.map(lawyer => renderLawyerCard(lawyer)).join('');
    
    // 綁定律師卡片點擊事件
    lawyerList.querySelectorAll('.lawyer-card').forEach(card => {
        card.addEventListener('click', function() {
            const lawyerId = this.dataset.lawyerId;
            showLawyerDetail(lawyerId);
        });
    });
}

/**
 * 渲染律師卡片
 */
function renderLawyerCard(lawyer) {
    const stats = lawyer.case_stats || {};
    const totalCases = stats.total_cases || 0;
    const winRate = lawyer.success_rate || lawyer.rating || 0;
    const experience = lawyer.years_of_experience || 0;
    
    const specialties = lawyer.specialty || lawyer.expertise || [];
    const primarySpecialty = specialties[0] || '綜合';
    const otherSpecialties = specialties.slice(1, 4);
    
    const avatarInitial = lawyer.name?.charAt(0) || '律';
    
    const availability = lawyer.availability_status || 'available';
    const availabilityText = availability === 'available' ? '可接案' : availability === 'busy' ? '繁忙' : '暫停';
    
    return `
        <div class="lawyer-card" data-lawyer-id="${lawyer.id}">
            <div class="lawyer-card-header">
                <div class="lawyer-avatar">${avatarInitial}</div>
                <div class="lawyer-basic-info">
                    <h3 class="lawyer-name">${lawyer.name || '未知律師'}</h3>
                    <p class="lawyer-firm">${lawyer.law_firm || '個人執業'}</p>
                    <div class="lawyer-rating">
                        <span class="rating-stars">${getRatingStars(winRate)}</span>
                        <span class="rating-value">${winRate.toFixed(1)}</span>
                    </div>
                </div>
            </div>
            
            <div class="lawyer-specialties">
                <span class="specialty-tag primary">${primarySpecialty}</span>
                ${otherSpecialties.map(s => `<span class="specialty-tag">${s}</span>`).join('')}
            </div>
            
            <div class="lawyer-stats">
                <div class="lawyer-stat">
                    <div class="stat-number">${experience}</div>
                    <div class="stat-label">年資</div>
                </div>
                <div class="lawyer-stat">
                    <div class="stat-number">${totalCases}</div>
                    <div class="stat-label">辦案數</div>
                </div>
                <div class="lawyer-stat">
                    <div class="stat-number">${winRate.toFixed(0)}%</div>
                    <div class="stat-label">成功率</div>
                </div>
            </div>
            
            <div class="lawyer-meta-info">
                <div class="lawyer-meta-item">
                    <span class="icon">📍</span>
                    <span>${lawyer.office_address || '未設定'}</span>
                </div>
                <div class="lawyer-meta-item">
                    <span class="icon">💰</span>
                    <span>${lawyer.hourly_rate ? `時薪 $${lawyer.hourly_rate}` : '電洽'}</span>
                </div>
            </div>
            
            <div style="margin-top: 12px;">
                <span class="availability-status ${availability}">
                    <span class="status-dot"></span>
                    ${availabilityText}
                </span>
            </div>
        </div>
    `;
}

/**
 * 取得評分星星
 */
function getRatingStars(rating) {
    const stars = '★'.repeat(Math.floor(rating / 20));
    return stars;
}

/**
 * 顯示律師詳情
 */
function showLawyerDetail(lawyerId) {
    const lawyer = lawyerListCache.find(l => l.id === lawyerId);
    if (!lawyer) {
        // 嘗試從 API 取得
        fetchLawyerDetail(lawyerId);
        return;
    }
    
    renderLawyerModal(lawyer);
}

/**
 * 從 API 取得律師詳情
 */
async function fetchLawyerDetail(lawyerId) {
    try {
        const response = await fetch(`${LAWYER_API_BASE}/${lawyerId}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            renderLawyerModal(result.data);
        }
    } catch (error) {
        console.error('[Lawyer] 取得律師詳情失敗:', error);
    }
}

/**
 * 渲染律師詳情彈窗
 */
function renderLawyerModal(lawyer) {
    // 檢查是否已有 modal
    let modal = document.getElementById('lawyer-modal');
    if (modal) {
        modal.remove();
    }
    
    const stats = lawyer.case_stats || {};
    const totalCases = stats.total_cases || 0;
    const wins = stats.wins || 0;
    const winRate = lawyer.success_rate || lawyer.rating || 0;
    const experience = lawyer.years_of_experience || 0;
    
    const specialties = lawyer.specialty || lawyer.expertise || [];
    const courts = lawyer.court_admission || [];
    
    const avatarInitial = lawyer.name?.charAt(0) || '律';
    
    modal = document.createElement('div');
    modal.id = 'lawyer-modal';
    modal.className = 'lawyer-modal';
    modal.innerHTML = `
        <div class="lawyer-modal-content">
            <button class="lawyer-modal-close">&times;</button>
            
            <div class="lawyer-modal-header">
                <div class="lawyer-modal-avatar">${avatarInitial}</div>
                <div class="lawyer-modal-basic">
                    <h2 class="lawyer-modal-name">${lawyer.name || '未知律師'}</h2>
                    <p class="lawyer-modal-firm">${lawyer.law_firm || '個人執業'} ${lawyer.position ? '- ' + lawyer.position : ''}</p>
                    <span class="availability-status ${lawyer.availability_status || 'available'}">
                        <span class="status-dot"></span>
                        ${lawyer.availability_status === 'available' ? '可接案' : '暫停'}
                    </span>
                </div>
            </div>
            
            <div class="lawyer-modal-stats">
                <div class="lawyer-modal-stat">
                    <div class="lawyer-modal-stat-value">${experience}</div>
                    <div class="lawyer-modal-stat-label">年資</div>
                </div>
                <div class="lawyer-modal-stat">
                    <div class="lawyer-modal-stat-value">${totalCases}</div>
                    <div class="lawyer-modal-stat-label">辦案總數</div>
                </div>
                <div class="lawyer-modal-stat">
                    <div class="lawyer-modal-stat-value">${wins}</div>
                    <div class="lawyer-modal-stat-label">成功案件</div>
                </div>
                <div class="lawyer-modal-stat">
                    <div class="lawyer-modal-stat-value">${winRate.toFixed(0)}%</div>
                    <div class="lawyer-modal-stat-label">成功率</div>
                </div>
            </div>
            
            <div class="lawyer-modal-section">
                <h4>專業領域</h4>
                <div class="lawyer-modal-specialties">
                    ${specialties.map(s => `<span class="specialty-tag">${s}</span>`).join('')}
                </div>
            </div>
            
            <div class="lawyer-modal-section">
                <h4>執業法院</h4>
                <div class="lawyer-modal-specialties">
                    ${courts.length > 0 ? courts.map(c => `<span class="specialty-tag">${c}</span>`).join('') : '未設定'}
                </div>
            </div>
            
            ${lawyer.bio ? `
            <div class="lawyer-modal-section">
                <h4>個人簡介</h4>
                <p class="lawyer-modal-bio">${lawyer.bio}</p>
            </div>
            ` : ''}
            
            <div class="lawyer-modal-section">
                <h4>聯絡資訊</h4>
                <div class="lawyer-modal-contact">
                    ${lawyer.contact_email ? `
                    <div class="lawyer-modal-contact-item">
                        <span>📧</span>
                        <span>${lawyer.contact_email}</span>
                    </div>
                    ` : ''}
                    ${lawyer.contact_phone ? `
                    <div class="lawyer-modal-contact-item">
                        <span>📞</span>
                        <span>${lawyer.contact_phone}</span>
                    </div>
                    ` : ''}
                    ${lawyer.office_address ? `
                    <div class="lawyer-modal-contact-item">
                        <span>📍</span>
                        <span>${lawyer.office_address}</span>
                    </div>
                    ` : ''}
                    ${lawyer.hourly_rate ? `
                    <div class="lawyer-modal-contact-item">
                        <span>💰</span>
                        <span>時薪 $${lawyer.hourly_rate}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <button class="contact-lawyer-btn" onclick="selectLawyerForCase('${lawyer.id}')">
                📩 選擇此律師
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 綁定關閉事件
    modal.querySelector('.lawyer-modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    });
    
    // 顯示 modal
    setTimeout(() => modal.classList.add('active'), 10);
}

/**
 * 處理案件上傳
 */
async function handleCaseUpload(e) {
    e.preventDefault();
    
    const caseType = document.getElementById('case-type').value;
    const caseTitle = document.getElementById('case-title').value;
    const caseDescription = document.getElementById('case-description').value;
    const caseKeywords = document.getElementById('case-keywords').value;
    const preferredCourt = document.getElementById('case-preferred-court').value;
    const budget = document.getElementById('case-budget').value;
    
    if (!caseType || !caseTitle || !caseDescription) {
        alert('請填寫必要欄位');
        return;
    }
    
    const uploadBtn = document.getElementById('upload-case-btn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="loading-spinner"></span> 分析中...';
    
    // 模擬案件分析
    const caseData = {
        case_type: caseType,
        title: caseTitle,
        summary: caseDescription,
        keywords: caseKeywords ? caseKeywords.split(',').map(k => k.trim()) : [],
        preferred_court: preferredCourt,
        budget: budget
    };
    
    try {
        // 產生風險報告
        const riskReport = generateRiskReport(caseData);
        renderRiskReport(riskReport);
        
        // 取得律師推薦
        await getLawyerRecommendations(caseData);
        
    } catch (error) {
        console.error('[Case Upload] 處理失敗:', error);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '📤 提交案件並取得律師推薦';
    }
}

/**
 * 產生風險報告
 */
function generateRiskReport(caseData) {
    const risks = [];
    const caseType = caseData.case_type;
    
    if (caseType === '民事') {
        risks.push({
            level: 'medium',
            title: '證據充分性',
            desc: '建議收集所有相關書面證據、對話記錄等，以提高勝訴機會'
        });
        risks.push({
            level: caseData.keywords?.some(k => ['車禍', '賠償'].includes(k)) ? 'high' : 'low',
            title: '賠償金額不確定性',
            desc: '法院判決金額可能與期望有落差，建議設定合理期望'
        });
    } else if (caseType === '刑事') {
        risks.push({
            level: 'high',
            title: '刑期評估',
            desc: '刑事案件結果較難預測，取決於證據強度和法官裁量'
        });
    } else if (caseType === '家事') {
        risks.push({
            level: 'medium',
            title: '調解可能性',
            desc: '家事案件法院常先行調解，時間可能較長'
        });
    } else if (caseType === '勞動') {
        risks.push({
            level: 'medium',
            title: '雇主的舉證責任',
            desc: '勞動基準法對雇主有較多舉證要求，可善加利用'
        });
    }
    
    if (caseData.budget) {
        const [min, max] = caseData.budget.split('-').map(v => parseInt(v) || 0);
        if (max > 0 && max < 30000) {
            risks.push({
                level: 'low',
                title: '預算限制',
                desc: '律師費用可能超出預算範圍，可考慮申請法律扶助'
            });
        }
    }
    
    return risks;
}

/**
 * 渲染風險報告
 */
function renderRiskReport(risks) {
    const riskSection = document.getElementById('risk-report-section');
    const riskReport = document.getElementById('risk-report');
    
    if (!riskSection || !riskReport) return;
    
    riskReport.innerHTML = risks.map(risk => `
        <div class="risk-item">
            <div class="risk-icon ${risk.level}">
                ${risk.level === 'high' ? '⚠️' : risk.level === 'medium' ? '⚡' : '✅'}
            </div>
            <div class="risk-content">
                <h4 class="risk-title">${risk.title}</h4>
                <p class="risk-desc">${risk.desc}</p>
            </div>
        </div>
    `).join('');
    
    riskSection.classList.remove('hidden');
}

/**
 * 取得律師推薦
 */
async function getLawyerRecommendations(caseData) {
    const recommendationSection = document.getElementById('recommendation-section');
    const recommendedLawyers = document.getElementById('recommended-lawyers');
    
    if (!recommendationSection || !recommendedLawyers) return;
    
    recommendedLawyers.innerHTML = '<div class="lawyer-loading"><span class="loading-spinner"></span> 尋找最適合的律師...</div>';
    recommendationSection.classList.remove('hidden');
    
    try {
        const response = await fetch(`${MATCHING_API_BASE}/case`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                caseType: caseData.case_type,
                title: caseData.title,
                summary: caseData.summary,
                keywords: caseData.keywords,
                limit: 5
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success' && result.data.matches?.length > 0) {
            renderRecommendations(result.data.matches);
        } else {
            const mockRecommendations = getMockRecommendations(caseData);
            renderRecommendations(mockRecommendations);
        }
    } catch (error) {
        console.error('[Matching] 推薦失敗:', error);
        const mockRecommendations = getMockRecommendations(caseData);
        renderRecommendations(mockRecommendations);
    }
}

/**
 * 渲染推薦律師
 */
function renderRecommendations(matches) {
    const recommendedLawyers = document.getElementById('recommended-lawyers');
    if (!recommendedLawyers) return;
    
    if (!matches || matches.length === 0) {
        recommendedLawyers.innerHTML = `
            <div class="lawyer-empty">
                <div class="lawyer-empty-icon">😕</div>
                <p class="lawyer-empty-text">目前沒有找到合適的律師，請嘗試調整案件描述</p>
            </div>
        `;
        return;
    }
    
    recommendedLawyers.innerHTML = matches.map(match => {
        const lawyer = match.lawyer || match;
        const score = match.matchScore || match.score || 0;
        const reasons = match.reasons || [];
        
        const level = score >= 0.7 ? 'high' : score >= 0.5 ? 'medium' : 'low';
        const levelText = level === 'high' ? '高度匹配' : level === 'medium' ? '中度匹配' : '初步匹配';
        
        const avatarInitial = lawyer.name?.charAt(0) || '律';
        const specialties = lawyer.specialty || lawyer.expertise || [];
        
        return `
            <div class="recommended-lawyer-card">
                <div class="match-score-badge">${(score * 100).toFixed(0)}% 匹配</div>
                <div class="recommended-lawyer-avatar">${avatarInitial}</div>
                <div class="recommended-lawyer-info">
                    <h3 class="recommended-lawyer-name">${lawyer.name || '未知律師'}</h3>
                    <p class="recommended-lawyer-firm">${lawyer.law_firm || '個人執業'}</p>
                    
                    <div class="recommended-lawyer-match">
                        <span class="match-level ${level}">${levelText}</span>
                        <span class="match-percentage">${(score * 100).toFixed(0)}%</span>
                    </div>
                    
                    <div class="recommended-lawyer-reasons">
                        ${reasons.slice(0, 3).map(r => `
                            <div class="reason-item">
                                <span class="reason-icon">✓</span>
                                <span>${r}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="recommended-lawyer-specialties">
                        ${specialties.slice(0, 3).map(s => `<span class="specialty-tag">${s}</span>`).join('')}
                    </div>
                    
                    <button class="contact-lawyer-btn" onclick="selectLawyerForCase('${lawyer.id}')">
                        📩 聯繫律師
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    saveMatchToHistory(matches);
}

/**
 * 選擇律師
 */
function selectLawyerForCase(lawyerId) {
    const lawyer = lawyerListCache.find(l => l.id === lawyerId);
    if (lawyer) {
        alert(`已選擇律師: ${lawyer.name}\n功能開發中，敬請期待！`);
    }
}

/**
 * 儲存匹配記錄
 */
function saveMatchToHistory(matches) {
    const history = JSON.parse(localStorage.getItem('lawyer_matches') || '[]');
    const newMatch = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        matches: matches
    };
    history.unshift(newMatch);
    localStorage.setItem('lawyer_matches', JSON.stringify(history.slice(0, 20)));
}

/**
 * 載入匹配歷史
 */
function loadMatchHistory() {
    const matchesList = document.getElementById('matches-list');
    if (!matchesList) return;
    
    const history = JSON.parse(localStorage.getItem('lawyer_matches') || '[]');
    
    if (history.length === 0) {
        matchesList.innerHTML = '<div class="case-empty">尚無推薦記錄</div>';
        return;
    }
    
    matchesList.innerHTML = history.map(item => {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString('zh-TW');
        const bestMatch = item.matches?.[0];
        
        return `
            <div class="match-history-card">
                <div class="match-history-info">
                    <h4>${bestMatch?.lawyer?.name || '律師推薦'}</h4>
                    <p class="match-history-meta">${dateStr} · ${item.matches?.length || 0} 位推薦律師</p>
                </div>
                <div class="match-history-score">
                    <div class="match-history-percentage">${bestMatch ? (bestMatch.matchScore * 100).toFixed(0) : 0}%</div>
                    <div class="match-history-label">最佳匹配</div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Mock 律師資料
 */
function getMockLawyers() {
    return [
        {
            id: 'lawyer-001',
            name: '陳志明',
            law_firm: '明理律師事務所',
            position: '主持律師',
            specialty: ['民事', '不動產', '商事'],
            expertise: ['房產糾紛', '合約談判', '商業訴訟'],
            years_of_experience: 15,
            rating: 4.8,
            success_rate: 85,
            case_stats: { total_cases: 328, wins: 279, losses: 49 },
            hourly_rate: 8000,
            court_admission: ['台北', '新北', '桃園'],
            office_address: '台北市大安區忠孝東路四段',
            contact_email: 'chen@lawfirm.com',
            contact_phone: '02-2775-1234',
            availability_status: 'available',
            bio: '執業十五年，專精於不動產糾紛與商事訴訟，擁有豐富的法庭經驗。'
        },
        {
            id: 'lawyer-002',
            name: '林雅婷',
            law_firm: '雅婷律師事務所',
            position: '合夥律師',
            specialty: ['家事', '民事', '勞動'],
            expertise: ['離婚訴訟', '子女監護', '繼承糾紛', '勞資爭議'],
            years_of_experience: 12,
            rating: 4.9,
            success_rate: 88,
            case_stats: { total_cases: 256, wins: 225, losses: 31 },
            hourly_rate: 7000,
            court_admission: ['台北', '新北', '台中'],
            office_address: '台北市信義區松高路',
            contact_email: 'lin@lawfirm.com',
            contact_phone: '02-2758-5678',
            availability_status: 'available',
            bio: '家事專科律師，專長離婚與子女監護權案件，兼具溫柔與專業。'
        },
        {
            id: 'lawyer-003',
            name: '王建國',
            law_firm: '建國刑事辯護事務所',
            position: '主持律師',
            specialty: ['刑事', '民事'],
            expertise: ['刑事辯護', '毒品案件', '傷害案件', '經濟犯罪'],
            years_of_experience: 20,
            rating: 4.7,
            success_rate: 78,
            case_stats: { total_cases: 512, wins: 399, losses: 113 },
            hourly_rate: 10000,
            court_admission: ['台北', '新北', '高雄', '台中'],
            office_address: '台北市中正區重慶南路',
            contact_email: 'wang@lawfirm.com',
            contact_phone: '02-2378-9012',
            availability_status: 'busy',
            bio: '資深刑事辯護律師，曾任檢察官，專精各類刑事案件辯護。'
        },
        {
            id: 'lawyer-004',
            name: '張曉寧',
            law_firm: '智財權利事務所',
            position: '合夥律師',
            specialty: ['智慧財產', '商事', '民事'],
            expertise: ['專利侵權', '商標爭議', '著作權', '營業秘密'],
            years_of_experience: 8,
            rating: 4.6,
            success_rate: 82,
            case_stats: { total_cases: 145, wins: 119, losses: 26 },
            hourly_rate: 9000,
            court_admission: ['台北', '新北', '智慧財產法院'],
            office_address: '台北市南港區園區街',
            contact_email: 'zhang@lawfirm.com',
            contact_phone: '02-2653-4567',
            availability_status: 'available',
            bio: '科技法律背景，專精智財權與科技法律諮詢。'
        },
        {
            id: 'lawyer-005',
            name: '李志偉',
            law_firm: '志偉金融律師事務所',
            position: '主持律師',
            specialty: ['金融', '商事', '刑事'],
            expertise: ['金融犯罪', '銀行業務', '企業併購', '證券交易'],
            years_of_experience: 18,
            rating: 4.9,
            success_rate: 90,
            case_stats: { total_cases: 287, wins: 258, losses: 29 },
            hourly_rate: 15000,
            court_admission: ['台北', '新北', '台中', '高雄'],
            office_address: '台北市中山區南京東路',
            contact_email: 'lee@lawfirm.com',
            contact_phone: '02-2518-7890',
            availability_status: 'available',
            bio: '金融法律專家，專長金融犯罪辯護與企業法律顧問。'
        },
        {
            id: 'lawyer-006',
            name: '黃美華',
            law_firm: '美華勞動法律事務所',
            position: '主持律師',
            specialty: ['勞動', '民事', '行政'],
            expertise: ['勞資糾紛', '職業災害', '雇主責任', '勞動法規'],
            years_of_experience: 10,
            rating: 4.5,
            success_rate: 80,
            case_stats: { total_cases: 198, wins: 158, losses: 40 },
            hourly_rate: 6000,
            court_admission: ['新北', '桃園', '台中'],
            office_address: '新北市板橋區縣民大道',
            contact_email: 'huang@lawfirm.com',
            contact_phone: '02-8967-2345',
            availability_status: 'available',
            bio: '勞動法專門律師，協助眾多勞資雙方解決糾紛。'
        }
    ];
}

/**
 * Mock 推薦資料
 */
function getMockRecommendations(caseData) {
    const mockLawyers = getMockLawyers();
    
    return mockLawyers.map(lawyer => {
        let score = 0.5;
        const reasons = [];
        
        const caseType = caseData.case_type;
        const lawyerSpecialties = [...(lawyer.specialty || []), ...(lawyer.expertise || [])];
        
        if (lawyerSpecialties.some(s => s.includes(caseType) || caseType.includes(s))) {
            score += 0.3;
            reasons.push('專業領域高度匹配');
        }
        
        if (caseData.keywords) {
            const matchedKeywords = caseData.keywords.filter(k => 
                lawyerSpecialties.some(s => s.includes(k) || k.includes(s))
            );
            if (matchedKeywords.length > 0) {
                score += 0.15;
                reasons.push(`擅長關鍵字: ${matchedKeywords.join(', ')}`);
            }
        }
        
        if (lawyer.years_of_experience >= 10) {
            score += 0.1;
            reasons.push('豐富執業經驗');
        }
        
        if (lawyer.success_rate >= 80) {
            score += 0.1;
            reasons.push(`成功率達 ${lawyer.success_rate}%`);
        }
        
        if (caseData.preferred_court && lawyer.court_admission?.includes(caseData.preferred_court)) {
            score += 0.1;
            reasons.push(`熟悉 ${caseData.preferred_court} 法院`);
        }
        
        score += (Math.random() * 0.1 - 0.05);
        
        return {
            lawyer,
            matchScore: Math.min(score, 1),
            reasons
        };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
}

/**
 * 訴訟策略模組 - v0.9.0
 * 律師工作台、策略報告
 */

// 訴訟策略全局狀態
let strategyState = {
    currentCase: null,
    currentReport: null,
    cases: [],
    uploadedFiles: []
};

/**
 * 初始化訴訟策略模組
 */
function initStrategyModule() {
    console.log('[Strategy v0.9] 初始化訴訟策略模組');
    bindStrategyEvents();
    loadCases();
}

/**
 * 綁定訴訟策略頁面事件
 */
function bindStrategyEvents() {
    // 訴訟策略子頁籤切換
    document.querySelectorAll('.strategy-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const view = this.dataset.strategyView;
            switchStrategySubView(view);
            
            // 更新 active 狀態
            document.querySelectorAll('.strategy-tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // 律師工作台表單提交
    const strategyForm = document.getElementById('strategy-case-form');
    if (strategyForm) {
        strategyForm.addEventListener('submit', handleStrategyCaseSubmit);
    }
    
    // 快速分析按鈕
    const quickAnalyzeBtn = document.getElementById('quick-analyze-btn');
    if (quickAnalyzeBtn) {
        quickAnalyzeBtn.addEventListener('click', handleQuickAnalyze);
    }
    
    // 訴狀上傳
    const pleadingFile = document.getElementById('pleading-file');
    if (pleadingFile) {
        pleadingFile.addEventListener('change', handlePleadingUpload);
    }
    
    // 下載報告
    const downloadReportBtn = document.getElementById('download-report-btn');
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', downloadReport);
    }
    
    // 列印報告
    const printReportBtn = document.getElementById('print-report-btn');
    if (printReportBtn) {
        printReportBtn.addEventListener('click', printReport);
    }
}

/**
 * 切換訴訟策略子視圖
 */
function switchStrategySubView(viewName) {
    document.querySelectorAll('.strategy-sub-view').forEach(section => {
        section.classList.add('hidden');
    });
    
    const targetView = document.getElementById(`strategy-${viewName}-view`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }
    
    // 如果切換到報告視圖且有報告數據，則渲染報告
    if (viewName === 'report' && strategyState.currentReport) {
        renderStrategyReport(strategyState.currentReport);
    } else if (viewName === 'cases') {
        renderCasesGrid();
    }
}

/**
 * 處理案件表單提交
 */
async function handleStrategyCaseSubmit(e) {
    e.preventDefault();
    
    const caseType = document.getElementById('strategy-case-type').value;
    const title = document.getElementById('strategy-case-title').value;
    const description = document.getElementById('strategy-case-description').value;
    const context = document.getElementById('strategy-case-context').value;
    const court = document.getElementById('strategy-case-court').value;
    const opposingParty = document.getElementById('strategy-opposing-party').value;
    const keywords = document.getElementById('strategy-case-keywords').value;
    
    if (!caseType || !title || !description) {
        alert('請填寫必填欄位');
        return;
    }
    
    const createBtn = document.getElementById('create-case-btn');
    createBtn.disabled = true;
    createBtn.textContent = '建立中...';
    
    try {
        const response = await fetch('/api/strategy/case', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                caseType,
                title,
                description,
                context,
                court,
                opposingParty,
                keywords
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            strategyState.currentCase = result.data;
            strategyState.cases.unshift(result.data);
            
            // 自動觸發分析
            await analyzeCase(result.data.id);
            
            alert('案件建立成功！正在生成策略報告...');
            
            // 切換到策略報告頁籤
            document.querySelector('[data-strategy-view="report"]').click();
        } else {
            alert('建立失敗：' + result.message);
        }
    } catch (error) {
        console.error('[Strategy] 建立案件失敗:', error);
        alert('建立失敗，請稍後再試');
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = '📋 建立案件';
    }
}

/**
 * 快速分析（不建立案件）
 */
async function handleQuickAnalyze() {
    const caseType = document.getElementById('strategy-case-type').value;
    const title = document.getElementById('strategy-case-title').value;
    const description = document.getElementById('strategy-case-description').value;
    const context = document.getElementById('strategy-case-context').value;
    
    if (!caseType || !title || !description) {
        alert('請填寫案件類型、標題和描述');
        return;
    }
    
    const quickAnalyzeBtn = document.getElementById('quick-analyze-btn');
    quickAnalyzeBtn.disabled = true;
    quickAnalyzeBtn.textContent = '分析中...';
    
    try {
        const response = await fetch('/api/strategy/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                caseType,
                title,
                description,
                context
            })
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            strategyState.currentReport = result.data;
            strategyState.currentCase = { caseType, title, description, context };
            
            // 切換到策略報告頁籤
            document.querySelector('[data-strategy-view="report"]').click();
        } else {
            alert('分析失敗：' + result.message);
        }
    } catch (error) {
        console.error('[Strategy] 快速分析失敗:', error);
        alert('分析失敗，請稍後再試');
    } finally {
        quickAnalyzeBtn.disabled = false;
        quickAnalyzeBtn.textContent = '⚡ 快速分析';
    }
}

/**
 * 分析案件
 */
async function analyzeCase(caseId) {
    try {
        const response = await fetch(`/api/strategy/case/${caseId}/analyze`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            strategyState.currentReport = result.data;
            // 更新案件狀態
            const caseIndex = strategyState.cases.findIndex(c => c.id === caseId);
            if (caseIndex !== -1) {
                strategyState.cases[caseIndex].strategyReport = result.data;
                strategyState.cases[caseIndex].status = 'analyzed';
            }
        }
    } catch (error) {
        console.error('[Strategy] 分析失敗:', error);
    }
}

/**
 * 處理訴狀上傳
 */
async function handlePleadingUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (!strategyState.currentCase) {
        alert('請先建立案件再上傳訴士');
        return;
    }
    
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`/api/strategy/case/${strategyState.currentCase.id}/pleading`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                strategyState.uploadedFiles.push(result.data);
                renderUploadedFiles();
            } else {
                alert(`檔案 ${file.name} 上傳失敗：${result.message}`);
            }
        } catch (error) {
            console.error('[Strategy] 上傳失敗:', error);
            alert(`檔案 ${file.name} 上傳失敗`);
        }
    }
    
    // 清空 input
    e.target.value = '';
}

/**
 * 渲染已上傳檔案列表
 */
function renderUploadedFiles() {
    const container = document.getElementById('uploaded-files');
    if (!container) return;
    
    if (strategyState.uploadedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = strategyState.uploadedFiles.map((file, index) => `
        <div class="uploaded-file">
            <span class="uploaded-file-icon">📄</span>
            <div class="uploaded-file-info">
                <div class="uploaded-file-name">${file.originalName}</div>
                <div class="uploaded-file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="uploaded-file-remove" onclick="removeUploadedFile(${index})">移除</button>
        </div>
    `).join('');
}

/**
 * 移除已上傳檔案
 */
function removeUploadedFile(index) {
    strategyState.uploadedFiles.splice(index, 1);
    renderUploadedFiles();
}

/**
 * 格式化檔案大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 渲染策略報告
 */
function renderStrategyReport(report) {
    if (!report) return;
    
    const { summary, attackPoints, defensePoints, risks, laws, timeline, budget } = report;
    
    // 渲染摘要
    document.getElementById('summary-risk').textContent = summary?.overallRisk || '-';
    document.getElementById('summary-attack').textContent = summary?.strength || 0;
    document.getElementById('summary-defense').textContent = summary?.weakness || 0;
    document.getElementById('summary-laws').textContent = summary?.keyLaws || 0;
    
    // 渲染攻擊建議
    const attackList = document.getElementById('attack-list');
    if (attackPoints && attackPoints.length > 0) {
        attackList.innerHTML = attackPoints.map(point => `
            <div class="attack-card">
                <div class="card-type">${point.type}</div>
                <div class="card-title">${point.title}</div>
                <div class="card-content">${point.content}</div>
                <span class="card-priority ${point.priority}">優先度: ${point.priority === 'high' ? '高' : point.priority === 'medium' ? '中' : '低'}</span>
            </div>
        `).join('');
    } else {
        attackList.innerHTML = '<div class="empty-placeholder">暫無攻擊建議</div>';
    }
    
    // 渲染防守建議
    const defenseList = document.getElementById('defense-list');
    if (defensePoints && defensePoints.length > 0) {
        defenseList.innerHTML = defensePoints.map(point => `
            <div class="defense-card">
                <div class="card-type">${point.type}</div>
                <div class="card-title">${point.title}</div>
                <div class="card-content">${point.content}</div>
                <span class="card-priority ${point.priority}">優先度: ${point.priority === 'high' ? '高' : point.priority === 'medium' ? '中' : '低'}</span>
            </div>
        `).join('');
    } else {
        defenseList.innerHTML = '<div class="empty-placeholder">暫無防守建議</div>';
    }
    
    // 渲染風險點
    const riskList = document.getElementById('risk-list');
    if (risks && risks.length > 0) {
        riskList.innerHTML = risks.map(risk => `
            <div class="risk-card ${risk.level}">
                <div class="risk-title">
                    ${risk.level === 'high' ? '🔴' : risk.level === 'medium' ? '🟡' : '🟢'} ${risk.title}
                </div>
                <div class="risk-description">${risk.description}</div>
                <div class="risk-suggestion">${risk.suggestion}</div>
            </div>
        `).join('');
    } else {
        riskList.innerHTML = '<div class="empty-placeholder">暫無風險點</div>';
    }
    
    // 渲染法條
    const lawList = document.getElementById('law-list');
    if (laws && laws.length > 0) {
        lawList.innerHTML = laws.map(law => `
            <div class="law-card">
                <div class="law-article">${law.article}</div>
                <div class="law-title">${law.title}</div>
            </div>
        `).join('');
    } else {
        lawList.innerHTML = '<div class="empty-placeholder">暫無法條引用</div>';
    }
    
    // 渲染時間線
    const reportTimeline = document.getElementById('report-timeline');
    if (timeline && timeline.keyMilestones) {
        reportTimeline.innerHTML = timeline.keyMilestones.map(milestone => `
            <div class="timeline-item ${milestone.status}">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-phase">${milestone.phase}</div>
                    <div class="timeline-timeframe">${milestone.timeframe}</div>
                </div>
            </div>
        `).join('');
        reportTimeline.innerHTML += `<p style="margin-top: 12px; color: #666; font-size: 14px;">預估總時間: ${timeline.estimatedMonths} 個月</p>`;
    }
    
    // 渲染預算
    const reportBudget = document.getElementById('report-budget');
    if (budget) {
        let budgetHtml = budget.breakdown.map(item => `
            <div class="budget-item">
                <span class="budget-item-label">${item.item}</span>
                <span class="budget-item-value">${item.range}</span>
            </div>
        `).join('');
        
        budgetHtml += `
            <div class="budget-total">
                <span>預估總費用</span>
                <span>${budget.estimated}</span>
            </div>
        `;
        
        reportBudget.innerHTML = budgetHtml;
    }
}

/**
 * 渲染案件列表
 */
function renderCasesGrid() {
    const grid = document.getElementById('cases-grid');
    if (!grid) return;
    
    if (strategyState.cases.length === 0) {
        grid.innerHTML = '<div class="case-empty">尚無建立案件</div>';
        return;
    }
    
    grid.innerHTML = strategyState.cases.map(c => `
        <div class="case-card" onclick="loadCaseReport('${c.id}')">
            <div class="case-card-header">
                <div class="case-card-title">${c.title}</div>
                <span class="case-card-type ${c.caseType.toLowerCase()}">${c.caseType}</span>
            </div>
            <div class="case-card-description">${c.description || ''}</div>
            <div class="case-card-meta">
                <span>建立日期: ${new Date(c.createdAt).toLocaleDateString('zh-TW')}</span>
                <span class="case-card-status ${c.status}">${c.status === 'analyzed' ? '已分析' : '草稿'}</span>
            </div>
        </div>
    `).join('');
}

/**
 * 載入案件報告
 */
async function loadCaseReport(caseId) {
    try {
        const response = await fetch(`/api/strategy/case/${caseId}`);
        const result = await response.json();
        
        if (result.status === 'success') {
            strategyState.currentCase = result.data;
            strategyState.currentReport = result.data.strategyReport;
            
            // 切換到報告頁籤
            document.querySelector('[data-strategy-view="report"]').click();
            document.querySelectorAll('.strategy-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-strategy-view="report"]').classList.add('active');
            
            // 渲染報告
            if (strategyState.currentReport) {
                renderStrategyReport(strategyState.currentReport);
            }
        }
    } catch (error) {
        console.error('[Strategy] 載入案件失敗:', error);
        alert('載入失敗');
    }
}

/**
 * 載入案件列表
 */
async function loadCases() {
    try {
        const response = await fetch('/api/strategy/cases');
        const result = await response.json();
        
        if (result.status === 'success') {
            strategyState.cases = result.data;
            renderCasesGrid();
        }
    } catch (error) {
        console.error('[Strategy] 載入案件列表失敗:', error);
    }
}

/**
 * 下載報告
 */
function downloadReport() {
    if (!strategyState.currentReport) {
        alert('沒有可下載的報告');
        return;
    }
    
    const reportText = generateReportText(strategyState.currentReport);
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `策略報告_${strategyState.currentCase?.title || '案件'}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * 生成報告文字
 */
function generateReportText(report) {
    const { caseType, title, summary, attackPoints, defensePoints, risks, laws, timeline, budget } = report;
    
    let text = `======================================
訴訟策略分析報告
======================================

案件資訊
--------
案件類型: ${caseType}
案件標題: ${title}
生成時間: ${new Date().toISOString()}

整體評估
--------
整體風險: ${summary?.overallRisk || '-'}
攻擊點數量: ${summary?.strength || 0}
防守點數量: ${summary?.weakness || 0}
相關法條: ${summary?.keyLaws || 0}

======================================
攻擊建議
======================================
`;
    
    if (attackPoints) {
        attackPoints.forEach((point, i) => {
            text += `
${i + 1}. [${point.type}] ${point.title}
   內容: ${point.content}
   優先度: ${point.content.priority}
`;
        });
    }
    
    text += `
======================================
防守建議
======================================
`;
    
    if (defensePoints) {
        defensePoints.forEach((point, i) => {
            text += `
${i + 1}. [${point.type}] ${point.title}
   內容: ${point.content}
   優先度: ${point.priority}
`;
        });
    }
    
    text += `
======================================
風險點列表
======================================
`;
    
    if (risks) {
        risks.forEach((risk, i) => {
            text += `
${i + 1}. [${risk.level.toUpperCase()}] ${risk.title}
   說明: ${risk.description}
   建議: ${risk.suggestion}
`;
        });
    }
    
    text += `
======================================
法條引用
======================================
`;
    
    if (laws) {
        laws.forEach(law => {
            text += `• ${law.article} - ${law.title}\n`;
        });
    }
    
    text += `
======================================
時間線與預算
======================================
預估時間: ${timeline?.estimatedMonths || '-'} 個月
預估費用: ${budget?.estimated || '-'}

`;
    
    if (budget?.breakdown) {
        budget.breakdown.forEach(item => {
            text += `${item.item}: ${item.range}\n`;
        });
    }
    
    text += `
======================================
此報告由 Legal-RAG 系統自動生成
僅供參考，不構成法律意見
======================================
`;
    
    return text;
}

/**
 * 列印報告
 */
function printReport() {
    if (!strategyState.currentReport) {
        alert('沒有可列印的報告');
        return;
    }
    
    const reportText = generateReportText(strategyState.currentReport);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>策略報告 - ${strategyState.currentCase?.title || '案件'}</title>
            <style>
                body { font-family: "Microsoft JhengHei", Arial, sans-serif; padding: 40px; line-height: 1.6; }
                pre { white-space: pre-wrap; word-wrap: break-word; }
            </style>
        </head>
        <body>
            <pre>${reportText}</pre>
            <script>window.print(); window.close();</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}
