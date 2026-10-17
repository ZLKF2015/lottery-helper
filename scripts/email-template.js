/* ============================================================
   HTML 邮件模板渲染器（共享）
   设计方向：金红夜宴 —— 延续站点 styles.css 的暗夜幸运金红视觉
   技术约束：QQ 邮箱手机端兼容 → 全部内联样式 + 表格布局，
   禁止 <style> 标签依赖与外部资源；颜色写入背景色而非仅渐变
   （渐变只作增强，老客户端回退到纯色仍可读）。
   ============================================================ */
'use strict';

// ---------- 品牌色（与 styles.css 一致） ----------
const C = {
  bgPage: '#f4f1ec',
  bgCard: '#1c1020',
  bgFooter: '#150b19',
  gold: '#e9b949',
  goldBright: '#f6d27a',
  luckyDeep: '#d62a48',
  lucky: '#ff3b5c',
  redBall: '#e23b4e',
  blueBall: '#2f6df0',
  text: '#f6efe3',
  muted: '#b6a4b6',
  faint: '#7d6f80',
  lineSoft: 'rgba(255,255,255,0.08)',
  lineGold: 'rgba(233,185,73,0.18)',
  rowBg: 'rgba(255,255,255,0.05)',
  badgeBg: '#f6d27a',
  badgeText: '#5c3a00',
};

const pad2 = (n) => String(n).padStart(2, '0');
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 球 ----------
// cls: 'red' | 'blue'（按彩种传入：双色球红/蓝，大乐透前区=蓝、后区=红）
function ball(n, cls, size) {
  const s = size || 'md'; // md=30px（推送） sm=26px（中奖明细）
  const d = s === 'md' ? { w: 30, f: 14 } : { w: 26, f: 12 };
  const base = cls === 'red' ? C.redBall : C.blueBall;
  const grad = cls === 'red'
    ? 'linear-gradient(145deg,#ff6a7a,' + C.redBall + ')'
    : 'linear-gradient(145deg,#5b8dff,' + C.blueBall + ')';
  return (
    `<td style="min-width:${d.w}px;height:${d.w}px;line-height:${d.w}px;text-align:center;` +
    `background-color:${base};background-image:${grad};color:#ffffff;border-radius:50%;` +
    `font-size:${d.f}px;font-weight:700;font-family:Georgia,'Times New Roman',serif;">${pad2(n)}</td>`
  );
}

function ballRow(red, blue, clsRed, clsBlue, size, spacing) {
  const gap = spacing == null ? 4 : spacing;
  const sep = `<td style="min-width:12px;text-align:center;color:${C.faint};font-size:12px;vertical-align:middle;">｜</td>`;
  const reds = red.map((n) => ball(n, clsRed, size)).join('');
  const blues = blue.map((n) => ball(n, clsBlue, size)).join('');
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" ` +
    `style="border-collapse:separate;border-spacing:${gap}px;"><tr>${reds}${sep}${blues}</tr></table>`
  );
}

// ---------- 通用块 ----------
function pageWrap(inner, previewText) {
  return (
    `<!DOCTYPE html>` +
    `<html lang="zh-CN"><head><meta charset="UTF-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1.0">` +
    `<title>开运·彩票助手</title></head>` +
    `<body style="margin:0;padding:0;background-color:${C.bgPage};">` +
    (previewText
      ? `<div style="display:none;max-height:0;overflow:hidden;">${esc(previewText)}</div>`
      : '') +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="background-color:${C.bgPage};padding:24px 12px;"><tr><td align="center">` +
    `<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" ` +
    `style="max-width:520px;width:100%;background-color:${C.bgCard};border-radius:16px;overflow:hidden;">` +
    inner +
    `</table></td></tr></table></body></html>`
  );
}

function header(title, subtitle, dateStr) {
  return (
    `<tr><td style="padding:28px 30px 20px;background-color:${C.bgCard};` +
    `background-image:linear-gradient(135deg,#2a1430 0%,${C.bgCard} 55%,#241226 100%);` +
    `border-bottom:2px solid ${C.gold};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="font-family:'Noto Serif SC','Songti SC',serif;font-size:22px;color:${C.text};` +
    `font-weight:700;letter-spacing:1px;">开运<span style="color:${C.gold};">·</span>彩票助手</td>` +
    `<td align="right" style="font-size:12px;color:${C.gold};letter-spacing:2px;">${esc(dateStr)}</td>` +
    `</tr><tr><td colspan="2" style="padding-top:6px;font-size:12px;color:${C.muted};letter-spacing:1px;">` +
    `${esc(title)}${subtitle ? ' · ' + esc(subtitle) : ''}</td></tr></table></td></tr>`
  );
}

function disclaimerFooter(source) {
  return (
    `<tr><td style="padding:18px 30px 26px;background-color:${C.bgFooter};">` +
    `<div style="font-size:11px;color:${C.muted};line-height:1.7;">⚠️ 彩票开奖完全随机，任何策略都无法提高中奖概率。` +
    `号码仅供娱乐参考，请理性购彩、量力而行，未满 18 周岁禁止购彩。</div>` +
    `<div style="padding-top:8px;font-size:11px;color:${C.faint};">开运·彩票助手 ${esc(source || '自动推送')} · 数据以官方公布为准</div>` +
    `</td></tr>`
  );
}

// 彩种元信息（与 gen-picks.js META 一致；red/blue 的球色按站点约定：
// 双色球 红=red 蓝=blue；大乐透 前区=blue 后区=red）
const GAME = {
  ssq: {
    name: '双色球', icon: '🎱', redLabel: '红球', blueLabel: '蓝球',
    redCls: 'red', blueCls: 'blue', rule: '红球 33 选 6 ｜ 蓝球 16 选 1',
  },
  dlt: {
    name: '大乐透', icon: '🏐', redLabel: '前区', blueLabel: '后区',
    redCls: 'blue', blueCls: 'red', rule: '前区 35 选 5 ｜ 后区 12 选 2',
  },
};

// 一注号码行（推送邮件用）：左侧“第 N 注” + 球行
function pickRow(idx, pick, game) {
  const g = GAME[game];
  return (
    `<tr><td style="padding:2px 30px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="background-color:${C.rowBg};border-radius:12px;"><tr>` +
    `<td style="padding:12px 14px;width:52px;font-size:12px;color:${C.muted};vertical-align:middle;">第 ${idx} 注</td>` +
    `<td style="padding:12px 0;vertical-align:middle;">${ballRow(pick.red, pick.blue, g.redCls, g.blueCls, 'md')}</td>` +
    `</tr></table></td></tr>`
  );
}

// 彩种标题行
function gameHead(game) {
  const g = GAME[game];
  return (
    `<tr><td style="padding:20px 30px 8px;${game === 'dlt' ? 'border-top:1px solid ' + C.lineGold + ';' : ''}">` +
    `<span style="font-size:17px;color:${C.goldBright};font-weight:700;font-family:'Noto Serif SC','Songti SC',serif;">` +
    `${g.icon} ${g.name}</span>` +
    `<span style="font-size:12px;color:${C.muted};">　${g.rule}</span></td></tr>`
  );
}

module.exports = { C, GAME, esc, pad2, ball, ballRow, pickRow, gameHead, header, pageWrap, disclaimerFooter };
