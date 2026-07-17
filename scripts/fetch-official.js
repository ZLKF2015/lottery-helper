/* 抓取官方真实开奖数据并生成 data.js（替换演示数据） */
'use strict';
const fs = require('fs');
const path = require('path');
const { fetchSSQ, fetchDLT } = require('./fetch-lib');

const ROOT = path.join(__dirname, '..');

const META = {
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
    source: '中彩网 (www.cwl.gov.cn)',
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
    source: '500彩票 (datachart.500.com)',
  },
};

(async () => {
  console.log('抓取双色球（中彩网）...');
  const ssq = await fetchSSQ(400);
  console.log(`  得到 ${ssq.length} 期，最新 ${ssq[0].issue}`);
  console.log('抓取大乐透（500彩票）...');
  const dlt = await fetchDLT('25001');
  console.log(`  得到 ${dlt.length} 期，最新 ${dlt[0].issue}`);

  // 全部为官方真实记录：realCount = 总期数
  META.ssq.realCount = ssq.length;
  META.dlt.realCount = dlt.length;

  const header =
    `/* ============================================================\n` +
    `   开运 · 彩票助手  —  官方真实开奖数据\n` +
    `   生成时间: ${new Date().toISOString()}\n` +
    `   双色球来源: 中彩网官方接口 (www.cwl.gov.cn)\n` +
    `   大乐透来源: 500彩票历史表 (datachart.500.com，体彩网镜像)\n` +
    `   本文件全部为官方真实开奖记录（共 ${ssq.length + dlt.length} 期），\n` +
    `   不含任何演示/模拟号码。运行 scripts/fetch-official.js 可刷新。\n` +
    `   ============================================================ */\n`;

  const body =
    `window.LOTTERY_DATA = ` +
    JSON.stringify({ meta: META, ssq, dlt }, null, 2) +
    ';\n';

  fs.writeFileSync(path.join(ROOT, 'data.js'), header + body, 'utf8');
  console.log('已写入 data.js ✔');
})().catch((e) => {
  console.error('抓取失败:', e.message);
  process.exit(1);
});
