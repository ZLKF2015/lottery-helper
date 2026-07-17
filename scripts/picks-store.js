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
  try {
    const obj = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!obj || !Array.isArray(obj.records)) return { records: [] };
    return obj;
  } catch {
    return { records: [] };
  }
}

function save(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2) + '\n', 'utf8');
}

// 追加一条当日推荐记录（picks: { ssq:[...], dlt:[...] }）
function appendRecord(picks, dateStr) {
  const store = load();
  const date = dateStr || beijingDate();
  const rec = {
    id: `${date}-${Date.now().toString(36)}`,
    date,
    ts: new Date().toISOString(),
    ssq: picks.ssq || [],
    dlt: picks.dlt || [],
    checked: false,
    result: null,
  };
  store.records.push(rec);
  save(store);
  return rec;
}

module.exports = { STORE_PATH, load, save, appendRecord, beijingDate };
