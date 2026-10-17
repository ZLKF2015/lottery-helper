/* 开奖核对：读取 picks-history.json 中未核对的推荐号码，
   拉取最新开奖结果，判定每注是否中奖及等级；若有中奖则发邮件通知；
   核对完成后把结果写回、标记 checked，并（在云端由工作流）提交回仓库。

   运行：node scripts/check-wins.js
   数据源：gudaoxuri/lottery_history（raw.githubusercontent.com，云端可访问）。 */
'use strict';

const { load, save } = require('./picks-store');
const { fetchResults, firstDrawOnOrAfter } = require('./results-lib');
const { judge } = require('./prize');
const { isConfigured, sendMail } = require('./mailer');
const T = require('./email-template');

const META = {
  ssq: { name: '双色球', redLabel: '红球', blueLabel: '蓝球' },
  dlt: { name: '大乐透', redLabel: '前区', blueLabel: '后区' },
};

const fmt = (arr) => arr.map((x) => String(x).padStart(2, '0')).join(' ');

// 核对单条记录的某个彩种，返回 { resolved, wins:[] } 或 null（尚未开奖）
function checkType(type, record, results) {
  const draw = firstDrawOnOrAfter(results[type], record.date);
  if (!draw) return null; // 该彩种在推荐日之后尚无开奖
  const wins = [];
  (record[type] || []).forEach((pick, idx) => {
    const j = judge(type, pick, { red: draw.red, blue: draw.blue });
    if (j.tier > 0) {
      wins.push({ idx: idx + 1, tier: j.tier, name: j.name, redMatch: j.redMatch, blueMatch: j.blueMatch, pick });
    }
  });
  return {
    resolved: { issue: draw.issue, drawDate: draw.drawDate, red: draw.red, blue: draw.blue, wins },
    wins,
  };
}

function buildWinEmail(newWins) {
  const lines = [];
  lines.push('好消息！你收到的机选推荐号码中，有号码中奖啦 🎉');
  lines.push('（以下为程序按官方开奖号码自动核对结果，实际兑奖请以官方为准）');
  lines.push('');
  for (const w of newWins) {
    const m = META[w.type];
    lines.push(`====== ${m.name}（第 ${w.draw.issue} 期，开奖日 ${w.draw.drawDate}）======`);
    lines.push(`推荐日期：${w.record.date}`);
    lines.push(`开奖号码：${m.redLabel} ${fmt(w.draw.red)} ｜ ${m.blueLabel} ${fmt(w.draw.blue)}`);
    lines.push('中奖注：');
    for (const win of w.typeWins) {
      lines.push(
        `  · 第 ${win.idx} 注 [${win.name}]  ` +
          `${m.redLabel} ${fmt(win.pick.red)} ｜ ${m.blueLabel} ${fmt(win.pick.blue)}  ` +
          `（命中 ${m.redLabel}${win.redMatch}、${m.blueLabel}${win.blueMatch}）`
      );
    }
    lines.push('');
  }
  lines.push('—— 开运·彩票助手 自动核对推送。理性购彩，量力而行。');
  const totalWins = newWins.reduce((s, w) => s + w.typeWins.length, 0);
  return {
    subject: `🎉 中奖提醒：你的推荐号码中了 ${totalWins} 注！`,
    text: lines.join('\n'),
  };
}

// ---------- HTML 版面（金红夜宴） ----------
// 奖级→固定奖金（用于徽章金额展示；浮动奖一二等不显示金额）
const FIXED_PRIZE = {
  ssq: { 3: '3,000', 4: '200', 5: '10', 6: '5' },
  dlt: { 3: '10,000', 4: '3,000', 5: '300', 6: '200', 7: '100', 8: '15', 9: '5' },
};

function winBadge(type, tier, name) {
  const amount = (FIXED_PRIZE[type] || {})[tier];
  return (
    `<span style="display:inline-block;padding:4px 12px;background-color:${T.C.badgeBg};` +
    `color:${T.C.badgeText};border-radius:20px;font-size:13px;font-weight:700;white-space:nowrap;">` +
    `${T.esc(name)}${amount ? ' ¥' + amount : ''}</span>`
  );
}

