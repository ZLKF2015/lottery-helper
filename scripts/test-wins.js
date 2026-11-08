/* 自测：验证 开奖核对 + 中奖判定 + 中奖邮件正文 全链路（不发邮件、不改真实存储）
   运行：node scripts/test-wins.js */
'use strict';

const { fetchResults } = require('./results-lib');
const { judge, tierOf } = require('./prize');
const { checkType, buildWinEmail, buildWinEmailHtml } = require('./check-wins');
const { computeStats, formatStatsText } = require('./stats');

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
  console.log('  ✓', msg);
}

async function main() {
  console.log('1) 中奖等级纯函数校验（双色球全奖级 + 大乐透官方 9 级全组合）');
  assert(tierOf('ssq', 6, 1) === 1, '双色球 6+1 = 一等奖');
  assert(tierOf('ssq', 6, 0) === 2, '双色球 6+0 = 二等奖');
  assert(tierOf('ssq', 5, 1) === 3, '双色球 5+1 = 三等奖');
  assert(tierOf('ssq', 5, 0) === 4, '双色球 5+0 = 四等奖');
  assert(tierOf('ssq', 4, 1) === 4, '双色球 4+1 = 四等奖');
  assert(tierOf('ssq', 4, 0) === 5, '双色球 4+0 = 五等奖');
  assert(tierOf('ssq', 3, 1) === 5, '双色球 3+1 = 五等奖');
  assert(tierOf('ssq', 2, 1) === 6, '双色球 2+1 = 六等奖');
  assert(tierOf('ssq', 1, 1) === 6, '双色球 1+1 = 六等奖');
  assert(tierOf('ssq', 0, 1) === 6, '双色球 0+1 = 六等奖');
  assert(tierOf('ssq', 2, 0) === 0, '双色球 2+0 = 不中奖');
  assert(tierOf('ssq', 0, 0) === 0, '双色球 0+0 = 不中奖');

  // 大乐透官方 9 级（2019-02 规则）：三=5+0｜四=4+2｜五=4+1｜六=3+2｜七=4+0｜
  // 八=3+1、2+2｜九=3+0、1+2、2+1、0+2；其余（含 2+0、1+1）不中奖
  assert(tierOf('dlt', 5, 2) === 1, '大乐透 5+2 = 一等奖');
  assert(tierOf('dlt', 5, 1) === 2, '大乐透 5+1 = 二等奖');
  assert(tierOf('dlt', 5, 0) === 3, '大乐透 5+0 = 三等奖');
  assert(tierOf('dlt', 4, 2) === 4, '大乐透 4+2 = 四等奖');
  assert(tierOf('dlt', 4, 1) === 5, '大乐透 4+1 = 五等奖');
  assert(tierOf('dlt', 3, 2) === 6, '大乐透 3+2 = 六等奖');
  assert(tierOf('dlt', 4, 0) === 7, '大乐透 4+0 = 七等奖');
  assert(tierOf('dlt', 3, 1) === 8, '大乐透 3+1 = 八等奖');
  assert(tierOf('dlt', 2, 2) === 8, '大乐透 2+2 = 八等奖');
  assert(tierOf('dlt', 3, 0) === 9, '大乐透 3+0 = 九等奖');
  assert(tierOf('dlt', 2, 1) === 9, '大乐透 2+1 = 九等奖');
  assert(tierOf('dlt', 1, 2) === 9, '大乐透 1+2 = 九等奖');
  assert(tierOf('dlt', 0, 2) === 9, '大乐透 0+2 = 九等奖');
  assert(tierOf('dlt', 2, 0) === 0, '大乐透 2+0 = 不中奖');
  assert(tierOf('dlt', 1, 1) === 0, '大乐透 1+1 = 不中奖（历史 bug：曾误判八等奖）');
  assert(tierOf('dlt', 1, 0) === 0, '大乐透 1+0 = 不中奖');
  assert(tierOf('dlt', 0, 1) === 0, '大乐透 0+1 = 不中奖');
  assert(tierOf('dlt', 0, 0) === 0, '大乐透 0+0 = 不中奖');

  // 全枚举对照：6×3=18 种组合逐一核对，确认除上表外全为不中奖
  const dltExpect = { '5,2': 1, '5,1': 2, '5,0': 3, '4,2': 4, '4,1': 5, '3,2': 6, '4,0': 7, '3,1': 8, '2,2': 8, '3,0': 9, '2,1': 9, '1,2': 9, '0,2': 9 };
  for (let r = 0; r <= 5; r++) {
    for (let b = 0; b <= 2; b++) {
      const expect = dltExpect[`${r},${b}`] || 0;
      assert(tierOf('dlt', r, b) === expect, `大乐透 ${r}+${b} = ${expect === 0 ? '不中奖' : expect + '等奖'}`);
    }
  }

  console.log('\n2) 拉取真实开奖数据');
  const results = await fetchResults();
  const ssqDraw = results.ssq[results.ssq.length - 1];
  const dltDraw = results.dlt[results.dlt.length - 1];
  console.log(`  双色球最新 第${ssqDraw.issue}期 ${ssqDraw.drawDate} 红${ssqDraw.red.join(',')} 蓝${ssqDraw.blue.join(',')}`);
  console.log(`  大乐透最新 第${dltDraw.issue}期 ${dltDraw.drawDate} 前${dltDraw.red.join(',')} 后${dltDraw.blue.join(',')}`);

  console.log('\n3) 构造一条“必中头奖 + 部分中 + 不中”的推荐记录，跑核对');
  // 用最新开奖号码构造：完全命中(头奖) + 只中蓝球/后区(末等奖) + 完全不沾边
  const notSsqRed = [1, 2, 3, 4, 5, 6].filter((n) => !ssqDraw.red.includes(n)).slice(0, 6);
  const notSsqBlue = [ssqDraw.blue[0] === 1 ? 2 : 1];
  const record = {
    id: 'test',
    date: ssqDraw.drawDate, // 推荐日 = 开奖日，firstDrawOnOrAfter 应命中当期
    checked: false,
    result: null,
    ssq: [
      { red: ssqDraw.red.slice(), blue: ssqDraw.blue.slice() }, // 头奖
      { red: notSsqRed, blue: ssqDraw.blue.slice() },           // 只中蓝球 -> 六等奖
      { red: notSsqRed, blue: notSsqBlue },                      // 不中
    ],
    dlt: [
      { red: dltDraw.red.slice(), blue: dltDraw.blue.slice() }, // 头奖
    ],
  };
  // 让 dlt 记录的日期也可匹配
  record.date = ssqDraw.drawDate < dltDraw.drawDate ? ssqDraw.drawDate : dltDraw.drawDate;

  const ssqRes = checkType('ssq', record, results);
  const dltRes = checkType('dlt', record, results);
  assert(ssqRes && ssqRes.wins.length >= 2, `双色球核对命中 ${ssqRes ? ssqRes.wins.length : 0} 注（含头奖与末等奖）`);
  assert(ssqRes.wins[0].tier === 1, '双色球第 1 注为一等奖');
  assert(dltRes && dltRes.wins.length === 1 && dltRes.wins[0].tier === 1, '大乐透第 1 注为一等奖');

  console.log('\n4) 生成中奖邮件正文预览');
  const newWins = [
    { type: 'ssq', record, draw: ssqRes.resolved, typeWins: ssqRes.wins },
    { type: 'dlt', record, draw: dltRes.resolved, typeWins: dltRes.wins },
  ];
  const email = buildWinEmail(newWins);
  console.log('  主题:', email.subject);
  console.log('  ----- 正文 -----');
  console.log(email.text.split('\n').map((l) => '  ' + l).join('\n'));

  console.log('\n5) 累计购彩账本 computeStats（mini store 精确数值）');
  const mini = {
    records: [
      // r1：已发送，双色球四等奖(200)+一等奖(浮动，只计数)+大乐透八等奖(15)
      { id: 'r1', sent: true, result: { ssq: { wins: [{ tier: 4 }, { tier: 1 }] }, dlt: { wins: [{ tier: 8 }] } } },
      // r2：已发送、未核对
      { id: 'r2', sent: true, result: null },
      // r3：sent:false（推送失败）→ 整条不计入
      { id: 'r3', sent: false, result: { ssq: { wins: [{ tier: 6 }] } } },
      // r4：历史记录无 sent 字段 → 视为已发送；双色球三等奖 3000
      { id: 'r4', result: { ssq: { wins: [{ tier: 3 }] } } },
    ],
  };
  const st = computeStats(mini);
  assert(st.purchaseCount === 3, '购买次数 3（r1/r2/r4；r3 sent:false 不计）');
  assert(st.purchaseAmount === 60, '购买金额 3×20=60');
  assert(st.winCount === 4, '中奖次数 4（r1 三条 + r4 一条）');
  assert(st.winAmount === 3215, '中奖金额 200+15+3000=3215（一等奖浮动奖不计金额）');
  assert(st.net === -3155, '净投入 60-3215=-3155');
  const st2 = computeStats(mini, 'r3');
  assert(st2.purchaseCount === 4 && st2.winCount === 5, 'includeId 把当天未置 sent 的记录计入（4 次 / 5 注）');
  const txt = formatStatsText(st);
  assert(txt.includes('购买 3 次') && txt.includes('¥60') && txt.includes('中奖 4 注') && txt.includes('¥3,215'), 'formatStatsText 汇总行格式正确');
  const email2 = buildWinEmail(newWins, st);
  assert(email2.text.includes('累计购彩账本') && email2.text.includes('购买 3 次'), '中奖邮件正文含账本行');
  const html2 = buildWinEmailHtml(newWins, st);
  assert(html2.includes('累计购彩账本') && html2.includes('¥3,215'), '中奖邮件 HTML 含账本区块');
    console.log('\n全部通过 ✅（本测试未发送邮件、未修改 picks-history.json）');
}

main().catch((e) => {
  console.error('测试失败:', e.message);
  process.exit(1);
});
