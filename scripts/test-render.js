const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
const errs = [];
window.addEventListener('error', (e) => errs.push(e.message));

const dataCode = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const appCode = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

try {
  window.eval(dataCode);
  window.eval(appCode);
} catch (e) {
  console.error('RUNTIME ERROR:', e.message);
  process.exit(1);
}

const d = window.document;
const check = (name, cond, extra) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' -> ' + extra : ''}`);

check('data loaded', !!window.LOTTERY_DATA);
check('hero issue rendered', !!d.querySelector('.hero .issue'), d.querySelector('.hero .issue') && d.querySelector('.hero .issue').textContent);
check('hero red balls = 6', d.querySelectorAll('.hero .balls .ball.red').length === 6);
check('hero blue balls = 1 (ssq)', d.querySelectorAll('.hero .balls .ball.blue').length === 1);
check('result rows rendered', d.querySelectorAll('.result-row').length > 100, d.querySelectorAll('.result-row').length);
check('hot chips rendered', d.querySelectorAll('#hotChips .chip').length === 8);
check('freq red rows = 33', d.querySelectorAll('#freqRed .frow').length === 33, d.querySelectorAll('#freqRed .frow').length);
check('freq blue rows = 16', d.querySelectorAll('#freqBlue .frow').length === 16, d.querySelectorAll('#freqBlue .frow').length);
check('trend svg paths', d.querySelectorAll('#trendSvg path').length >= 2);
check('summary items', d.querySelectorAll('#summary .s').length === 4);

// 智能选号
window.document.getElementById('pickBtn').click();
check('pick items generated', d.querySelectorAll('.pick-item').length === 5, d.querySelectorAll('.pick-item').length);

// 冷号策略
window.document.querySelector('#strategyOpts button[data-strategy=cold]').click();
window.document.getElementById('pickBtn').click();
check('cold strategy pick ok', d.querySelectorAll('.pick-item').length >= 1);

// 切换大乐透
window.document.querySelector('#typeSwitch button[data-type=dlt]').click();
check('dlt hero issue', !!d.querySelector('.hero .issue'), d.querySelector('.hero .issue') && d.querySelector('.hero .issue').textContent);
check('dlt front balls = 5', d.querySelectorAll('.hero .balls .ball.blue').length === 5, d.querySelectorAll('.hero .balls .ball.blue').length);
check('dlt back balls = 2', d.querySelectorAll('.hero .balls .ball.red').length === 2, d.querySelectorAll('.hero .balls .ball.red').length);
check('dlt freq front = 35', d.querySelectorAll('#freqRed .frow').length === 35, d.querySelectorAll('#freqRed .frow').length);

// 查询筛选
window.document.querySelector('#tabs button[data-tab=query]').click();
const inp = window.document.getElementById('searchInput');
inp.value = '2026077';
inp.dispatchEvent(new window.Event('input'));
check('search filters to 1', d.querySelectorAll('.result-row').length === 1, d.querySelectorAll('.result-row').length);

console.log(errs.length ? 'WINDOW ERRORS: ' + errs.join('; ') : 'No window errors.');
console.log('DONE');
