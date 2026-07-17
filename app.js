/* ============================================================
   开运 · 彩票助手  —  应用逻辑
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.LOTTERY_DATA;
  if (!DATA) {
    document.body.innerHTML = '<p style="color:#fff;padding:40px">数据加载失败：未找到 data.js</p>';
    return;
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  // 球色映射：双色球 红/蓝；大乐透 前区蓝、后区红
  const BALL_CLASS = {
    ssq: { red: 'red', blue: 'blue' },
    dlt: { red: 'blue', blue: 'red' },
  };

  // ---------- 状态 ----------
  const state = {
    type: 'ssq',
    strategy: 'random',
    viewRec: null, // 查询时查看的历史期（null=最新）
  };

  // ---------- 数据访问 ----------
  const list = () => DATA[state.type];
  const meta = () => DATA.meta[state.type];
  const ballCls = () => BALL_CLASS[state.type];
  const isReal = (rec) => list().indexOf(rec) < meta().realCount;

  const redOf = (rec) => (state.type === 'ssq' ? rec.red : rec.front);
  const blueOf = (rec) => (state.type === 'ssq' ? rec.blue : rec.back);

  const ballHTML = (num, cls, small) =>
    `<div class="ball ${cls} ${small ? 'small' : ''}" style="animation-delay:${small ? 0 : Math.random() * 0.3}s">${pad2(num)}</div>`;

  // ---------- 中奖等级规则 ----------
  const TIER_NAMES = {
    ssq: ['', '一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖'],
    dlt: ['', '一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖', '八等奖'],
  };

  // redMatch / blueMatch 对应 双色球 红/蓝，大乐透 前区/后区
  function tierOf(redMatch, blueMatch) {
    if (state.type === 'ssq') {
      if (redMatch === 6 && blueMatch === 1) return 1;
      if (redMatch === 6 && blueMatch === 0) return 2;
      if (redMatch === 5 && blueMatch === 1) return 3;
      if ((redMatch === 5 && blueMatch === 0) || (redMatch === 4 && blueMatch === 1)) return 4;
      if ((redMatch === 4 && blueMatch === 0) || (redMatch === 3 && blueMatch === 1)) return 5;
      if ((redMatch === 2 && blueMatch === 1) || (redMatch === 1 && blueMatch === 1) || (redMatch === 0 && blueMatch === 1)) return 6;
      return 0;
    }
    if (redMatch === 5 && blueMatch === 2) return 1;
    if (redMatch === 5 && blueMatch === 1) return 2;
    if (redMatch === 5 && blueMatch === 0) return 3;
    if (redMatch === 4 && blueMatch === 2) return 4;
    if (redMatch === 4 && blueMatch === 1) return 5;
    if ((redMatch === 3 && blueMatch === 2) || (redMatch === 4 && blueMatch === 0)) return 6;
    if ((redMatch === 3 && blueMatch === 1) || (redMatch === 2 && blueMatch === 2) || (redMatch === 1 && blueMatch === 2)) return 7;
    if ((redMatch === 3 && blueMatch === 0) || (redMatch === 2 && blueMatch === 1) || (redMatch === 1 && blueMatch === 1) || (redMatch === 0 && blueMatch === 2)) return 8;
    return 0;
  }

  const fmtMoney = (n) => Number(n || 0).toLocaleString('zh-CN');

  function validateNums(arr, max, need, label) {
    if (arr.length !== need) return `${label}需 ${need} 个，当前 ${arr.length} 个`;
    if (arr.some((n) => !Number.isInteger(n) || n < 1 || n > max)) return `${label}须为 1-${max} 的整数`;
    if (new Set(arr).size !== arr.length) return `${label}不可重复`;
    return null;
  }

  // ---------- 统计计算（按彩种缓存）----------
  let statsCache = { type: null, data: null };
  function computeStats() {
    if (statsCache.type === state.type) return statsCache.data;
    const m = meta();
    const recs = list();
    const freqRed = Array(m.redMax + 1).fill(0);
    const freqBlue = Array(m.blueMax + 1).fill(0);
    const omitRed = Array(m.redMax + 1).fill(0);
    const omitBlue = Array(m.blueMax + 1).fill(0);
    const seenRed = Array(m.redMax + 1).fill(false);
    const seenBlue = Array(m.blueMax + 1).fill(false);
    const sums = [];

    recs.forEach((rec, i) => {
      const r = redOf(rec);
      const b = blueOf(rec);
      r.forEach((n) => { freqRed[n]++; });
      b.forEach((n) => { freqBlue[n]++; });
      // 遗漏：从最新往回数，未出现过的期数
      for (let n = 1; n <= m.redMax; n++) {
        if (!seenRed[n]) { if (r.includes(n)) { seenRed[n] = true; omitRed[n] = 0; } else { omitRed[n]++; } }
      }
      for (let n = 1; n <= m.blueMax; n++) {
        if (!seenBlue[n]) { if (b.includes(n)) { seenBlue[n] = true; omitBlue[n] = 0; } else { omitBlue[n]++; } }
      }
      if (i < 60) sums.push(r.reduce((s, x) => s + x, 0));
    });

    const maxFreqRed = Math.max(...freqRed.slice(1));
    const maxFreqBlue = Math.max(...freqBlue.slice(1));
    const maxOmitRed = Math.max(...omitRed.slice(1));
    const maxOmitBlue = Math.max(...omitBlue.slice(1));

    // 热号 / 冷号
    const idxArr = (max) => Array.from({ length: max }, (_, i) => i + 1);
    const hotRed = idxArr(m.redMax).sort((a, b) => freqRed[b] - freqRed[a]).slice(0, 8);
    const coldRed = idxArr(m.redMax).sort((a, b) => omitRed[b] - omitRed[a]).slice(0, 8);
    const hotBlue = idxArr(m.blueMax).sort((a, b) => freqBlue[b] - freqBlue[a]).slice(0, 8);
    const coldBlue = idxArr(m.blueMax).sort((a, b) => omitBlue[b] - omitBlue[a]).slice(0, 8);

    const allSums = recs.map((rec) => redOf(rec).reduce((s, x) => s + x, 0));
    const sumAvg = allSums.reduce((s, x) => s + x, 0) / allSums.length;
    const oddRatio = recs.reduce((s, rec) => s + redOf(rec).filter((n) => n % 2).length, 0) /
      (recs.length * m.redCount);

    statsCache = {
      type: state.type,
      data: { freqRed, freqBlue, omitRed, omitBlue, sums, maxFreqRed, maxFreqBlue, maxOmitRed, maxOmitBlue,
        hotRed, coldRed, hotBlue, coldBlue, sumAvg,
        sumMin: Math.min(...allSums), sumMax: Math.max(...allSums), oddRatio, total: recs.length },
    };
    return statsCache.data;
  }

  // ---------- 渲染：HERO ----------
  function renderHero() {
    const rec = state.viewRec || list()[0];
    const m = meta();
    const bc = ballCls();
    const r = redOf(rec), b = blueOf(rec);
    const hero = document.getElementById('hero');
    hero.innerHTML = `
      <div class="label">${m.org} · 最新开奖</div>
      <div class="issue-line">
        <span class="issue">${rec.issue} 期</span>
        <span class="date">${rec.date}</span>
        <span class="tag-real">官方真实</span>
        ${state.viewRec ? '<span class="tag-demo" id="backLatest" style="cursor:pointer">← 返回最新</span>' : ''}
      </div>
      <div class="balls">
        ${r.map((n) => ballHTML(n, bc.red)).join('')}
        <span class="sep"></span>
        ${b.map((n) => ballHTML(n, bc.blue)).join('')}
      </div>
      ${rec.pool ? `<div class="pool">奖池 <b>${(rec.pool / 1e8).toFixed(2)}</b> 亿　·　本期销量 <b>${(rec.sales / 1e8).toFixed(2)}</b> 亿</div>` : ''}
      <div style="margin-top:14px;font-size:13px;color:var(--muted)">
        ${m.redLabel}（${m.redMax} 选 ${m.redCount}）&nbsp;·&nbsp; ${m.blueLabel}（${m.blueMax} 选 ${m.blueCount}）&nbsp;·&nbsp; ${m.drawDays}
      </div>`;
    const back = document.getElementById('backLatest');
    if (back) back.onclick = () => { state.viewRec = null; renderHero(); };
  }

  // ---------- 渲染：查询 ----------
  function renderQuery() {
    const m = meta();
    document.getElementById('queryHint').textContent = `共 ${list().length} 期 · 全部为官方真实开奖记录`;
    renderResultList();
  }

  function renderResultList() {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const field = document.getElementById('searchField').value;
    const bc = ballCls();
    const m = meta();
    let rows = list();
    if (q) {
      rows = rows.filter((rec) => {
        if (field === 'issue') return rec.issue.toLowerCase().includes(q);
        if (field === 'date') return rec.date.toLowerCase().includes(q);
        return rec.issue.toLowerCase().includes(q) || rec.date.toLowerCase().includes(q);
      });
    }
    const box = document.getElementById('resultList');
    if (!rows.length) { box.innerHTML = '<div class="empty">未找到匹配的期号或日期</div>'; return; }
    box.innerHTML = rows.map((rec) => {
      const real = isReal(rec);
      return `<div class="result-row" data-issue="${rec.issue}">
        <span class="ri">${rec.issue}</span>
        <span class="rd">${rec.date}${real ? ' · <span class="real-badge">真实</span>' : ''}</span>
        <span class="rb">
          ${redOf(rec).map((n) => ballHTML(n, bc.red, true)).join('')}
          <span class="sep"></span>
          ${blueOf(rec).map((n) => ballHTML(n, bc.blue, true)).join('')}
        </span>
      </div>`;
    }).join('');
    box.querySelectorAll('.result-row').forEach((el) => {
      el.onclick = () => {
        const rec = list().find((x) => x.issue === el.dataset.issue);
        state.viewRec = rec;
        renderHero();
        document.getElementById('hero').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
  }

  // ---------- 渲染：统计 ----------
  function renderStats() {
    const s = computeStats();
    const m = meta();
    const bc = ballCls();

    document.getElementById('hotTitle').textContent = `${m.redLabel}热号（高频）`;
    document.getElementById('coldTitle').textContent = `${m.redLabel}冷号（长期遗漏）`;
    document.getElementById('freqTitle').textContent = '号码出现频率';

    const chipHTML = (n, cls) => `<span class="chip ${cls}"><span class="n">${pad2(n)}</span></span>`;
    document.getElementById('hotChips').innerHTML = s.hotRed.map((n) => chipHTML(n, 'hot')).join('');
    document.getElementById('coldChips').innerHTML = s.coldRed.map((n) => chipHTML(n, 'cold')).join('');
    // 蓝球热冷附在冷号卡下方说明
    document.getElementById('coldChips').insertAdjacentHTML('beforeend',
      `<span style="font-size:12px;color:var(--faint);width:100%">${m.blueLabel}冷号：${s.coldBlue.map((n) => pad2(n)).join(' / ')}</span>`);

    const freqHTML = (freqArr, maxFreq, cls, max) => {
      let h = '';
      for (let n = 1; n <= max; n++) {
        const v = freqArr[n];
        const pct = maxFreq ? (v / maxFreq) * 100 : 0;
        h += `<div class="frow">
          <div class="fnum ball ${cls}" style="width:26px;height:26px;font-size:12px">${pad2(n)}</div>
          <div class="ftrack"><div class="fbar" style="width:${pct}%"></div></div>
          <div class="fval">${v}</div>
        </div>`;
      }
      return h;
    };
    const m0 = meta();
    document.getElementById('freqRed').innerHTML = freqHTML(s.freqRed, s.maxFreqRed, bc.red, m0.redMax);
    document.getElementById('freqBlue').innerHTML = freqHTML(s.freqBlue, s.maxFreqBlue, bc.blue, m0.blueMax);

    // 走势 SVG
    renderTrend(s.sums);

    // 概览
    document.getElementById('summary').innerHTML = `
      <div class="s"><div class="k">历史期数</div><div class="v">${s.total}</div></div>
      <div class="s"><div class="k">${m.redLabel}平均和值</div><div class="v">${s.sumAvg.toFixed(1)}</div></div>
      <div class="s"><div class="k">和值区间</div><div class="v">${s.sumMin}–${s.sumMax}</div></div>
      <div class="s"><div class="k">${m.redLabel}奇数占比</div><div class="v">${(s.oddRatio * 100).toFixed(0)}%</div></div>`;
  }

  function renderTrend(sums) {
    // sums 为最近 60 期（新->旧），绘制时反转成时间顺序（旧->新）
    const data = sums.slice().reverse();
    const W = 600, H = 180, pl = 42, pr = 12, pt = 16, pb = 24;
    const min = Math.min(...data), max = Math.max(...data);
    const x = (i) => pl + (i / (data.length - 1)) * (W - pl - pr);
    const y = (v) => pt + (1 - (v - min) / (max - min || 1)) * (H - pt - pb);
    let line = '', area = `M ${x(0)} ${H - pb} `;
    data.forEach((v, i) => {
      const px = x(i), py = y(v);
      line += (i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
      area += ` L ${px} ${py}`;
    });
    area += ` L ${x(data.length - 1)} ${H - pb} Z`;
    const svg = document.getElementById('trendSvg');
    svg.innerHTML = `
      <line class="axis" x1="${pl}" y1="${pt}" x2="${pl}" y2="${H - pb}" />
      <line class="axis" x1="${pl}" y1="${H - pb}" x2="${W - pr}" y2="${H - pb}" />
      <path class="area" d="${area}" />
      <path class="line" d="${line}" />
      <circle class="dot" cx="${x(data.length - 1)}" cy="${y(data[data.length - 1])}" r="3.5" />
      <text x="${pl - 6}" y="${y(max) + 3}" text-anchor="end">${max}</text>
      <text x="${pl - 6}" y="${y(min) + 3}" text-anchor="end">${min}</text>
      <text x="${W - pr}" y="${H - 6}" text-anchor="end">最新</text>
      <text x="${pl}" y="${H - 6}" text-anchor="start">最早</text>`;
  }

  // ---------- 智能选号 ----------
  function weightedUniquePick(max, count, weightFn) {
    const items = [];
    for (let i = 1; i <= max; i++) items.push({ n: i, w: Math.max(1e-4, weightFn(i)) });
    const chosen = [];
    while (chosen.length < count && items.length) {
      const total = items.reduce((s, it) => s + it.w, 0);
      let r = Math.random() * total, idx = 0;
      for (; idx < items.length; idx++) { r -= items[idx].w; if (r <= 0) break; }
      if (idx >= items.length) idx = items.length - 1;
      chosen.push(items[idx].n);
      items.splice(idx, 1);
    }
    return chosen.sort((a, b) => a - b);
  }

  function generatePick() {
    const m = meta();
    const s = computeStats();
    const wRed = (i) => {
      if (state.strategy === 'random') return 1;
      if (state.strategy === 'hot') return s.freqRed[i] + 0.1;
      if (state.strategy === 'cold') return s.omitRed[i] + 1;
      // balance
      return (s.freqRed[i] / (s.maxFreqRed || 1)) * 0.5 + (s.omitRed[i] / (s.maxOmitRed || 1)) * 0.5 + 0.05;
    };
    const wBlue = (i) => {
      if (state.strategy === 'random') return 1;
      if (state.strategy === 'hot') return s.freqBlue[i] + 0.1;
      if (state.strategy === 'cold') return s.omitBlue[i] + 1;
      return (s.freqBlue[i] / (s.maxFreqBlue || 1)) * 0.5 + (s.omitBlue[i] / (s.maxOmitBlue || 1)) * 0.5 + 0.05;
    };
    return {
      red: weightedUniquePick(m.redMax, m.redCount, wRed),
      blue: weightedUniquePick(m.blueMax, m.blueCount, wBlue),
    };
  }

  function renderPredict() {
    const box = document.getElementById('pickList');
    const label = document.getElementById('pickModeLabel');
    const n = Math.min(10, Math.max(1, parseInt(document.getElementById('pickCount').value, 10) || 5));
    const bc = ballCls();
    const m = meta();
    const picks = [];
    for (let i = 0; i < n; i++) picks.push(generatePick());
    label.innerHTML = `当前模式：<b>${m.org} · ${m.name}</b>　${m.redCount}+${m.blueCount}（${m.redLabel} ${m.redMax} 选 ${m.redCount} / ${m.blueLabel} ${m.blueMax} 选 ${m.blueCount}）`;
    box.innerHTML = picks.map((p, i) => `
      <div class="pick-item">
        <div class="plabel">第 ${i + 1} 注</div>
        <div class="pballs">
          <span class="grp">${m.redLabel}</span>
          ${p.red.map((x) => ballHTML(x, bc.red)).join('')}
          <span class="sep"></span>
          <span class="grp">${m.blueLabel}</span>
          ${p.blue.map((x) => ballHTML(x, bc.blue)).join('')}
        </div>
      </div>`).join('');
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    document.getElementById('bannerClose').onclick = () =>
      (document.getElementById('banner').style.display = 'none');

    // 切换彩种（全局开关与智能选号模式开关共用）
    function setType(type) {
      if (type !== 'ssq' && type !== 'dlt') return;
      state.type = type;
      state.viewRec = null;
      document.getElementById('searchInput').value = '';
      document.querySelectorAll('#typeSwitch button').forEach((b) =>
        b.classList.toggle('active', b.dataset.type === type));
      document.querySelectorAll('#pickModeSwitch button').forEach((b) =>
        b.classList.toggle('active', b.dataset.type === type));
      document.getElementById('orgInfo').innerHTML =
        `<div class="dot">●</div>${meta().org}<br>${meta().drawDays}`;
      renderHero();
      renderQuery();
      renderStats();
      renderPredict();
      renderCheckLabels();
    }

    document.querySelectorAll('#typeSwitch button').forEach((btn) => {
      btn.onclick = () => setType(btn.dataset.type);
    });
    document.querySelectorAll('#pickModeSwitch button').forEach((btn) => {
      btn.onclick = () => setType(btn.dataset.type);
    });

    document.querySelectorAll('#tabs button').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'stats') renderStats();
      };
    });

    document.getElementById('searchInput').addEventListener('input', renderResultList);
    document.getElementById('searchField').addEventListener('change', renderResultList);

    document.querySelectorAll('#strategyOpts button').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('#strategyOpts button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.strategy = btn.dataset.strategy;
        renderPredict();
      };
    });
    document.getElementById('pickBtn').onclick = renderPredict;
    document.getElementById('pickReset').onclick = () => {
      state.strategy = 'random';
      document.querySelectorAll('#strategyOpts button').forEach((b) =>
        b.classList.toggle('active', b.dataset.strategy === 'random'));
      document.getElementById('pickCount').value = 5;
      document.getElementById('pickList').innerHTML = '<div class="empty">点击「生成选号」获取参考组合</div>';
    };

    // 中奖核对
    document.getElementById('checkBtn').onclick = runCheck;
    document.getElementById('checkClear').onclick = () => {
      document.getElementById('checkRedInput').value = '';
      document.getElementById('checkErr').textContent = '';
      document.getElementById('checkResult').innerHTML = '';
    };
  }

  // ---------- 中奖核对 ----------
  function renderCheckLabels() {
    const m = meta();
    document.getElementById('checkRedLabel').textContent =
      `${m.redLabel}（${m.redCount} 个，1-${m.redMax}，不重复）与 ${m.blueLabel}（${m.blueCount} 个，1-${m.blueMax}）`;
    document.getElementById('checkHint').textContent = `对照全部 ${list().length} 期官方历史`;
  }

  function parseTickets() {
    const m = meta();
    const raw = document.getElementById('checkRedInput').value.trim();
    if (!raw) return { error: '请输入至少一注号码' };
    const lines = raw.split('\n').map((s) => s.trim()).filter(Boolean);
    const tickets = [];
    for (let li = 0; li < lines.length; li++) {
      const parts = lines[li].split(/\s*\|\s*|\s+/).filter(Boolean);
      if (parts.length < 2) return { error: `第 ${li + 1} 注格式错误：需用空格或 | 分隔${m.redLabel}与${m.blueLabel}` };
      const red = parts[0].split(/[,\s]+/).filter(Boolean).map(Number);
      const blue = parts.slice(1).join(',').split(/[,\s]+/).filter(Boolean).map(Number);
      const ve = validateNums(red, m.redMax, m.redCount, m.redLabel);
      if (ve) return { error: `第 ${li + 1} 注 ${ve}` };
      const be = validateNums(blue, m.blueMax, m.blueCount, m.blueLabel);
      if (be) return { error: `第 ${li + 1} 注 ${be}` };
      tickets.push({ red, blue });
    }
    return { tickets };
  }

  function ballsWithMark(nums, matchedSet, cls) {
    return nums.map((n) => `<div class="ball ${cls} ${matchedSet.has(n) ? 'hit' : ''}">${pad2(n)}</div>`).join('');
  }

  function runCheck() {
    const errEl = document.getElementById('checkErr');
    const resEl = document.getElementById('checkResult');
    errEl.textContent = '';
    const { tickets, error } = parseTickets();
    if (error) { errEl.textContent = error; resEl.innerHTML = ''; return; }
    const m = meta();
    const recs = list();
    const bc = ballCls();
    let totalHits = 0;
    const blocks = tickets.map((tk, ti) => {
      const redSet = new Set(tk.red), blueSet = new Set(tk.blue);
      const matches = [];
      recs.forEach((rec) => {
        const rd = redOf(rec), bd = blueOf(rec);
        const rm = tk.red.filter((n) => rd.includes(n)).length;
        const bm = tk.blue.filter((n) => bd.includes(n)).length;
        const tier = tierOf(rm, bm);
        if (tier > 0) {
          const prizeInfo = (rec.prize || []).find((p) => p.tier === tier);
          matches.push({ rec, rm, bm, tier, prizeInfo });
        }
      });
      totalHits += matches.length;
      let inner = `<div class="ticket-head">第 ${ti + 1} 注 · ${m.redLabel} ${tk.red.map(pad2).join(' ')} ｜ ${m.blueLabel} ${tk.blue.map(pad2).join(' ')}</div>`;
      if (!matches.length) {
        inner += '<div class="ticket-none">未命中任何奖级</div>';
      } else {
        const best = Math.min(...matches.map((x) => x.tier));
        inner += `<div class="ticket-meta">命中 <b>${matches.length}</b> 期 · 最高 <b class="tier-c${best}">${TIER_NAMES[m.key][best]}</b></div>`;
        inner += matches.map((mt) => {
          const mr = new Set(redOf(mt.rec).filter((n) => redSet.has(n)));
          const mb = new Set(blueOf(mt.rec).filter((n) => blueSet.has(n)));
          const prize = mt.prizeInfo && mt.prizeInfo.amount
            ? `单注约 <b>${fmtMoney(mt.prizeInfo.amount)}</b> 元（${fmtMoney(mt.prizeInfo.count)} 注）`
            : '';
          return `<div class="match-row">
            <div class="mr-head">
              <span class="mr-issue">${mt.rec.issue} 期</span>
              <span class="mr-date">${mt.rec.date}</span>
              <span class="tier-badge tier-${mt.tier}">${TIER_NAMES[m.key][mt.tier]}</span>
              ${prize ? `<span class="mr-prize">${prize}</span>` : ''}
            </div>
            <div class="mr-balls">
              <span class="grp">${m.redLabel}</span>${ballsWithMark(redOf(mt.rec), mr, bc.red)}
              <span class="sep"></span>
              <span class="grp">${m.blueLabel}</span>${ballsWithMark(blueOf(mt.rec), mb, bc.blue)}
            </div>
            <div class="mr-yours">命中 ${mt.rm}红 ${mt.bm}蓝</div>
          </div>`;
        }).join('');
      }
      return `<div class="ticket-block">${inner}</div>`;
    }).join('');

    resEl.innerHTML =
      `<div class="check-summary">共核对 <b>${tickets.length}</b> 注 × <b>${recs.length}</b> 期，命中 <b>${totalHits}</b> 期</div>` +
      (totalHits === 0 ? '<div class="empty">未命中任何奖级，再接再厉 🍀</div>' : blocks);
  }


  // ---------- 实时刷新（经同源 /api，离线回退内置数据）----------
  async function refreshLive() {
    try {
      for (const t of ['ssq', 'dlt']) {
        const res = await fetch(`/api/results?type=${t}`);
        if (!res.ok) return;
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length) {
          DATA[t] = arr;
          DATA.meta[t].realCount = arr.length;
        }
      }
      const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
      const live = document.getElementById('liveStamp');
      if (live) live.textContent = `实时数据已更新 · ${stamp}`;
      renderHero();
      renderQuery();
      renderStats();
      renderPredict();
    } catch (_) {
      /* 以 file:// 打开或无服务时，静默回退到内置 data.js */
    }
  }

  // ---------- 初始化 ----------
  document.getElementById('orgInfo').innerHTML =
    `<div class="dot">●</div>${meta().org}<br>${meta().drawDays}`;
  bindEvents();
  renderHero();
  renderQuery();
  renderStats();
  renderPredict();
  renderCheckLabels();
  refreshLive(); // 若经 server.js 提供服务，则拉取最新官方开奖
})();
