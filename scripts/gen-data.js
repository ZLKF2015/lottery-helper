/*
 * 数据生成脚本 —— gen-data.js
 * ---------------------------------------------------------------------------
 * 用途：生成本站使用的彩票数据文件 data.js。
 *
 * 数据来源说明（重要）：
 *  - 数组中最新的 N 期为「真实开奖记录」，抓取自东方财富网彩票频道
 *    (caipiao.eastmoney.com) 于 2026-07-08，仅作演示展示。
 *  - 其余较早的历史期为「演示数据 (DEMO)」，由本脚本以固定随机种子生成，
 *    分布接近真实但「并非」官方真实开奖号码，仅用于让统计/走势功能有数据可看。
 *
 * 接入真实数据：
 *  把 data.js 中 LOTTERY_DATA.ssq / .dlt 两个数组替换为官方完整历史即可
 *  （每条记录格式见下方 buildSsq / buildDlt 的注释）。也可自行编写爬虫，
 *  调用中国福彩网 / 中国体彩网公开接口后写入同格式数组。
 *  替换后请删除 data.js 顶部的「演示数据」提示，并在 index.html 中关闭提示横幅。
 */

const fs = require('fs');
const path = require('path');

// ---- 固定随机种子，保证演示数据可复现 ----
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260708);

// 从 [1..max] 抽取 count 个不重复数字并排序
function pickUnique(max, count) {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}
const pad2 = (n) => String(n).padStart(2, '0');

// ---- 真实开奖记录（最新在前）----
const REAL_SSQ = [
  { issue: '2026077', date: '2026-07-07', red: [1, 4, 5, 14, 18, 25], blue: [4] },
  { issue: '2026076', date: '2026-07-05', red: [1, 3, 19, 20, 24, 25], blue: [7] },
  { issue: '2026075', date: '2026-07-02', red: [8, 12, 18, 21, 24, 30], blue: [1] },
  { issue: '2026074', date: '2026-06-30', red: [2, 23, 24, 26, 28, 32], blue: [4] },
  { issue: '2026073', date: '2026-06-28', red: [9, 10, 13, 16, 19, 21], blue: [8] },
];

const REAL_DLT = [
  { issue: '26076', date: '2026-07-08', front: [15, 20, 27, 28, 35], back: [2, 11] },
  { issue: '26075', date: '2026-07-06', front: [1, 6, 16, 18, 26], back: [4, 10] },
  { issue: '26074', date: '2026-07-04', front: [1, 4, 10, 23, 25], back: [1, 12] },
  { issue: '26073', date: '2026-07-01', front: [4, 10, 22, 23, 33], back: [2, 12] },
  { issue: '26072', date: '2026-06-29', front: [1, 13, 26, 29, 30], back: [9, 11] },
];

// 生成较早的「演示数据」，日期沿开奖日往回推，期号递减
function generateDemo(realLatest, opts) {
  const { drawWeekdays, count, redMax, redCount, blueMax, blueCount, issueStart, redKey, blueKey } = opts;
  // 开奖日早于真实最早一期的日期，往前逐日扫描
  const earliestReal = new Date(realLatest[realLatest.length - 1].date + 'T00:00:00');
  const cursor = new Date(earliestReal);
  cursor.setDate(cursor.getDate() - 1);

  const demo = [];
  let issue = issueStart; // 真实最早一期的前一期
  let made = 0;
  while (made < count) {
    const dow = cursor.getDay();
    if (drawWeekdays.includes(dow)) {
      const dateStr = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-${pad2(cursor.getDate())}`;
      const rec = {
        issue: String(issue),
        date: dateStr,
        [redKey]: pickUnique(redMax, redCount),
        [blueKey]: pickUnique(blueMax, blueCount),
      };
      demo.push(rec);
      issue -= 1;
      made += 1;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return demo.reverse(); // 转成由新到旧
}

// 双色球：每周日(0)、二(2)、四(4) 开奖；真实最早 2026073，演示从 2026072 递减
const demoSsq = generateDemo(REAL_SSQ, {
  drawWeekdays: [0, 2, 4],
  count: 150,
  redMax: 33,
  redCount: 6,
  blueMax: 16,
  blueCount: 1,
  redKey: 'red',
  blueKey: 'blue',
  issueStart: 2026072,
});

// 大乐透：每周一(1)、三(3)、六(6) 开奖；真实最早 26072，演示从 26071 递减
const demoDlt = generateDemo(REAL_DLT, {
  drawWeekdays: [1, 3, 6],
  count: 150,
  redMax: 35,
  redCount: 5,
  blueMax: 12,
  blueCount: 2,
  redKey: 'front',
  blueKey: 'back',
  issueStart: 26071,
});

const ssq = [...REAL_SSQ, ...demoSsq];
const dlt = [...REAL_DLT, ...demoDlt];

const meta = {
  ssq: {
    key: 'ssq',
    name: '双色球',
    org: '中国福利彩票',
    drawDays: '每周二、四、日 20:40',
    redMax: 33,
    redCount: 6,
    redLabel: '红球',
    blueMax: 16,
    blueCount: 1,
    blueLabel: '蓝球',
    realCount: REAL_SSQ.length,
  },
  dlt: {
    key: 'dlt',
    name: '大乐透',
    org: '中国体育彩票',
    drawDays: '每周一、三、六 20:40',
    redMax: 35,
    redCount: 5,
    redLabel: '前区',
    blueMax: 12,
    blueCount: 2,
    blueLabel: '后区',
    realCount: REAL_DLT.length,
  },
};

const banner =
  '/* ⚠️ 演示数据提示：本文件中最新的几期为真实开奖记录（抓取于 2026-07-08），\n' +
  '   其余较早历史期为固定随机种子生成的「演示数据」，并非官方真实开奖号码。\n' +
  '   仅用于功能演示。请接入官方 API 后替换为完整真实历史。 */\n';

const out =
  banner +
  'window.LOTTERY_DATA = ' +
  JSON.stringify({ meta, ssq, dlt }, null, 2) +
  ';\n';

const outPath = path.join(__dirname, '..', 'data.js');
fs.writeFileSync(outPath, out, 'utf8');
console.log(`写入 ${outPath}`);
console.log(`双色球记录数: ${ssq.length}（真实 ${meta.ssq.realCount} 期）`);
console.log(`大乐透记录数: ${dlt.length}（真实 ${meta.dlt.realCount} 期）`);
console.log('双色球最早演示期:', ssq[ssq.length - 1].issue, ssq[ssq.length - 1].date);
console.log('大乐透最早演示期:', dlt[dlt.length - 1].issue, dlt[dlt.length - 1].date);
