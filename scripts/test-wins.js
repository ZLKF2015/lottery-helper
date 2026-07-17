/* 自测：验证 开奖核对 + 中奖判定 + 中奖邮件正文 全链路（不发邮件、不改真实存储）
   运行：node scripts/test-wins.js */
'use strict';

const { fetchResults } = require('./results-lib');
const { judge, tierOf } = require('./prize');
const { checkType, buildWinEmail } = require('./check-wins');

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg);
  console.log('  ✓', msg);
}

async function main() {
  console.log('1) 中奖等级纯函数校验');
  assert(tierOf('ssq', 6, 1) === 1, '双色球 6+1 = 一等奖');
  assert(tierOf('ssq', 5, 1) === 3, '双色球 5+1 = 三等奖');
  assert(tierOf('ssq', 0, 1) === 6, '双色球 0+1 = 六等奖');
  assert(tierOf('ssq', 2, 0) === 0, '双色球 2+0 = 不中奖');
  assert(tierOf('dlt', 5, 2) === 1, '大乐透 5+2 = 一等奖');
  assert(tierOf('dlt', 4, 2) === 4, '大乐透 4+2 = 四等奖');
  assert(tierOf('dlt', 0, 2) === 8, '大乐透 0+2 = 八等奖');
  assert(tierOf('dlt', 2, 0) === 0, '大乐透 2+0 = 不中奖');

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

  console.log('\n全部通过 ✅（本测试未发送邮件、未修改 picks-history.json）');
}

main().catch((e) => {
  console.error('测试失败:', e.message);
  process.exit(1);
});
