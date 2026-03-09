const API_BASE = 'https://vibe-law.zeabur.app';

// Tab Switching
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.main-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    
    if (tab.dataset.tab === 'lawyer') loadLawyers();
    if (tab.dataset.tab === 'judge') loadJudges();
    if (tab.dataset.tab === 'court') loadCourts();
    if (tab.dataset.tab === 'admin') loadStats();
  });
});

// Settings button
document.querySelector('.settings-btn').addEventListener('click', () => {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.main-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="admin"]').classList.add('active');
  document.getElementById('tab-admin').classList.add('active');
  loadStats();
});

// Sub Tab Switching
document.querySelectorAll('.sub-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    this.parentElement.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
  });
});

// List Item Click Handler
function handleListClick(items, callback) {
  items.forEach(item => {
    item.addEventListener('click', () => {
      item.parentElement.querySelectorAll('.list-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      if (callback) callback(item);
    });
  });
}

// Load Stats
async function loadStats() {
  try {
    const res = await fetch(API_BASE + '/api/judicial/db-stats');
    const data = await res.json();
    document.getElementById('db-stats').innerHTML = 
      '判決書: ' + data.data.judgments.toLocaleString() + ' | 法官: ' + data.data.judges + ' | 律師: ' + data.data.lawyers;
  } catch(e) {
    document.getElementById('db-stats').innerText = '載入失敗';
  }
}

// Load Lawyers
async function loadLawyers() {
  const list = document.getElementById('lawyer-list');
  if (!list.querySelector('.list-item')) {
    try {
      const res = await fetch(API_BASE + '/api/lawyers?limit=30');
      const data = await res.json();
      
      if (data.data && data.data.length > 0) {
        list.innerHTML = data.data.map(lawyer => {
          const lawyerData = JSON.stringify(lawyer).replace(/'/g, "&#39;");
          return '<div class="list-item" data-lawyer=\'' + lawyerData + '\'>' +
            '<div class="avatar">' + lawyer.name[0] + '</div>' +
            '<div class="info"><div class="name">' + lawyer.name + '</div>' +
            '<div class="meta">' + (lawyer.specialty || '一般') + ' · ' + (lawyer.court || '待確認') + '</div></div>' +
            '<span class="badge badge-' + getStyleClass(lawyer.style) + '">' + (lawyer.style || '待分析') + '</span></div>';
        }).join('');
        
        handleListClick(list.querySelectorAll('.list-item'), showLawyerDetail);
      } else {
        list.innerHTML = '<div class="welcome-message"><p>尚無律師資料</p></div>';
      }
    } catch(e) {
      list.innerHTML = '<div class="welcome-message"><p>載入失敗: ' + e.message + '</p></div>';
    }
  }
}

// Load Judges
async function loadJudges() {
  const list = document.getElementById('judge-list');
  if (!list.querySelector('.list-item')) {
    try {
      const res = await fetch(API_BASE + '/api/judges?limit=30');
      const data = await res.json();
      
      if (data.data && data.data.length > 0) {
        list.innerHTML = data.data.map(judge => {
          const judgeData = JSON.stringify(judge).replace(/'/g, "&#39;");
          return '<div class="list-item" data-judge=\'' + judgeData + '\'>' +
            '<div class="avatar">' + ((judge.name || '法官')[0]) + '</div>' +
            '<div class="info"><div class="name">' + (judge.name || '未知') + '</div>' +
            '<div class="meta">' + (judge.court || '待確認') + ' · ' + (judge.year || '') + '年</div></div></div>';
        }).join('');
        
        handleListClick(list.querySelectorAll('.list-item'), showJudgeDetail);
      } else {
        list.innerHTML = '<div class="welcome-message"><p>尚無法官資料</p></div>';
      }
    } catch(e) {
      list.innerHTML = '<div class="welcome-message"><p>載入失敗</p></div>';
    }
  }
}

// Load Courts
async function loadCourts() {
  const comp = document.getElementById('court-comparison');
  try {
    const res = await fetch(API_BASE + '/api/courts?limit=20');
    const data = await res.json();
    
    if (data.data && data.data.length > 0) {
      const courts = data.data.map(c => '<option value="' + c.code + '">' + c.name + ' (' + c.level + ')</option>').join('');
      document.getElementById('court1').innerHTML = courts;
      document.getElementById('court2').innerHTML = courts;
    }
    comp.innerHTML = '<div class="loading">請選擇法院並點擊比較</div>';
  } catch(e) {
    comp.innerHTML = '<div class="loading">載入失敗</div>';
  }
}

// Court Comparison
document.getElementById('compare-btn')?.addEventListener('click', async () => {
  const c1 = document.getElementById('court1').value;
  const c2 = document.getElementById('court2').value;
  
  document.getElementById('court-comparison').innerHTML = '<div class="loading">比較中...</div>';
  
  try {
    const res = await fetch(API_BASE + '/api/courts/compare?court1=' + c1 + '&court2=' + c2);
    const data = await res.json();
    
    if (data.data) {
      document.getElementById('court-comparison').innerHTML = 
        '<table class="comparison-table"><tr><th>項目</th><th>' + c1 + '</th><th>' + c2 + '</th></tr>' +
        '<tr><td>案件量</td><td>' + (data.data.court1?.total_cases || 0) + '</td><td>' + (data.data.court2?.total_cases || 0) + '</td></tr></table>';
    } else {
      document.getElementById('court-comparison').innerHTML = '<div class="loading">比較資料載入中...</div>';
    }
  } catch(e) {
    document.getElementById('court-comparison').innerHTML = '<div class="loading">比較功能開發中</div>';
  }
});

// Show Lawyer Detail
function showLawyerDetail(item) {
  const lawyer = JSON.parse(item.dataset.lawyer);
  const detail = document.getElementById('lawyer-detail');
  document.getElementById('lawyer-detail-header').innerText = '律師詳情 - ' + lawyer.name;
  
  detail.innerHTML = 
    '<div class="detail-header"><div class="detail-avatar">' + lawyer.name[0] + '</div>' +
    '<div class="detail-title"><h2>' + lawyer.name + ' 律師</h2>' +
    '<p>專長：' + (lawyer.specialty || '一般') + ' | 法院：' + (lawyer.court || '待確認') + '</p></div></div>' +
    '<div class="stats-grid"><div class="stat-box"><div class="value">' + (lawyer.total_cases || 0) + '</div><div class="label">案件數</div></div>' +
    '<div class="stat-box"><div class="value">' + (lawyer.win_rate || 0) + '%</div><div class="label">勝訴率</div></div>' +
    '<div class="stat-box"><div class="value">' + (lawyer.style || '待分析') + '</div><div class="label">風格</div></div></div>' +
    '<div style="margin: 1rem 0;"><h4>📊 風格分析</h4><p style="color: #718096; font-size: 0.9rem;">' + getStyleDescription(lawyer.style) + '</p></div>' +
    '<button class="action-btn btn-primary">📞 立即委託</button><button class="action-btn btn-secondary">📋 查看過往案例</button>';
}

// Show Judge Detail
function showJudgeDetail(item) {
  const judge = JSON.parse(item.dataset.judge);
  const detail = document.getElementById('judge-detail');
  document.getElementById('judge-detail-header').innerText = '法官詳情 - ' + judge.name;
  
  detail.innerHTML = 
    '<div class="detail-header"><div class="detail-avatar">' + ((judge.name || '法官')[0]) + '</div>' +
    '<div class="detail-title"><h2>' + (judge.name || '未知') + ' 法官</h2>' +
    '<p>法院：' + (judge.court || '待確認') + ' | 專長：' + (judge.specialty || '綜合') + '</p></div></div>' +
    '<div class="stats-grid"><div class="stat-box"><div class="value">' + (judge.year || '-') + '</div><div class="label">年份</div></div>' +
    '<div class="stat-box"><div class="value">' + (judge.court_level || '-') + '</div><div class="label">層級</div></div>' +
    '<div class="stat-box"><div class="value">' + (judge.position || '法官') + '</div><div class="label">職位</div></div></div>' +
    '<div class="timeline"><div class="timeline-item"><div class="timeline-date">' + (judge.year || '-') + '年</div>' +
    '<div class="timeline-content">' + (judge.court || '') + ' - ' + (judge.position || '法官') + '</div></div></div>';
}

function getStyleClass(style) {
  if (style === '攻擊型') return 'attack';
  if (style === '防禦型') return 'defense';
  if (style === '穩健型') return 'balanced';
  if (style === '妥協型') return 'pragmatic';
  return 'pragmatic';
}

function getStyleDescription(style) {
  if (style === '攻擊型') return '擅長主動出擊，積極舉證，喜歡挑戰對方論點。在案件中常使用「抗辯」、「舉證責任」等攻擊性策略。';
  if (style === '防禦型') return '善於防守，反駁對方指控，強調程序正當性，保護當事人權益。';
  if (style === '妥協型') return '尋求共識，願意讓步，注重雙贏，柔性協調達成和解。';
  if (style === '穩健型') return '客觀分析，證據為本，邏輯嚴謹，不偏不倚，依法論述。';
  return '風格分析中...';
}

// Quick Search Tags
document.querySelectorAll('.tag-btn[data-query]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('search-input').value = btn.dataset.query;
  });
});

// Initial load
loadStats();
