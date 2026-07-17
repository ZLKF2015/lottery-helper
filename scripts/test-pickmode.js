const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.eval(fs.readFileSync(path.join(root, 'data.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
const d = window.document;
const check = (n, c, e) => console.log((c ? 'PASS' : 'FAIL') + '  ' + n + (e ? ' -> ' + e : ''));

check('pickModeSwitch has 2 buttons', d.querySelectorAll('#pickModeSwitch button').length === 2);
check('initial label mentions 双色球', d.getElementById('pickModeLabel').textContent.includes('双色球'), d.getElementById('pickModeLabel').textContent.slice(0, 40));
d.getElementById('pickBtn').click();
check('pick has group labels', d.querySelectorAll('.pick-item .grp').length >= 2, String(d.querySelectorAll('.pick-item .grp').length));

// 点击智能选号里的 体彩·大乐透
d.querySelector('#pickModeSwitch button[data-type=dlt]').click();
check('label now 大乐透', d.getElementById('pickModeLabel').textContent.includes('大乐透'), d.getElementById('pickModeLabel').textContent.slice(0, 40));
check('hero switched to dlt', d.querySelector('.hero .issue').textContent.includes('26076'), d.querySelector('.hero .issue').textContent);
check('global typeSwitch synced to dlt', d.querySelector('#typeSwitch button[data-type=dlt]').classList.contains('active'));
d.getElementById('pickBtn').click();
check('dlt pick front=5 back=2',
  d.querySelectorAll('.pick-item .pballs .ball.blue').length === 5 && d.querySelectorAll('.pick-item .pballs .ball.red').length === 2,
  'blue=' + d.querySelectorAll('.pick-item .pballs .ball.blue').length + ' red=' + d.querySelectorAll('.pick-item .pballs .ball.red').length);
check('grp labels show 前区/后区',
  [...d.querySelectorAll('.pick-item .grp')].some((g) => g.textContent === '前区') &&
  [...d.querySelectorAll('.pick-item .grp')].some((g) => g.textContent === '后区'));

// 切回 双色球 via global switch
d.querySelector('#typeSwitch button[data-type=ssq]').click();
check('pickModeSwitch synced back to ssq', d.querySelector('#pickModeSwitch button[data-type=ssq]').classList.contains('active'));
check('label back to 双色球', d.getElementById('pickModeLabel').textContent.includes('双色球'));
