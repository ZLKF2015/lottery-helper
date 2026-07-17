/* 共享邮件模块：读取 SMTP 配置并发送邮件
   配置优先级：环境变量 SMTP_*（GitHub Actions Secrets） > scripts/mail-config.json（本地）
   仓库零密钥：云端用 Secrets，本地用 mail-config.json（已 gitignore）。 */
'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'mail-config.json');

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

// 配置是否可用（授权码等齐全）
function isConfigured(cfg) {
  cfg = cfg || loadConfig();
  return !(
    !cfg.pass ||
    !cfg.user ||
    !cfg.to ||
    String(cfg.pass).includes('请替换') ||
    String(cfg.pass).length < 8
  );
}

// 发送邮件：{ subject, text, to? }。未配置时抛错，由调用方决定是否跳过。
async function sendMail({ subject, text, to }) {
  const cfg = loadConfig();
  if (!isConfigured(cfg)) throw new Error('SMTP 未配置（缺少授权码/账号/收件人）');
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  await transporter.sendMail({
    from: cfg.from || cfg.user,
    to: to || cfg.to,
    subject,
    text,
  });
  return { to: to || cfg.to, subject };
}

module.exports = { loadConfig, isConfigured, sendMail, CONFIG_PATH };
