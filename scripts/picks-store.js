/* 推荐号码历史存储：仓库根目录 picks-history.json
   结构：{ records: [ { id, date, ts, ssq:[{red,blue}...], dlt:[{red,blue}...], checked:false, result } ] }
   - date：推荐日期 YYYY-MM-DD（北京时区）
   - checked：是否已完成开奖核对
   - result：核对后写入 { ssq:{issue,drawDate,wins:[...]}, dlt:{...} } */
'use strict';

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'picks-history.json');

// 北京时间日期字符串 YYYY-MM-DD
function beijingDate(d) {
  const t = d ? new Date(d) : new Date();
  // 转北京时间（UTC+8）
  const bj = new Date(t.getTime() + 8 * 3600 * 1000);
  return bj.toISOString().slice(0, 10);
}

function load() {
  if (!fs.existsSync(STORE_PATH)) return { records: [] };
  let obj;
  try {
    obj = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch (e) {
    // 历史数据必须保住：先把损坏文件备份（供人工修复），再抛错让调用方/工作流显式失败，
    // 严禁静默返回空 store——否则下一次 save 会覆盖全部历史。
    const backup = `${STORE_PATH}.corrupt-${Date.now()}.bak`;
    try { fs.copyFileSync(STORE_PATH, backup); } catch (_) { /* 备份失败不掩盖原错误 */ }
    throw new Error(`picks-history.json 解析失败（已备份到 ${backup}）：${e.message}`);
  }
  if (!obj || !Array.isArray(obj.records)) {
    throw new Error('picks-history.json 结构异常：缺少 records 数组');
  }
  return obj;
}

function save(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2) + '\n', 'utf8');
}

// 追加一条当日推荐记录（picks: { ssq:[...], dlt:[...] }）
// 默认 sent:false —— 先落盘、发信成功后再由调用方置 true，保证邮件里的号码一定有核对资格
function appendRecord(picks, dateStr) {
  const store = load();
  const date = dateStr || beijingDate();
  const rec = {
    id: `${date}-${Date.now().toString(36)}`,
    date,
    ts: new Date().toISOString(),
    ssq: picks.ssq || [],
    dlt: picks.dlt || [],
    sent: false,
    checked: false,
    result: null,
  };
  store.records.push(rec);
  save(store);
  return rec;
}

// 标记某条记录已成功发送邮件
function markSent(rec) {
  rec.sent = true;
  save(load());
}

module.exports = { STORE_PATH, load, save, appendRecord, markSent, beijingDate };
