# Release Checklist

1. **更新版本資訊**
   - 確認 `RELEASE.md`、`CHANGELOG.md` 已記錄本次變更與 API 清單。
2. **打理依賴與 script**
   - `npm run lint`
   - `npm run test:run`（務必以 GitHub Actions 用的 `DATABASE_URL` 或雲端 PostgreSQL）
   - `npm run build`
3. **Git 操作**
   - `git add` 所有變更
   - `git commit -m "release: v0.5.1"`
   - `git tag -a v0.5.1 -m "Release v0.5.1"`
   - `git push origin main`
   - `git push origin v0.5.1`
4. **建立 GitHub Release**
   - 使用 GitHub Release UI 或 `gh release create v0.5.1 -F RELEASE.md`，Release title 可與版本號一致，Release body 直接貼 `RELEASE.md` 前段。
5. **更新 README / 文件**
   - 確認 `README.md`、CI badge、& `.env.example` 皆為最新狀態。
6. **備註（若適用）**
   - 若有新增 Secrets（例如 `DATABASE_URL`），請同步告知團隊。  
   - 若 release 包含部署指令（Zeabur、GitHub Pages 等），請把 deploy note 加到 release notes 或 `RELEASE.md` 末尾。
