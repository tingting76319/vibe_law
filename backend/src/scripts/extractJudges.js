/**
 * 法官資料提取 Script
 * 從判決書中提取法官姓名
 */

function extractJudgesFromJudgment(jfull) {
  if (!jfull) return [];

  // 法官姓名格式
  const judgePattern = /法\s*官\s*([^\n\r]{2,4})/g;
  const judges = [];
  let match;

  while ((match = judgePattern.exec(jfull)) !== null) {
    const name = match[1].trim();
    if (name.length >= 2 && name.length <= 4) {
      judges.push(name);
    }
  }

  return [...new Set(judges)];
}

module.exports = { extractJudgesFromJudgment };
