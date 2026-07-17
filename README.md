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

## 自动开奖核对 + 中奖提醒

推送的号码会被**保存到仓库根目录的 `picks-history.json`**；之后每天自动去核对是否中奖：

- 发送推荐邮件后，`send-picks.js` 会把当天 5 注双色球 + 5 注大乐透追加进 `picks-history.json`（`checked:false`）。
- 每天北京时间 **23:30**，`check-wins.js` 拉取最新开奖号码，为每条未核对记录匹配「推荐日之后的首次开奖」，逐注判定中奖等级；
  - **只要有任一注中奖，就发一封中奖提醒邮件**（写明彩种、期号、开奖号、命中数与等级）；
  - 核对完成的记录标记 `checked:true`，结果写回 `picks-history.json` 并提交回仓库；
  - 若对应期次尚未开奖，则保留记录、下次继续核对。
- 开奖数据源为 `gudaoxuri/lottery_history`（`raw.githubusercontent.com`），GitHub Actions 境外服务器可稳定访问（中彩网/500 会 403）。

```bash
# 本地手动核对一次
node scripts/check-wins.js
# 全链路自测（不发邮件、不改存储）
node scripts/test-wins.js
```

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
picks-history.json  # 每日推荐号码 + 开奖核对结果（云端 Actions 自动维护）
scripts/
  fetch-lib.js      # 官方数据抓取库（中彩网 / 500）
  fetch-official.js # 重新生成 data.js
  gen-picks.js      # 机选号码生成器
  prize.js          # 中奖等级判定（与前端 app.js 一致）
  mailer.js         # 共享 SMTP 配置读取与发信
  picks-store.js    # picks-history.json 读写
  send-picks.js     # 发送推送邮件 + 保存推荐号码
  results-lib.js    # 云端可访问的开奖数据源
  check-wins.js     # 开奖核对 + 中奖发邮件
  test-wins.js      # 全链路自测
.github/workflows/daily.yml       # 每日推送 + 保存号码（北京 20:00）
.github/workflows/check-wins.yml  # 每日开奖核对 + 中奖提醒（北京 23:30）
```

## 理性购彩

彩票开奖完全随机，任何走势、频率、策略都**不能预测**未来结果，也无法提高中奖概率。本项目的「智能选号」「邮件推送」仅作娱乐参考，请量力而行、理性购彩，未满 18 周岁禁止购彩。
