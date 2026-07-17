/* 云端可访问的开奖数据源：gudaoxuri/lottery_history（raw.githubusercontent.com）
   GitHub Actions 境外服务器可稳定访问（中彩网/500 会 403）。
   归一化为 { issue, drawDate, red:[], blue:[] }，按 drawDate 升序返回。 */
'use strict';

const https = require('https');

const SOURCES = {
  ssq: 'https://raw.githubusercontent.com/gudaoxuri/lottery_history/main/data/ssq.json',
  dlt: 'https://raw.githubusercontent.com/gudaoxuri/lottery_history/main/data/dlt.json',
};

function get(url) {
  return new Promise((resolve, reject) => {
    https
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
function firstDrawOnOrAfter(results, dateStr) {
  for (const r of results) {
    if (r.drawDate >= dateStr) return r;
  }
  return null;
}

module.exports = { fetchResults, firstDrawOnOrAfter, normalize, SOURCES };
