/* 机选号码生成器：双色球 + 大乐透 各 N 注（均匀随机、不重复）
   既可直接运行打印，也可被 send-picks.js 引用生成邮件正文（text + html 双部分）。 */
'use strict';

const T = require('./email-template');

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

// 北京时间日期串
function beijingDateStr() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

// ---------- HTML 版面 ----------
const fmtYi = (n) => (n / 1e8).toFixed(2) + ' 亿';

// 「上期开奖」区块：latest = { ssq: {...最新期}, dlt: {...} }，缺哪个彩种就跳过哪行
function lastDrawSection(latest) {
  if (!latest || (!latest.ssq && !latest.dlt)) return '';
  const row = (label, draw, redTxt, blueTxt, blueCls) => {
    if (!draw) return '';
    const d = String(draw.drawDate || draw.date || '').slice(5); // MM-DD
    return (
      `<tr>` +
      `<td style="padding:6px 0;font-size:12px;color:${T.C.muted};">${T.esc(label)} <span style="color:${T.C.faint};">${T.esc(draw.issue)} 期（${T.esc(d)}）</span></td>` +
      `<td align="right" style="padding:6px 0;font-size:12px;color:${T.C.text};">${redTxt} <span style="color:${blueCls};">${blueTxt}</span></td>` +
      `</tr>`
    );
  };
  const l = latest.ssq
    ? row('双色球', latest.ssq,
        (latest.ssq.red || []).map(T.pad2).join(' · '),
        '+ ' + (latest.ssq.blue || []).map(T.pad2).join(' · '), '#5b8dff')
    : '';
  const d = latest.dlt
    ? row('大乐透', latest.dlt,
        (latest.dlt.red || []).map(T.pad2).join(' · '),
        '+ ' + (latest.dlt.blue || []).map(T.pad2).join(' · '), '#ff6a7a')
    : '';
  const pool = latest.ssq && latest.ssq.pool
    ? `<tr><td style="padding:6px 0;border-top:1px solid ${T.C.lineSoft};font-size:12px;color:${T.C.muted};">双色球奖池</td>` +
      `<td align="right" style="padding:6px 0;border-top:1px solid ${T.C.lineSoft};font-size:12px;color:${T.C.goldBright};">${fmtYi(latest.ssq.pool)} 💰</td></tr>`
    : '';
  return (
    `<tr><td style="padding:16px 30px 2px;border-top:1px solid ${T.C.lineGold};">` +
    `<span style="font-size:14px;color:${T.C.gold};font-weight:700;">📡 上期开奖</span></td></tr>` +
    `<tr><td style="padding:4px 30px 10px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:12px;color:${T.C.muted};">` +
    l + d + pool +
    `</table></td></tr>`
  );
}

function buildEmailHtml(picks, dateStr, latest) {
  const ssqRows = picks.ssq.map((p, i) => T.pickRow(i + 1, p, 'ssq')).join('');
  const dltRows = picks.dlt.map((p, i) => T.pickRow(i + 1, p, 'dlt')).join('');
  const inner =
    T.header('每日机选号码推送', '双色球 5 注 ＋ 大乐透 5 注', dateStr) +
    T.gameHead('ssq') + ssqRows +
    T.gameHead('dlt') + dltRows +
    lastDrawSection(latest) +
    T.disclaimerFooter('自动推送');
  return T.pageWrap(inner, `今日机选号码已生成：双色球 5 注 + 大乐透 5 注，祝你好运 🍀`);
}

// latest：可选的上期开奖数据 { ssq, dlt }（由 send-picks.js 尽力获取，失败不影响发送）
function buildEmailBody(latest) {
  const ssq = genPicks('ssq', 5);
  const dlt = genPicks('dlt', 5);
  const date = beijingDateStr();
  const picks = { ssq, dlt };
  return {
    subject: `🍀 今日机选号码推送（${date}）`,
    text:
      `今日机选推荐（仅供娱乐参考，彩票完全随机，请理性购彩、量力而行）：\n\n` +
      formatPicks('ssq', ssq) + '\n\n' + formatPicks('dlt', dlt) +
      '\n\n—— 开运·彩票助手 自动推送',
    html: buildEmailHtml(picks, date, latest),
    picks,
  };
}

module.exports = { genPicks, formatPicks, buildEmailBody, buildEmailHtml, lastDrawSection, META, pick };

if (require.main === module) {
  console.log(buildEmailBody().text);
}