// 一个彩种的获奖卡片：draw={issue,drawDate,red,blue}，typeWins=[{idx,name,tier,pick,redMatch,blueMatch}]
function winCard(type, draw, typeWins) {
  const g = T.GAME[type];
  const drawLine =
    `<tr><td style="padding:6px 16px;">` +
    `<span style="font-size:12px;color:${T.C.muted};">开奖号码　</span>` +
    `<span style="font-size:14px;color:${T.C.text};font-weight:700;font-family:Georgia,serif;">` +
    `${draw.red.map(T.pad2).join(' · ')}</span>` +
    `<span style="font-size:14px;color:${g.blueCls === 'red' ? '#ff6a7a' : '#5b8dff'};font-weight:700;font-family:Georgia,serif;">` +
    ` + ${draw.blue.map(T.pad2).join(' · ')}</span></td></tr>`;

  const winRows = typeWins.map((win) => {
    const balls = T.ballRow(win.pick.red, win.pick.blue, g.redCls, g.blueCls, 'sm', 3)
      .replace('<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left"',
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" width="70%"');
    return (
      `<tr><td style="padding:10px 16px 4px;border-top:1px solid ${T.C.lineSoft};">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td style="vertical-align:middle;">${balls}</td>` +
      `<td align="right" style="vertical-align:middle;">${winBadge(type, win.tier, win.name)}</td>` +
      `</tr><tr><td colspan="2" style="padding-top:6px;font-size:11px;color:${T.C.faint};">` +
      `第 ${win.idx} 注 · 命中 ${g.redLabel}${win.redMatch} + ${g.blueLabel}${win.blueMatch}</td></tr>` +
      `</table></td></tr>`
    );
  }).join('');

  return (
    `<tr><td style="padding:12px 26px 5px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="background-color:rgba(233,185,73,0.08);border:1px solid rgba(233,185,73,0.35);border-radius:12px;">` +
    `<tr><td style="padding:14px 16px 4px;">` +
    `<span style="font-size:15px;color:${T.C.goldBright};font-weight:700;">${g.icon} ${g.name} · 第 ${T.esc(draw.issue)} 期</span>` +
    `<span style="float:right;font-size:12px;color:${T.C.muted};">开奖日 ${T.esc(draw.drawDate)}</span>` +
    `</td></tr>` +
    drawLine + winRows +
    `</table></td></tr>`
  );
}

function buildWinEmailHtml(newWins) {
  const totalWins = newWins.reduce((s, w) => s + w.typeWins.length, 0);
  // 合计奖金：只计固定奖级；一二等浮动奖不计入（显示“含浮动奖”）
  let fixedSum = 0;
  let hasFloating = false;
  for (const w of newWins) {
    for (const win of w.typeWins) {
      const amt = (FIXED_PRIZE[w.type] || {})[win.tier];
      if (amt) fixedSum += Number(String(amt).replace(/,/g, ''));
      else hasFloating = true;
    }
  }
  const sumText =
    '合计 ' + (fixedSum > 0 ? `¥${fixedSum.toLocaleString('zh-CN')}` : '奖金以官方派奖为准') +
    (hasFloating ? '（含浮动奖）' : '');

  // 按彩种分组渲染卡片（保持 newWins 的出现顺序）
  const cards = newWins.map((w) => winCard(w.type, w.draw, w.typeWins)).join('');

  const hero =
    `<tr><td style="padding:30px 30px 24px;text-align:center;background-color:${T.C.luckyDeep};` +
    `background-image:linear-gradient(135deg,${T.C.lucky} 0%,${T.C.luckyDeep} 60%,#a01330 100%);">` +
    `<div style="font-size:38px;line-height:1;">🎉</div>` +
    `<div style="padding-top:10px;font-family:'Noto Serif SC','Songti SC',serif;font-size:24px;color:#ffffff;` +
    `font-weight:700;letter-spacing:2px;">恭喜，中奖啦！</div>` +
    `<div style="padding-top:6px;font-size:13px;color:#ffe6a8;">你的机选号码命中 <b style="font-size:16px;">${totalWins}</b> 注 · ${T.esc(sumText)}</div>` +
    `</td></tr>`;

  const tip =
    `<tr><td style="padding:8px 26px 4px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="background-color:${T.C.rowBg};border-radius:10px;"><tr>` +
    `<td style="padding:12px 16px;font-size:12px;color:${T.C.muted};line-height:1.8;">` +
    `💡 <b style="color:${T.C.goldBright};">兑奖提醒</b>：小奖可在全国任意彩票店兑付，` +
    `<b style="color:#ffe6a8;">兑奖期限 60 天</b>，别让奖金过期。以上为程序按官方开奖号码自动核对结果，实际以官方兑奖为准。` +
    `</td></tr></table></td></tr>`;

  const inner =
    hero + cards + tip +
    `<tr><td style="padding:16px 30px 26px;">` +
    `<div style="font-size:11px;color:${T.C.muted};line-height:1.7;">彩票开奖完全随机，本次中奖属于随机运气，不代表任何方法有效。请理性购彩、量力而行。</div>` +
    `<div style="padding-top:8px;font-size:11px;color:${T.C.faint};">开运·彩票助手 自动核对推送</div>` +
    `</td></tr>`;

  return T.pageWrap(inner, `恭喜！你的机选号码中了 ${totalWins} 注 🎉`);
}

async function main() {
  const store = load();
  const pending = store.records.filter((r) => !r.checked);
  if (pending.length === 0) {
    console.log('没有待核对的推荐记录。');
    return;
  }
  console.log(`待核对记录：${pending.length} 条，拉取开奖数据...`);
  const results = await fetchResults();
  console.log(
    `开奖数据：双色球 ${results.ssq.length} 期（最新 ${results.ssq[results.ssq.length - 1]?.issue}），` +
      `大乐透 ${results.dlt.length} 期（最新 ${results.dlt[results.dlt.length - 1]?.issue}）`
  );

  const newWins = []; // 本次运行新判定出的中奖
  let changed = false;

  for (const record of pending) {
    for (const type of ['ssq', 'dlt']) {
      if (record.result && record.result[type]) continue; // 该彩种已核对
      const res = checkType(type, record, results);
      if (!res) continue; // 尚未开奖，留待下次
      record.result = record.result || {};
      record.result[type] = res.resolved;
      changed = true;
      if (res.wins.length > 0) {
        const draw = res.resolved;
        newWins.push({ type, record, draw, typeWins: res.wins });
        console.log(`  ✓ ${record.date} ${META[type].name} 第${draw.issue}期：中奖 ${res.wins.length} 注`);
      } else {
        console.log(`  · ${record.date} ${META[type].name} 第${res.resolved.issue}期：未中奖`);
      }
    }
    // 两个彩种都已核对 -> 标记完成
    if (record.result && record.result.ssq && record.result.dlt) record.checked = true;
  }

  if (changed) {
    save(store);
    console.log('已写回 picks-history.json。');
  } else {
    console.log('本次没有新的开奖可核对。');
  }

  // ---- 中奖提醒（可重试）：收集所有「有中奖但尚未成功通知」的记录（含上轮发送失败的）----
  const toNotify = new Map(); // record -> wins（跨彩种合并到一条记录）
  const collect = (w) => {
    const list = toNotify.get(w.record) || [];
    list.push(w);
    toNotify.set(w.record, list);
  };
  newWins.forEach(collect);
  store.records.forEach((r) => {
    if (r.checked && r.notified !== true) {
      // 上轮已核对且有中奖结果、但从未成功发送提醒的记录，本轮补发
      ['ssq', 'dlt'].forEach((type) => {
        const res = r.result && r.result[type];
        if (res && Array.isArray(res.wins) && res.wins.length > 0) {
          collect({ type, record: r, draw: res, typeWins: res.wins });
        }
      });
    }
  });

  if (toNotify.size === 0) {
    console.log('本次核对没有中奖。');
    return;
  }
  if (!isConfigured()) {
    console.log('[提示] 检测到中奖，但 SMTP 未配置，无法发送中奖邮件。结果已保存，配置后下轮会补发提醒。');
    return;
  }
  const winItems = [...toNotify.entries()].flatMap(([record, wins]) => wins);
  const email = buildWinEmail(winItems);
  email.html = buildWinEmailHtml(winItems);
  try {
    await sendMail({ subject: email.subject, text: email.text, html: email.html });
    toNotify.forEach((_, record) => { record.notified = true; });
    save(store);
    console.log('已发送中奖提醒邮件 ->', email.subject);
  } catch (e) {
    // 发送失败：不标记 notified，下轮运行会自动补发；核对结果已保存不受影响
    console.error(`中奖提醒邮件发送失败（结果已保存，下轮将补发）: ${e.message}`);
    save(store);
    process.exitCode = 1;
  }
}

module.exports = { checkType, buildWinEmail, buildWinEmailHtml, main };

if (require.main === module) {
  main().catch((e) => {
    console.error('核对失败:', e.message);
    process.exit(1);
  });
}
