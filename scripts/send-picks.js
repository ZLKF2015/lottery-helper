/* 生成机选号码 -> 通过 SMTP 发送推送邮件 -> 落盘保存推荐号码（供日后开奖核对）
   配置优先级：环境变量 SMTP_*（GitHub Actions Secrets） > scripts/mail-config.json（本地）
   直接运行：node scripts/send-picks.js
   未配置授权码时安全跳过，不发送、不报错退出。 */
'use strict';

const { buildEmailBody } = require('./gen-picks');
const { isConfigured, sendMail } = require('./mailer');
const { appendRecord } = require('./picks-store');

async function main() {
  if (!isConfigured()) {
    console.log('[跳过] 未提供 SMTP 授权码（环境变量 SMTP_PASS 或 scripts/mail-config.json 的 pass）。未发送邮件。');
    process.exit(0);
  }

  const email = buildEmailBody();
  await sendMail({ subject: email.subject, text: email.text });
  console.log('已发送推送邮件 ->', email.subject);

  // 发送成功后，保存本次推荐号码，供开奖后核对
  const rec = appendRecord(email.picks);
  console.log(`已保存推荐记录 ${rec.id}（双色球 ${rec.ssq.length} 注 + 大乐透 ${rec.dlt.length} 注）到 picks-history.json`);
}

main().catch((e) => {
  console.error('发送失败:', e.message);
  process.exit(1);
});
