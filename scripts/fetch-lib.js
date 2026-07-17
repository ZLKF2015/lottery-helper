/* ============================================================
   官方彩票数据抓取库
   - 双色球 (ssq): 中国福利彩票官网 中彩网 公开接口
   - 大乐透 (dlt): 500彩票 历史开奖表（体彩网官方接口有反爬，500 作为稳定镜像）
   返回记录均为「最新在前」顺序，字段与 data.js / app.js 约定一致。
   ============================================================ */
'use strict';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function getJSON(url, headers) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function getText(url, headers) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// ---------- 双色球：中彩网官方接口 ----------
async function fetchSSQ(count = 400) {
  const url =
    `https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=${count}`;
  const j = await getJSON(url, { Referer: 'https://www.cwl.gov.cn/' });
  if (j.state !== 0) throw new Error('中彩网返回错误: ' + j.message);
  return j.result.map((r) => ({
    issue: String(r.code),
    date: String(r.date).replace(/\(.*\)$/, ''),
    red: String(r.red).split(',').map(Number),
    blue: String(r.blue || '').split(',').filter(Boolean).map(Number),
    sales: Number(r.sales || 0),
    pool: Number(r.poolmoney || 0),
    prize: (r.prizegrades || [])
      .filter((g) => g && g.type)
      .map((g) => ({
        tier: Number(g.type),
        count: Number(g.typenum || 0),
        amount: Number(g.typemoney || 0),
      })),
  }));
}

// ---------- 大乐透：500彩票历史表 ----------
async function fetchDLT(startIssue = '25001') {
  const url =
    `https://datachart.500.com/dlt/history/newinc/history.php?start=${startIssue}&end=99299`;
  const html = await getText(url, {});
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  const recs = [];
  for (const r of rows) {
    const cells = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').trim()
    );
    if (!/^\d{5}$/.test(cells[1] || '')) continue; // 仅取数据行
    const front = cells.slice(2, 7).map(Number);
    const back = cells.slice(7, 9).map(Number);
    if (front.length !== 5 || back.length !== 2) continue;
    recs.push({
      issue: cells[1],
      date: cells[15] || '',
      front,
      back,
      pool: Number((cells[9] || '').replace(/,/g, '')),
      sales: Number((cells[14] || '').replace(/,/g, '')),
      prize: [
        { tier: 1, count: Number(cells[10] || 0), amount: Number((cells[11] || '').replace(/,/g, '')) },
        { tier: 2, count: Number(cells[12] || 0), amount: Number((cells[13] || '').replace(/,/g, '')) },
      ],
    });
  }
  if (!recs.length) throw new Error('500彩票未解析到大乐透数据');
  return recs;
}

module.exports = { fetchSSQ, fetchDLT, UA };
