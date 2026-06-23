/**
 * Verify Spanish GP (R07 Barcelona) points for all 4 users.
 * Compares: Spreadsheet expected totals vs Supabase stored vs Computed correct.
 */

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_BONUS = 1;
const DNF_BONUS = 10;

// ============================================================
// RACE RESULTS (from f1-data.ts, verified against Jolpica API)
// ============================================================

const RACE_RESULTS = {
  r01: {
    top10: ['RUS','ANT','LEC','HAM','NOR','VER','BEA','LIN','BOR','GAS'],
    fastestLap: 'VER',
    trueDnf: ['ALO','BOT','HAD'],
    dns: ['PIA','HUL'],
  },
  r02: {
    top10: ['ANT','RUS','HAM','LEC','BEA','GAS','LAW','HAD','SAI','COL'],
    fastestLap: 'ANT',
    trueDnf: ['VER','ALO','STR'],
    dns: ['PIA','NOR','BOR','ALB'],
    sprint: ['RUS','LEC','HAM','NOR','ANT','PIA','LAW','BEA'],
  },
  r03: {
    top10: ['ANT','PIA','LEC','RUS','NOR','HAM','GAS','VER','LAW','OCO'],
    fastestLap: 'ANT',
    trueDnf: ['STR','BEA'],
    dns: [],
  },
  r04: {
    top10: ['ANT','NOR','PIA','RUS','VER','HAM','COL','LEC','SAI','ALB'],
    fastestLap: 'NOR',
    trueDnf: ['HUL','LAW','GAS','HAD'],
    dns: [],
    sprint: ['NOR','PIA','LEC','RUS','VER','ANT','HAM','GAS'],
  },
  r05: {
    top10: ['ANT','HAM','VER','LEC','HAD','COL','LAW','GAS','SAI','BEA'],
    fastestLap: 'ANT',
    trueDnf: ['PER','NOR','RUS','ALO','ALB'],
    dns: ['LIN'],
    sprint: ['RUS','NOR','ANT','PIA','LEC','HAM','VER','LIN'],
  },
  r06: {
    top10: ['ANT','HAM','GAS','HAD','PIA','LAW','LIN','ALB','OCO','ALO'],
    fastestLap: 'ANT',
    trueDnf: ['SAI','LEC','STR','NOR','BEA','BOT','VER'],
    dns: [],
  },
  r07: {
    top10: ['HAM','RUS','NOR','VER','PIA','HAD','GAS','LAW','LIN','COL'],
    fastestLap: 'HAM',
    trueDnf: ['LEC','ANT','BEA','ALO','HUL','BOT','STR'],
    dns: [],
  },
};

// ============================================================
// USER PREDICTIONS (from verified spreadsheet — the source of truth)
// ============================================================

