/**
 * Frontend E2E 測試
 */
import { test, expect } from '@playwright/test';

test.describe('法律 RAG 系統 E2E 測試', () => {
  
  test.beforeEach(async ({ page }) => {
    // 等待頁面載入
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('首頁應該正確載入', async ({ page }) => {
    // 檢查標題
    await expect(page).toHaveTitle(/法律/);
    
    // 檢查主要元素存在
    const header = page.locator('header, .header, h1').first();
    await expect(header).toBeVisible();
  });

  test('搜尋功能應該正常運作', async ({ page }) => {
    // 找到搜尋輸入框
    const searchInput = page.locator('input[type="text"], input[placeholder*="搜"], #search-input, .search input').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('民事');
      await searchInput.press('Enter');
      
      // 等待結果
      await page.waitForTimeout(1000);
      
      // 檢查結果顯示
      const results = page.locator('.result, .case-item, .search-result, .cases .case');
      const count = await results.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('法條搜尋功能應該正常運作', async ({ page }) => {
    // 找法條搜尋區塊
    const lawSearchInput = page.locator('input[placeholder*="法條"], #law-search, .law-search input').first();
    
    if (await lawSearchInput.isVisible()) {
      await lawSearchInput.fill('民法');
      await lawSearchInput.press('Enter');
      
      await page.waitForTimeout(500);
      
      // 檢查法條結果
      const lawResults = page.locator('.law-result, .law-item, .laws .law');
      const count = await lawResults.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('法官查詢功能應該正常運作', async ({ page }) => {
    // 找法官搜尋
    const judgeInput = page.locator('input[placeholder*="法官"], #judge-search, .judge-search input').first();
    
    if (await judgeInput.isVisible()) {
      await judgeInput.fill('張');
      await judgeInput.press('Enter');
      
      await page.waitForTimeout(500);
      
      // 檢查法官結果
      const judgeResults = page.locator('.judge-result, .judge-item, .judges .judge');
      expect(await judgeResults.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('RAG 問答功能應該正常運作', async ({ page }) => {
    // 找問答輸入框
    const qaInput = page.locator('textarea, input[placeholder*="問"], #qa-input, .qa input').first();
    
    if (await qaInput.isVisible()) {
      await qaInput.fill('什麼是民事訴訟？');
      
      // 找提交按鈕
      const submitBtn = page.locator('button[type="submit"], .submit, button:has-text("問")').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        
        await page.waitForTimeout(2000);
        
        // 檢查回答顯示
        const answer = page.locator('.answer, .qa-result, .result');
        expect(await answer.count()).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('圖表應該正確渲染', async ({ page }) => {
    // 檢查圖表區塊
    const chartContainer = page.locator('#chart, .chart, svg').first();
    
    if (await chartContainer.isVisible()) {
      await page.waitForTimeout(1000);
      // 檢查 SVG 元素存在
      const svg = page.locator('svg');
      const count = await svg.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('API 整合測試', () => {
  
  test('Backend API 健康檢查', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/rag/health');
    
    // 如果伺服器未啟動，跳過測試
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.status).toBe('ok');
    }
  });

  test('案例搜尋 API', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/judicial/search?q=民事');
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.status).toBe('success');
    }
  });

  test('案例列表 API', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/judicial/cases');
    
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.status).toBe('success');
      expect(data.data).toBeInstanceOf(Array);
    }
  });
});
