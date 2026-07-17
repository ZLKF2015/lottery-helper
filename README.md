# 开运·彩票助手

双色球 / 大乐透 开奖查询、历史走势、统计分析、中奖核对、智能选号，外加**每日机选号码邮件推送**。

数据来源：双色球来自中国福利彩票官网（中彩网），大乐透来自 500彩票历史表（体彩网官方接口有反爬，以 500 作稳定镜像）。均为官方真实开奖号码。

## 本地运行（含实时接口）

```bash
# 1) 安装依赖（只需 nodemailer，用于邮件推送；普通查看站点的话可跳过）
npm install

# 2) 启动本地服务（静态站点 + 同源 /api 实时代理，自带 1 小时缓存）
node server.js
# 打开 http://127.0.0.1:8000/

# 3) 手动刷新官方开奖数据到 data.js
node scripts/fetch-official.js
```

也可以直接用浏览器打开 `index.html`——会自动回退到内置的 `data.js`（真实数据）。

## 每日邮件推送

- 本地：`node scripts/send-picks.js`（需先在 `scripts/mail-config.json` 填好 QQ 邮箱 SMTP 授权码）。
- 云端：见下方「部署到 GitHub」。

## 部署到 GitHub（电脑关机也能收推送）

把本仓库推到 GitHub 后：

1. **设置邮件密钥**：仓库 `Settings → Secrets and variables → Actions → New repository secret`，名称 `SMTP_PASS`，值填你的 **QQ 邮箱 SMTP 授权码**。
   > 授权码 ≠ 邮箱密码。获取：QQ邮箱网页版 → 设置 → 账户 → 开启「POP3/SMTP服务」→ 生成授权码。
2. **就这些**。GitHub Actions 会每天北京时间 20:00 自动向 `951038180@qq.com` 发送 5 注双色球 + 5 注大乐透。

> 发件/收件地址写在 `.github/workflows/daily.yml` 的 `env` 里，如需改收件人直接改那一行即可。
> 注意：GitHub 会在仓库 60 天无活动后暂停定时任务，届时随便推一次 commit 即可恢复。

### 两个限制说明

- **网站在线托管（Pages）**：免费计划的 GitHub Pages 只支持**公开仓库**。若你想让网站有个在线地址（`https://<用户名>.github.io/<仓库名>/`），把仓库改成 Public 后到 `Settings → Pages` 开启即可（本项目代码不含任何密钥，公开是安全的）。私有仓库则无法用免费 Pages，网站仍可在本地 `node server.js` 查看。
- **云端数据刷新**：`fetch-official.js` 依赖中彩网/500彩票，仅国内 IP 可访问，GitHub 境外服务器会被反爬（403）。因此**开奖数据的每日刷新不在云端进行**，交给本机的定时任务；而**机选邮件为纯随机、不依赖开奖数据**，云端可正常发送。

## 文件结构

```
index.html          # 前端页面
app.js / styles.css # 前端逻辑与样式
data.js             # 开奖数据（由 fetch-official.js 生成，真实号码）
server.js           # 本地静态服务 + 实时代理（仅本地用）
scripts/
  fetch-lib.js      # 官方数据抓取库（中彩网 / 500）
  fetch-official.js # 重新生成 data.js
  gen-picks.js      # 机选号码生成器
  send-picks.js     # SMTP 发送推送邮件（支持环境变量 Secrets）
.github/workflows/daily.yml  # 每日自动任务
```

## 理性购彩

彩票开奖完全随机，任何走势、频率、策略都**不能预测**未来结果，也无法提高中奖概率。本项目的「智能选号」「邮件推送」仅作娱乐参考，请量力而行、理性购彩，未满 18 周岁禁止购彩。
