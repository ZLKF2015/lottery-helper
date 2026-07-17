/* 机选号码生成器：双色球 + 大乐透 各 N 注（均匀随机、不重复）
   既可直接运行打印，也可被 send-picks.js 引用生成邮件正文。 */
'use strict';

function pick(max, count) {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

const META = {
  ssq: { name: '双色球', redMax: 33, redCount: 6, blueMax: 16, blueCount: 1, redLabel: '红球', blueLabel: '蓝球' },
  dlt: { name: '大乐透', redMax: 35, redCount: 5, blueMax: 12, blueCount: 2, redLabel: '前区', blueLabel: '后区' },
};

function genPicks(type, n) {
  const m = META[type];
  const out = [];
  for (let i = 0; i < n; i++) out.push({ red: pick(m.redMax, m.redCount), blue: pick(m.blueMax, m.blueCount) });
  return out;
}

function formatPicks(type, picks) {
  const m = META[type];
  const lines = picks.map((p, i) => {
    const r = p.red.map((x) => String(x).padStart(2, '0')).join(' ');
    const b = p.blue.map((x) => String(x).padStart(2, '0')).join(' ');
    return `第 ${i + 1} 注：${m.redLabel} ${r} ｜ ${m.blueLabel} ${b}`;
  });
  return `【${m.name}】\n` + lines.join('\n');
}

function buildEmailBody() {
  const ssq = genPicks('ssq', 5);
  const dlt = genPicks('dlt', 5);
  const date = new Date().toLocaleDateString('zh-CN');
  return {
    subject: `🍀 今日机选号码推送（${date}）`,
    text:
      `今日机选推荐（仅供娱乐参考，彩票完全随机，请理性购彩、量力而行）：\n\n` +
      formatPicks('ssq', ssq) + '\n\n' + formatPicks('dlt', dlt) +
      '\n\n—— 开运·彩票助手 自动推送',
    picks: { ssq, dlt },
  };
}

module.exports = { genPicks, formatPicks, buildEmailBody, META, pick };

if (require.main === module) {
  console.log(buildEmailBody().text);
}
