/* ============================================================
   开运 · 彩票助手  —  本地静态服务 + 实时数据代理
   - 提供静态文件（index.html 等）
   - /api/results?type=ssq|dlt  -> 实时抓取官方开奖，带 1 小时磁盘缓存
   浏览器通过同源 /api 拿到实时数据（绕开 CORS）；
   直接以 file:// 打开 index.html 时则回退到内置 data.js。
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { fetchSSQ, fetchDLT } = require('./scripts/fetch-lib');

const ROOT = __dirname;
const PORT = process.env.PORT || 8000;
const CACHE_DIR = path.join(ROOT, 'cache');
const CACHE_TTL = 60 * 60 * 1000; // 1 小时
fs.mkdirSync(CACHE_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function getLive(type) {
  const file = path.join(CACHE_DIR, type + '.json');
  try {
    const st = fs.statSync(file);
    if (Date.now() - st.mtimeMs < CACHE_TTL) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (_) {}
  const data = type === 'ssq' ? await fetchSSQ(400) : await fetchDLT('25001');
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // ---- API ----
  if (url.pathname === '/api/results') {
    const type = url.searchParams.get('type');
    if (type !== 'ssq' && type !== 'dlt') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'type must be ssq or dlt' }));
      return;
    }
    try {
      const data = await getLive(type);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  // ---- 静态文件 ----
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const filePath = path.join(ROOT, p);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`开运·彩票助手已启动: http://127.0.0.1:${PORT}/`);
  console.log('实时数据接口: /api/results?type=ssq  /  /api/results?type=dlt');
});
