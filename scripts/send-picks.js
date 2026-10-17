/* 生成机选号码 -> 先落盘保存推荐号码（sent:false）-> 通过 SMTP 发送推送邮件 -> 发送成功后置 sent:true
   配置优先级：环境变量 SMTP_*（GitHub Actions Secrets） > scripts/mail-config.json（本地）
   直接运行：node scripts/send-picks.js
   未配置授权码时安全跳过，不发送、不报错退出。
   顺序说明：先落盘再发信——即使发信失败，号码也已保存，开奖后仍会正常核对。 */
'use strict';

const { buildEmailBody } = require('./gen-picks');
const { isConfigured, sendMail } = require('./mailer');
const { appendRecord, markSent } = require('./picks-store');
const { fetchResults } = require('./results-lib');

// 尽力获取最新开奖（供邮件「上期开奖」区块）：失败返回空对象，绝不阻塞推送
async function tryFetchLatest() {
  try {
    const results = await fetchResults();
    const ssq = results.ssq[results.ssq.length - 1] || null;
    const dlt = results.dlt[results.dlt.length - 1] || null;
    return { ssq, dlt };
  } catch (e) {
    console.log(`[提示] 上期开奖数据获取失败（不影响推送）：${e.message}`);
    return {};
  }
}

async function main() {
  if (!isConfigured()) {
    console.log('[跳过] 未提供 SMTP 授权码（环境变量 SMTP_PASS 或 scripts/mail-config.json 的 pass）。未发送邮件。');
    process.exit(0);
  }

  const latest = await tryFetchLatest();
  const email = buildEmailBody(latest);

  // 先落盘（sent:false），确保邮件里的号码一定有核对资格
  const rec = appendRecord(email.picks);
  console.log(`已保存推荐记录 ${rec.id}（双色球 ${rec.ssq.length} 注 + 大乐透 ${rec.dlt.length} 注）到 picks-history.json`);

  await sendMail({ subject: email.subject, text: email.text, html: email.html });
  markSent(rec);
  console.log('已发送推送邮件 ->', email.subject);
}

main().catch((e) => {
  console.error('发送失败:', e.message);
  process.exit(1);
});