const PICKS = {
  // Skye Leach
  'cb7536a7': {
    r01: {
      top10: ['VER','RUS','ANT','PIA','LEC','NOR','HAM','HAD','LAW','SAI'],
      fastestLap: 'VER',
      dnf: 'STR',
      sprint: [],
    },
    r02: {
      // Spreadsheet shows: ANT, RUS, HAM, LEC, BEA, GAS, LAW, HAD, SAI, COL
      // FL: ANT, DNF: (none), Sprint: RUS, LEC, HAM, NOR, ANT, PIA, LAW, BEA
      top10: ['ANT','RUS','HAM','LEC','BEA','GAS','LAW','HAD','SAI','COL'],
      fastestLap: 'ANT',
      dnf: null,
      sprint: ['RUS','LEC','HAM','NOR','ANT','PIA','LAW','BEA'],
    },
    r03: {
      top10: ['ANT','RUS','LEC','PIA','HAM','NOR','VER','HAD','GAS','LIN'],
      fastestLap: 'ANT',
      dnf: 'BOT',
      sprint: [],
    },
    r04: {
      top10: ['VER','ANT','NOR','LEC','RUS','HAM','PIA','HAD','GAS','BEA'],
      fastestLap: 'VER',
      dnf: 'COL',
      sprint: ['ANT','NOR','PIA','RUS','LEC','VER','HAM','HAD'],
    },
    r05: {
      top10: ['RUS','ANT','PIA','NOR','HAM','LEC','VER','HAD','LIN','LAW'],
      fastestLap: 'ANT',
      dnf: 'COL',
      sprint: ['ANT','RUS','NOR','PIA','LEC','VER','HAM','HAD'],
    },
    r06: {
      top10: ['ANT','VER','RUS','LEC','HAM','PIA','HAD','NOR','GAS','COL'],
      fastestLap: 'ANT',
      dnf: 'LAW',
      sprint: [],
    },
    r07: {
      top10: ['ANT','RUS','HAM','NOR','VER','PIA','LEC','HAD','HUL','GAS'],
      fastestLap: 'ANT',
      dnf: 'LAW',
      sprint: [],
    },
  },
  // Whitney Trujillo
  '652154af': {
    r01: {
      top10: ['ANT','RUS','LEC','PIA','HAD','VER','NOR','HAM','LAW','HUL'],
      fastestLap: 'VER',
      dnf: 'STR',
      sprint: [],
    },
    r02: {
      top10: ['RUS','ANT','LEC','HAM','PIA','VER','NOR','HAD','HUL','BEA'],
      fastestLap: 'RUS',
      dnf: 'STR',
      sprint: ['ANT','RUS','NOR','HAM','VER','PIA','LEC','HAD'],
    },
    r03: {
      top10: ['ANT','RUS','LEC','PIA','NOR','VER','HAM','GAS','HAD','HUL'],
      fastestLap: 'PIA',
      dnf: 'PER',
      sprint: [],
    },
    r04: {
      top10: ['PIA','VER','NOR','ANT','LEC','RUS','HAM','COL','SAI','GAS'],
      fastestLap: null,
      dnf: 'STR',
      sprint: ['NOR','LEC','ANT','PIA','VER','RUS','HAM','COL'],
    },
    r05: {
      top10: ['RUS','ANT','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'],
      fastestLap: 'ANT',
      dnf: 'STR',
      sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'],
    },
    r06: {
      top10: ['ANT','VER','HAM','LEC','HAD','PIA','RUS','NOR','GAS','SAI'],
      fastestLap: 'ANT',
      dnf: 'STR',
      sprint: [],
    },
    r07: {
      top10: ['HAM','RUS','VER','LEC','PIA','HAD','GAS','LAW','LIN','COL'],
      fastestLap: 'ANT',
      dnf: 'ALO',
      sprint: [],
    },
  },
  // Bryan Leach
  'f35417e9': {
    r01: {
      top10: ['RUS','ANT','PIA','LEC','NOR','HAM','HAD','VER','LAW','LIN'],
      fastestLap: 'RUS',
      dnf: 'ALO',
      sprint: [],
    },
    r02: {
      top10: ['RUS','ANT','LEC','HAM','PIA','NOR','VER','HAD','BEA','GAS'],
      fastestLap: 'RUS',
      dnf: 'PER',
      sprint: ['RUS','ANT','HAM','LEC','LEC','VER','NOR','HAD'],
    },
    r03: {
      top10: ['RUS','ANT','LEC','HAM','VER','PIA','NOR','HAD','GAS','LIN'],
      fastestLap: 'RUS',
      dnf: 'STR',
      sprint: [],
    },
    r04: {
      top10: ['VER','ANT','NOR','LEC','RUS','PIA','HAM','GAS','HAD','COL'],
      fastestLap: 'ANT',
      dnf: 'ALO',
      sprint: ['ANT','NOR','PIA','LEC','RUS','VER','HAM','HAD'],
    },
    r05: {
      top10: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD','LIN','LAW'],
      fastestLap: 'NOR',
      dnf: 'BOT',
      sprint: ['RUS','ANT','NOR','PIA','HAM','LEC','VER','HAD'],
    },
    r06: {
      top10: ['ANT','VER','LEC','HAM','RUS','PIA','NOR','GAS','LAW','ALB'],
      fastestLap: 'ANT',
      dnf: 'HAD',
      sprint: [],
    },
    r07: {
      top10: ['RUS','ANT','HAM','VER','LEC','PIA','HAD','LAW','SAI','LIN'],
      fastestLap: 'ANT',
      dnf: null,
      sprint: [],
    },
  },
  // Carlos Trujillo
  'e11ea4f5': {
    r01: {
      top10: ['RUS','ANT','LEC','PIA','HAD','HAM','NOR','VER','LAW','HUL'],
      fastestLap: 'RUS',
      dnf: 'ALO',
      sprint: [],
    },
    r02: {
      top10: ['RUS','ANT','HAM','LEC','NOR','PIA','VER','HAD','GAS','HUL'],
      fastestLap: 'RUS',
      dnf: 'ALB',
      sprint: ['RUS','ANT','HAM','NOR','LEC','VER','PIA','GAS'],
    },
    r03: {
      top10: ['ANT','RUS','LEC','HAM','PIA','NOR','HAD','VER','GAS','LIN'],
      fastestLap: 'RUS',
      dnf: 'STR',
      sprint: [],
    },
    r04: {
      top10: ['VER','ANT','NOR','LEC','RUS','LEC','PIA','HAM','GAS','HUL'],
      fastestLap: 'VER',
      dnf: null,
      sprint: ['NOR','ANT','PIA','LEC','RUS','VER','HAM','HAD'],
    },
    r05: {
      top10: ['ANT','RUS','NOR','PIA','VER','LEC','HAM','HAD','LIN','COL'],
      fastestLap: 'ANT',
      dnf: 'ALO',
      sprint: ['ANT','RUS','PIA','NOR','VER','LEC','HAM','HAD'],
    },
    r06: {
      top10: ['VER','ANT','HAM','LEC','HAD','RUS','PIA','NOR','GAS','LAW'],
      fastestLap: 'VER',
      dnf: 'BOR',
      sprint: [],
    },
    r07: {
      top10: ['RUS','HAM','ANT','VER','NOR','LEC','HAD','PIA','HUL','LAW'],
      fastestLap: 'RUS',
      dnf: null,
      sprint: [],
    },
  },
};

