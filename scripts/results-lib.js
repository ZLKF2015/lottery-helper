/* 云端可访问的开奖数据源：gudaoxuri/lottery_history（raw.githubusercontent.com）
   GitHub Actions 境外服务器可稳定访问（中彩网/500 会 403）。
   归一化为 { issue, drawDate, red:[], blue:[] }，按 drawDate 升序返回。 */
'use strict';

const https = require('https');

const SOURCES = {
  ssq: 'https://raw.githubusercontent.com/gudaoxuri/lottery_history/main/data/ssq.json',
  dlt: 'https://raw.githubusercontent.com/gudaoxuri/lottery_history/main/data/dlt.json',
};

const REQUEST_TIMEOUT_MS = 15000;

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https
      .get(url, { headers: { 'User-Agent': 'lottery-helper' } }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} @ ${url}`));
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
    // 超时保护：避免 Actions 里网络挂起拖到 6 小时 job 上限
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`请求超时（${REQUEST_TIMEOUT_MS}ms）@ ${url}`));
    });
  });
}

function normalize(type, arr) {
  const out = arr.map((r) => {
    if (type === 'ssq') {
      return {
        issue: String(r.issueNumber),
        drawDate: r.drawDate,
        red: (r.redBalls || []).map(Number),
        blue: [Number(r.blueBall)],
      };
    }
    return {
      issue: String(r.issueNumber),
      drawDate: r.drawDate,
      red: (r.frontBalls || []).map(Number),
      blue: (r.backBalls || []).map(Number),
    };
  });
  // 升序（drawDate 早 -> 晚）
  out.sort((a, b) => (a.drawDate < b.drawDate ? -1 : a.drawDate > b.drawDate ? 1 : 0));
  return out;
}

// 返回 { ssq:[...], dlt:[...] }（均升序）
async function fetchResults() {
  const [ssqRaw, dltRaw] = await Promise.all([get(SOURCES.ssq), get(SOURCES.dlt)]);
  return {
    ssq: normalize('ssq', JSON.parse(ssqRaw)),
    dlt: normalize('dlt', JSON.parse(dltRaw)),
  };
}

// 找出 drawDate >= 推荐日期 的最早一期（即该次推荐之后的首次开奖）
// 断期护栏：若匹配到的开奖比推荐日晚超过 GAP_LIMIT_DAYS 天，说明上游数据可能缺期，
// 此时返回 null 留待下次核对（绝不把记录错误地判到远晚的期次上）。
const GAP_LIMIT_DAYS = 10;

function daysBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

function firstDrawOnOrAfter(results, dateStr) {
  for (const r of results) {
    if (r.drawDate >= dateStr) {
      if (daysBetween(dateStr, r.drawDate) > GAP_LIMIT_DAYS) return null; // 疑似上游断期
      return r;
    }
  }
  return null;
}

module.exports = { fetchResults, firstDrawOnOrAfter, normalize, SOURCES };
