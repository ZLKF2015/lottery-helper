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
const inp = d.getElementById('searchInput');
function search(q, field) {
  d.getElementById('searchField').value = field || 'all';
  inp.value = q;
  inp.dispatchEvent(new window.Event('input'));
  return d.querySelectorAll('.result-row').length;
}
console.log('ssq search 2026077 (all):', search('2026077'));
console.log('ssq search 2026-07 (date):', search('2026-07', 'date'));
console.log('ssq search 999999 (none):', search('999999'));
// switch to dlt
d.querySelector('#typeSwitch button[data-type=dlt]').click();
console.log('dlt search 26076 (all):', search('26076'));
console.log('dlt search 2026-07 (date):', search('2026-07', 'date'));
