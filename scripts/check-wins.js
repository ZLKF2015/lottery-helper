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

  if (newWins.length > 0) {
    if (!isConfigured()) {
      console.log('[提示] 检测到中奖，但 SMTP 未配置，无法发送中奖邮件。');
    } else {
      const email = buildWinEmail(newWins);
      await sendMail({ subject: email.subject, text: email.text });
      console.log('已发送中奖提醒邮件 ->', email.subject);
    }
  } else {
    console.log('本次核对没有中奖。');
  }
}

module.exports = { checkType, buildWinEmail, main };

if (require.main === module) {
  main().catch((e) => {
    console.error('核对失败:', e.message);
    process.exit(1);
  });
}
