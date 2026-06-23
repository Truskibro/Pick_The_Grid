/**
 * Full verification: compute correct points from Supabase picks,
 * compare against stored Supabase points and spreadsheet totals.
 */
const F1 = [25,18,15,12,10,8,6,4,2,1];
const SP = [8,7,6,5,4,3,2,1];
const FL_PTS = 1, DNF_PTS = 10;

const RESULTS = {
  r01:{t10:['RUS','ANT','LEC','HAM','NOR','VER','BEA','LIN','BOR','GAS'],fl:'VER',dnf:['ALO','BOT','HAD'],dns:['PIA','HUL']},
  r02:{t10:['ANT','RUS','HAM','LEC','BEA','GAS','LAW','HAD','SAI','COL'],fl:'ANT',dnf:['VER','ALO','STR'],dns:['PIA','NOR','BOR','ALB'],sp:['RUS','LEC','HAM','NOR','ANT','PIA','LAW','BEA']},
  r03:{t10:['ANT','PIA','LEC','RUS','NOR','HAM','GAS','VER','LAW','OCO'],fl:'ANT',dnf:['STR','BEA'],dns:[]},
  r04:{t10:['ANT','NOR','PIA','RUS','VER','HAM','COL','LEC','SAI','ALB'],fl:'NOR',dnf:['HUL','LAW','GAS','HAD'],dns:[],sp:['NOR','PIA','LEC','RUS','VER','ANT','HAM','GAS']},
  r05:{t10:['ANT','HAM','VER','LEC','HAD','COL','LAW','GAS','SAI','BEA'],fl:'ANT',dnf:['PER','NOR','RUS','ALO','ALB'],dns:['LIN'],sp:['RUS','NOR','ANT','PIA','LEC','HAM','VER','LIN']},
  r06:{t10:['ANT','HAM','GAS','HAD','PIA','LAW','LIN','ALB','OCO','ALO'],fl:'ANT',dnf:['SAI','LEC','STR','NOR','BEA','BOT','VER'],dns:[]},
  r07:{t10:['HAM','RUS','NOR','VER','PIA','HAD','GAS','LAW','LIN','COL'],fl:'HAM',dnf:['LEC','ANT','BEA','ALO','HUL','BOT','STR'],dns:[]},
};

function score(t10, fl, dnf, r) {
  let p=0; const s=new Set();
  for(let i=0;i<10;i++){const a=t10[i];if(!a||s.has(a))continue;s.add(a);if(a===r.t10[i])p+=F1[i];}
  let f=0;if(fl&&fl===r.fl)f=FL_PTS;
  let d=0;const ds=new Set(r.dns||[]),df=new Set(r.dnf||[]);
  if(!dnf&&df.size===0)d=DNF_PTS;else if(dnf&&ds.has(dnf)){}else if(dnf&&df.has(dnf))d=DNF_PTS;
  return p+f+d;
}

function scoreSp(sp, rsp) {
  let p=0;const s=new Set();
  for(let i=0;i<8;i++){const a=sp[i];if(!a||s.has(a))continue;s.add(a);if(a===rsp[i])p+=SP[i];}
  return p;
}

// Supabase picks (from curl output)
const DB = require('/tmp/supabase_picks.json');

const NAMES = {'cb7536a7':'Skye','652154af':'Whitney','f35417e9':'Bryan','e11ea4f5':'Carlos'};
const SS = {'cb7536a7':{'r01':1,'r02':37,'r03':78,'r04':93,'r05':102,'r06':128,'r07':240},
            '652154af':{'r01':24,'r02':41,'r03':91,'r04':107,'r05':107,'r06':143,'r07':255},
            'f35417e9':{'r01':63,'r02':81,'r03':106,'r04':108,'r05':123,'r06':149,'r07':261},
            'e11ea4f5':{'r01':68,'r02':118,'r03':172,'r04':182,'r05':217,'r06':217,'r07':329}};

console.log('RACE-BY-RACE COMPARISON: Computed vs Stored vs Spreadsheet\n');

const byUser = {};
for(const r of DB) {
  const uid=r.user_id.substring(0,8);
  if(!byUser[uid]) byUser[uid]={};
  byUser[uid][r.race_id]=r;
}

for(const [uid,name] of Object.entries(NAMES)) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${name} (${uid})`);
  console.log(`${'='.repeat(60)}`);
  let compTotal=0, dbTotal=0;
  for(const rid of ['r01','r02','r03','r04','r05','r06','r07']) {
    const res=RESULTS[rid];
    const row=byUser[uid]?.[rid];
    if(!row||!res) continue;
    const gpScore=score(row.predicted_top10,row.predicted_fastest_lap,row.predicted_dnf,res);
    const spScore=res.sp?scoreSp(row.predicted_sprint_top8||[],res.sp):0;
    const compRace=gpScore+spScore;
    const dbRace=(row.points_earned||0)+(row.sprint_points_earned||0);
    compTotal+=compRace; dbTotal+=dbRace;
    const ssCum=SS[uid]?.[rid];
    const gpMatch=gpScore===row.points_earned?'✓':'✗';
    const spMatch=spScore===(row.sprint_points_earned||0)?'✓':'✗';
    console.log(`  ${rid}: comp_gp=${gpScore}${gpMatch} db_gp=${row.points_earned} | comp_sp=${spScore}${spMatch} db_sp=${row.sprint_points_earned||0} | race=${compRace} | comp_cum=${compTotal} | ss_cum=${ssCum??'?'}`);
  }
  console.log(`  TOTAL: computed=${compTotal} | db_sum=${dbTotal} | spreadsheet=${SS[uid]?.r07}`);
}