// ============================================================
// SCORING ENGINE (same logic as lib/scoring.ts)
// ============================================================

function scoreGP(picks, result) {
  let posPoints = 0;
  const correctPositions = [];
  const scored = new Set();
  
  for (let i = 0; i < 10 && i < picks.top10.length; i++) {
    const pred = picks.top10[i];
    const actual = result.top10[i];
    if (!pred) continue;
    if (scored.has(pred)) continue;
    scored.add(pred);
    if (pred === actual) {
      posPoints += F1_POINTS[i];
      correctPositions.push(i);
    }
  }

  let flPoints = 0;
  if (picks.fastestLap && picks.fastestLap === result.fastestLap) {
    flPoints = FASTEST_LAP_BONUS;
  }

  let dnfPoints = 0;
  const dnsSet = new Set(result.dns || []);
  const dnfSet = new Set(result.trueDnf || []);
  
  if (!picks.dnf && dnfSet.size === 0) {
    dnfPoints = DNF_BONUS;
  } else if (picks.dnf && dnsSet.has(picks.dnf)) {
    // DNS — no points
  } else if (picks.dnf && dnfSet.has(picks.dnf)) {
    dnfPoints = DNF_BONUS;
  }

  return { posPoints, flPoints, dnfPoints, total: posPoints + flPoints + dnfPoints, correctPositions };
}

function scoreSprint(picks, sprintResult) {
  let posPoints = 0;
  const correctPositions = [];
  const scored = new Set();
  
  for (let i = 0; i < 8 && i < picks.length; i++) {
    const pred = picks[i];
    const actual = sprintResult[i];
    if (!pred) continue;
    if (scored.has(pred)) continue;
    scored.add(pred);
    if (pred === actual) {
      posPoints += SPRINT_POINTS[i];
      correctPositions.push(i);
    }
  }

  return { posPoints, total: posPoints, correctPositions };
}

// ============================================================
// COMPUTE & COMPARE
// ============================================================

const SPREADSHEET_TOTALS = {
  'cb7536a7': 240,   // Skye
  '652154af': 255,   // Whitney
  'f35417e9': 261,   // Bryan
  'e11ea4f5': 329,   // Carlos
};

// Spreadsheet per-race totals (cumulative)
const SPREADSHEET_CUMULATIVE = {
  'cb7536a7': { r01: 1, r02: 37, r03: 78, r04_mia_sprint: 85, r04_mia: 93, r05_can_sprint: 102, r05_can: 102, r06_mon: 128, r07_spa: 240 },
  '652154af': { r01: 24, r02: 41, r03: 91, r04_mia_sprint: 105, r04_mia: 107, r05_can_sprint: 107, r05_can: 107, r06_mon: 143, r07_spa: 255 },
  'f35417e9': { r01: 63, r02: 81, r03: 106, r04_mia_sprint: 108, r04_mia: 108, r05_can_sprint: 123, r05_can: 123, r06_mon: 149, r07_spa: 261 },
  'e11ea4f5': { r01: 68, r02: 118, r03: 172, r04_mia_sprint: 182, r04_mia: 182, r05_can_sprint: 182, r05_can: 217, r06_mon: 217, r07_spa: 329 },
};

console.log('=== RACE-BY-RACE SCORING TRACE ===\n');

