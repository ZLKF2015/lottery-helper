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
const check = (n, c, e) => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? ' -> ' + e : ''}`);

// 切到中奖核对 tab
d.querySelector('#tabs button[data-tab="check"]').click();
check('check panel active', d.getElementById('panel-check').classList.contains('active'));

// ---- SSQ: 用最新一期构造一注，应命中一等奖 ----
const ssq = window.LOTTERY_DATA.ssq[0];
const ssqTicket = `${ssq.red.join(',')} ${ssq.blue.join(',')}`;
d.getElementById('checkRedInput').value = ssqTicket;
d.getElementById('checkBtn').click();
check('ssq: 命中汇总显示', /命中/.test(d.getElementById('checkResult').textContent), d.querySelector('#checkResult .check-summary') ? d.querySelector('#checkResult .check-summary').textContent.trim() : 'none');
check('ssq: 出现一等奖徽章', [...d.querySelectorAll('.tier-badge')].some(b => b.textContent.includes('一等奖')));
check('ssq: 命中球高亮(hit)', d.querySelectorAll('.ball.hit').length > 0, 'hit=' + d.querySelectorAll('.ball.hit').length);
check('ssq: 显示单注奖金', /元（/.test(d.getElementById('checkResult').textContent));

// ---- 非法输入提示 ----
d.getElementById('checkRedInput').value = '1,2,3 4';
d.getElementById('checkBtn').click();
check('ssq: 非法注数报错', d.getElementById('checkErr').textContent.includes('红球需 6'), d.getElementById('checkErr').textContent);

// ---- DLT ----
d.querySelector('#typeSwitch button[data-type=dlt]').click();
const dlt = window.LOTTERY_DATA.dlt[0];
const dltTicket = `${dlt.front.join(',')} ${dlt.back.join(',')}`;
d.getElementById('checkRedInput').value = dltTicket;
d.getElementById('checkBtn').click();
check('dlt: 命中一等奖', [...d.querySelectorAll('.tier-badge')].some(b => b.textContent.includes('一等奖')));
check('dlt: 标签为前区/后区', d.getElementById('checkRedLabel').textContent.includes('前区'));

// ---- 多注 + 全不中（切回 SSQ 用合法格式）----
d.querySelector('#typeSwitch button[data-type=ssq]').click();
d.getElementById('checkRedInput').value = '1,2,3,4,5,6 7\n7,8,9,10,11,12 13';
d.getElementById('checkBtn').click();
check('多注: 两张票块', d.querySelectorAll('.ticket-block').length === 2, 'blocks=' + d.querySelectorAll('.ticket-block').length);
