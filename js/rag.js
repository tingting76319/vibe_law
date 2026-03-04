// Legal-RAG 生成式問答模組

// RAG 問答系統
function askRAG(question) {
    // 1. 檢索相關資料
    const searchResults = handleSearch(question);
    
    // 2. 生成回答
    const answer = generateAnswer(question, searchResults);
    
    return {
        question: question,
        answer: answer,
        relatedCases: searchResults?.cases || [],
        relatedLaws: searchResults?.laws || [],
        sources: [
            ...(searchResults?.cases || []).map(c => ({ type: 'case', id: c.id || c.jid, title: c.title || c.jtitle, caseNumber: c.caseNumber || c.jcase, court: c.court, year: c.year || c.jyear, relatedLaws: c.relatedLaws || [] })),
            ...(searchResults?.laws || []).map(l => ({ type: 'law', name: l.name, description: l.content?.substring(0, 100) }))
        ]
    };
}

// 生成回答
function generateAnswer(question, searchResults) {
    const q = question.toLowerCase();
    
    // 如果有現成的熱門問題回答
    if (searchResults?.hotAnswers) {
        return searchResults.hotAnswers;
    }
    
    // 根據搜尋結果生成回答
    const cases = searchResults?.cases || [];
    const laws = searchResults?.laws || [];
    
    if (cases.length === 0 && laws.length === 0) {
        return {
            title: '搜尋結果',
            content: `很抱歉，系統目前沒有找到與「${question}」直接相關的判例或法規。

建議您：
1. 嘗試使用不同的關鍵字
2. 擴大搜尋範圍
3. 聯繫專業律師尋求法律意見

注意：本系統資料庫仍在持續更新中。`,
            relatedCases: []
        };
    }
    
    // 生成基於搜尋結果的回答
    let content = `根據搜尋結果，找到 ${cases.length} 個相關判例和 ${laws.length} 條相關法規：\n\n`;
    
    // 加入法規內容摘要
    if (laws.length > 0) {
        content += `## 相關法規\n\n`;
        laws.forEach(law => {
            content += `**${law.name}**\n`;
            content += law.content.substring(0, 300) + '...\n\n';
        });
    }
    
    // 加入判例摘要
    if (cases.length > 0) {
        content += `## 類似判例\n\n`;
        cases.slice(0, 2).forEach(c => {
            content += `- ${c.court} ${c.year}年 ${c.caseNumber}：${c.title}\n`;
            content += `  ${c.summary.substring(0, 80)}...\n\n`;
        });
    }
    
    content += `---\n\n`;
    content += `以上資訊僅供參考，不構成法律意見。如有具體法律問題，建議諮詢專業律師。`;
    
    return {
        title: '搜尋結果',
        content: content,
        relatedCases: cases.slice(0, 3).map(c => c.id)
    };
}

// 渲染問答
function renderQA(qaData) {
    const history = document.getElementById('qa-history');
    
    // 移除歡迎訊息
    const welcomeMsg = history.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const qaHtml = `
        <div class="qa-item">
            <div class="question">
                <span class="question-label">問題</span>
                <span>${qaData.question}</span>
            </div>
            <div class="answer">
                <span class="answer-label">回答</span>
                <div class="answer-content">
                    <h4>${qaData.answer.title}</h4>
                    <pre style="white-space: pre-wrap; font-family: inherit; margin-top: 10px;">${qaData.answer.content}</pre>
                    
                    ${qaData.relatedCases.length > 0 ? `
                        <div class="related-cases">
                            <h4>📋 相關判例：</h4>
                            <ul>
                                ${qaData.relatedCases.map(c => `<li onclick="showCaseDetail('${c.id}')">${getCaseById(c)?.court} ${getCaseById(c)?.year}年 ${getCaseById(c)?.caseNumber} - ${getCaseById(c)?.title}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    // 添加新問答到開頭
    history.insertAdjacentHTML('afterbegin', qaHtml);
    
    // 滾動到頂部
    history.scrollTop = 0;
}

// 顯示判例詳情
function showCaseDetail(caseId) {
    const caseData = getCaseById(caseId);
    if (!caseData) return;
    
    const message = `【${caseData.title}】

法院：${caseData.court}
案號：${caseData.year}年 ${caseData.caseNumber}
類型：${caseData.type}
日期：${caseData.date}

${caseData.summary}

判決結果：${caseData.result}

相關法規：${caseData.relatedLaws.join('、')}

---
輸入「y」可查看案件脈絡圖`;

    alert(message);
    
    // 檢查是否要顯示脈絡圖（需要在 alert 關閉後處理）
    setTimeout(() => {
        const showGraph = confirm('是否查看案件脈絡圖？');
        if (showGraph) {
            switchView('case-context');
            if (typeof loadCaseContextGraph === 'function') {
                loadCaseContextGraph(caseId);
            }
        }
    }, 100);
}

// 顯示法規詳情
function showLawDetail(lawId) {
    const lawData = getLawById(lawId);
    if (!lawData) return;
    
    alert(`【${lawData.name}】

類別：${lawData.category}
章節：${lawData.chapter}
最近修訂：${lawData.lastAmended}

${lawData.content}
`);
}

// 清除問答歷史
function clearQA() {
    const history = document.getElementById('qa-history');
    history.innerHTML = `
        <div class="welcome-message">
            <p>歡迎使用台灣法律專家知識系統！</p>
            <p>請在上方輸入您的法律問題，我會為您搜尋相關判例並提供解答。</p>
            <p class="disclaimer">⚠️ 本系統僅供參考，不構成法律意見。如有具體法律問題，請諮詢律師。</p>
        </div>
    `;
}
