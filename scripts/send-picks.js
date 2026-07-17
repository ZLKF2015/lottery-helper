/* 读取配置 -> 生成机选号码 -> 通过 SMTP 发送推送邮件
   配置优先级：环境变量 SMTP_*（GitHub Actions Secrets） > scripts/mail-config.json（本地）
   直接运行：node scripts/send-picks.js
   未配置授权码时安全跳过，不发送、不报错退出。 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildEmailBody } = require('./gen-picks');

const CONFIG_PATH = path.join(__dirname, 'mail-config.json');

// 优先环境变量（云端 Secrets），缺省回退到本地配置文件，保证「仓库零密钥」
function loadConfig() {
  const env = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    to: process.env.SMTP_TO,
    from: process.env.SMTP_FROM,
  };
  let file = null;
  if (fs.existsSync(CONFIG_PATH)) {
    try { file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { file = null; }
  }
  return {
    host: env.host || (file && file.host) || 'smtp.qq.com',
    port: env.port || (file && file.port) || 465,
    user: env.user || (file && file.user),
    pass: env.pass || (file && file.pass),
    to: env.to || (file && file.to),
    from: env.from || (file && file.from) || env.user || (file && file.user),
  };
}

async function main() {
  const cfg = loadConfig();
  const missing =
    !cfg.pass ||
    !cfg.user ||
    !cfg.to ||
    String(cfg.pass).includes('请替换') ||
    String(cfg.pass).length < 8;
  if (missing) {
    console.log('[跳过] 未提供 SMTP 授权码（环境变量 SMTP_PASS 或 scripts/mail-config.json 的 pass）。未发送邮件。');
    process.exit(0);
  }

  const nodemailer = require('nodemailer');
  const email = buildEmailBody();
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  await transporter.sendMail({
    from: cfg.from || cfg.user,
    to: cfg.to,
    subject: email.subject,
    text: email.text,
  });
  console.log('已发送推送邮件至', cfg.to, '->', email.subject);
}

main().catch((e) => {
  console.error('发送失败:', e.message);
  process.exit(1);
});
