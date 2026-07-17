/* 中奖等级判定（与前端 app.js 的 tierOf 完全一致，抽为纯函数供云端脚本复用）
   type: 'ssq' | 'dlt'
   redMatch  = 命中的 红球/前区 个数
   blueMatch = 命中的 蓝球/后区 个数
   返回 0 表示未中奖，1..N 为对应等级 */
'use strict';

const TIER_NAMES = {
  ssq: ['', '一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖'],
  dlt: ['', '一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖', '八等奖'],
};

function tierOf(type, redMatch, blueMatch) {
  if (type === 'ssq') {
    if (redMatch === 6 && blueMatch === 1) return 1;
    if (redMatch === 6 && blueMatch === 0) return 2;
    if (redMatch === 5 && blueMatch === 1) return 3;
    if ((redMatch === 5 && blueMatch === 0) || (redMatch === 4 && blueMatch === 1)) return 4;
    if ((redMatch === 4 && blueMatch === 0) || (redMatch === 3 && blueMatch === 1)) return 5;
    if ((redMatch === 2 && blueMatch === 1) || (redMatch === 1 && blueMatch === 1) || (redMatch === 0 && blueMatch === 1)) return 6;
    return 0;
  }
  // dlt
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

function tierName(type, tier) {
  const names = TIER_NAMES[type] || [];
  return names[tier] || '';
}

// 计算两组号码命中数：red = 红球/前区，blue = 蓝球/后区
function countMatch(picked, drawn) {
  const set = new Set(drawn);
  let c = 0;
  for (const n of picked) if (set.has(n)) c++;
  return c;
}

// 判定单注：pick={red:[],blue:[]}，result={red:[],blue:[]}
// 返回 { tier, name, redMatch, blueMatch }
function judge(type, pick, result) {
  const redMatch = countMatch(pick.red, result.red);
  const blueMatch = countMatch(pick.blue, result.blue);
  const tier = tierOf(type, redMatch, blueMatch);
  return { tier, name: tierName(type, tier), redMatch, blueMatch };
}

module.exports = { tierOf, tierName, countMatch, judge, TIER_NAMES };