for (const [uid, picks] of Object.entries(PICKS)) {
  const name = {
    'cb7536a7': 'Skye Leach',
    '652154af': 'Whitney Trujillo',
    'f35417e9': 'Bryan Leach',
    'e11ea4f5': 'Carlos Trujillo',
  }[uid];
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${name} (${uid})`);
  console.log(`${'='.repeat(60)}`);
  
  let runningTotal = 0;
  
  for (const raceId of ['r01','r02','r03','r04','r05','r06','r07']) {
    const result = RACE_RESULTS[raceId];
    const userPicks = picks[raceId];
    if (!userPicks || !result) continue;
    
    const gpScore = scoreGP(userPicks, result);
    const sprintScore = result.sprint && userPicks.sprint.length > 0 
      ? scoreSprint(userPicks.sprint, result.sprint) 
      : { posPoints: 0, total: 0, correctPositions: [] };
    
    runningTotal += gpScore.total + sprintScore.total;
    
    const raceName = {
      r01: 'AUS', r02: 'CHN', r03: 'JPN', r04: 'MIA', r05: 'CAN', r06: 'MON', r07: 'ESP'
    }[raceId];
    
    const spKey = raceId === 'r04' ? 'r04_mia' : raceId === 'r05' ? 'r05_can' : raceId === 'r06' ? 'r06_mon' : raceId === 'r07' ? 'r07_spa' : raceId;
    const ssExpected = SPREADSHEET_CUMULATIVE[uid]?.[spKey];
    
    console.log(`  ${raceId} ${raceName}:`);
    console.log(`    GP:   pos=${gpScore.posPoints} fl=${gpScore.flPoints} dnf=${gpScore.dnfPoints} = ${gpScore.total}`);
    console.log(`    Correct positions: [${gpScore.correctPositions.map(i => i+1).join(', ')}]`);
    if (result.sprint) {
      console.log(`    SPR:  pos=${sprintScore.posPoints} = ${sprintScore.total}`);
      console.log(`    Sprint correct positions: [${sprintScore.correctPositions.map(i => i+1).join(', ')}]`);
    }
    console.log(`    Race total: ${gpScore.total + sprintScore.total} | Running total: ${runningTotal}`);
    if (ssExpected !== undefined) {
      const match = runningTotal === ssExpected ? '✓' : `✗ (spreadsheet expected: ${ssExpected})`;
      console.log(`    Spreadsheet cumulative: ${ssExpected} ${match}`);
    }
  }
  
  console.log(`\n  FINAL TOTAL: ${runningTotal}  |  Spreadsheet: ${SPREADSHEET_TOTALS[uid]}`);
}

// Now focus on R07 Spanish GP specifically
console.log('\n\n' + '='.repeat(60));
console.log('  SPANISH GP (R07) — DETAILED TRACE');
console.log('='.repeat(60));

const r07Result = RACE_RESULTS.r07;
console.log(`\nActual R07 Results:`);
console.log(`  Top 10: ${r07Result.top10.join(', ')}`);
console.log(`  Fastest Lap: ${r07Result.fastestLap}`);
console.log(`  True DNFs: ${r07Result.trueDnf.join(', ')}`);
console.log(`  DNS: ${(r07Result.dns || []).join(', ') || 'none'}`);

for (const [uid, picks] of Object.entries(PICKS)) {
  const name = {
    'cb7536a7': 'Skye Leach',
    '652154af': 'Whitney Trujillo',
    'f35417e9': 'Bryan Leach',
    'e11ea4f5': 'Carlos Trujillo',
  }[uid];
  const userPicks = picks.r07;
  
  console.log(`\n--- ${name} ---`);
  console.log(`  Predicted: ${userPicks.top10.join(', ')}`);
  console.log(`  FL pick: ${userPicks.fastestLap || 'none'}  |  DNF pick: ${userPicks.dnf || 'none'}`);
  
  const score = scoreGP(userPicks, r07Result);
  console.log(`  Position matches: P${score.correctPositions.map(i => i+1).join(', P') || 'none'}`);
  console.log(`  Points: pos=${score.posPoints} fl=${score.flPoints} dnf=${score.dnfPoints} = ${score.total}`);
  
  const expectedSpreadsheet = 112; // placeholder
  const match = score.total === expectedSpreadsheet ? '✓' : `✗ (spreadsheet shows ${expectedSpreadsheet} as placeholder)`;
  console.log(`  Spreadsheet round points: ${expectedSpreadsheet} ${match}`);
}
