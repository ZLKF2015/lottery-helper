const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.eval(fs.readFileSync(path.join(root, 'data.js'), 'utf8'));
const baseDlt = JSON.parse(JSON.stringify(window.LOTTERY_DATA.dlt));
// stub fetch to return a "newer" dlt record on top
window.fetch = (url) => {
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve(
        url.includes('type=dlt')
          ? [{ issue: '26077', date: '2026-07-11', front: [1, 2, 3, 4, 5], back: [6, 7], pool: 1, sales: 1 }, ...baseDlt]
          : window.LOTTERY_DATA.ssq
      ),
  });
};
window.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
const d = window.document;
const check = (n, c, e) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? ' -> ' + e : ''}`);

setTimeout(() => {
  check('liveStamp updated', d.getElementById('liveStamp').textContent.includes('实时数据已更新'), d.getElementById('liveStamp').textContent);
  check('dlt data replaced with newer issue', window.LOTTERY_DATA.dlt[0].issue === '26077', window.LOTTERY_DATA.dlt[0].issue);
  // switch to dlt and confirm hero shows new issue
  d.querySelector('#typeSwitch button[data-type=dlt]').click();
  check('hero shows live dlt issue', d.querySelector('.hero .issue').textContent.includes('26077'), d.querySelector('.hero .issue').textContent);
  check('banner no longer says 演示数据', !d.getElementById('banner').textContent.includes('演示数据'));
  check('banner mentions 官方', d.getElementById('banner').textContent.includes('官方'));
}, 300);
