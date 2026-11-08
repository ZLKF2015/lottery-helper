/* 累计购彩账本：从 picks-history.json 纯推导，不新增存储字段（权威数据源始终是历史记录）。
   口径：
   - purchaseCount：已推送成功的记录数（sent===true；旧版记录先发信后落盘、没有 sent 字段，视为已发送；
     sent===false 视为推送失败、用户未收到号码，不计入）
   - purchaseAmount：每次推送 = 双色球 5 注 + 大乐透 5 注 = 20 元/天（每注 2 元）
   - winCount / winAmount：全部已推送记录 result 中的 wins 求和；
     固定奖级（ssq 3-6、dlt 3-9）按官方固定金额累加；
     一/二等奖为浮动奖（金额随期变动），只计入 winCount、金额不计入 winAmount
   - net = 购买金额 − 中奖金额（不含浮动奖，故为偏高的净投入估计）

   用法：
   const stats = computeStats(load(), includeId);
   includeId：可选，本次刚落盘、尚未置 sent 的记录 id（推送邮件场景，当天这条应计入） */
'use strict';

const { FIXED_PRIZE } = require('./prize');

const COST_PER_PUSH = 20; // 5 注双色球(2元/注) + 5 注大乐透(2元/注) = 20 元/天

function computeStats(store, includeId) {
  let purchaseCount = 0;
  let winCount = 0;
  let winAmount = 0;
  for (const r of store.records) {
    const purchased = r.sent !== false || (includeId && r.id === includeId);
    if (!purchased) continue;
    purchaseCount++;
    const res = r.result || {};
    for (const type of ['ssq', 'dlt']) {
      const resolved = res[type];
      if (!resolved || !Array.isArray(resolved.wins)) continue;
      for (const w of resolved.wins) {
        const amt = FIXED_PRIZE[type] && FIXED_PRIZE[type][w.tier];
        if (amt) winAmount += amt;
        winCount++; // 浮动奖（一二等）只计数不计金额
      }
    }
  }
  const purchaseAmount = purchaseCount * COST_PER_PUSH;
  return {
    purchaseCount,
    purchaseAmount,
    winCount,
    winAmount,
    net: purchaseAmount - winAmount,
  };
}

// 纯文本汇总行（推送邮件正文 / 中奖邮件正文共用）
function formatStatsText(stats) {
  if (!stats) return '';
  const money = (n) => '¥' + Number(n).toLocaleString('zh-CN');
  return '📊 累计购彩账本：购买 ' + stats.purchaseCount + ' 次 / ' + money(stats.purchaseAmount) +
    '｜中奖 ' + stats.winCount + ' 注 / ' + money(stats.winAmount) +
    '（固定奖累计，浮动奖未计入）';
}

module.exports = { computeStats, formatStatsText, COST_PER_PUSH };
