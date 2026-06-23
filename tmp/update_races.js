// Update Supabase races table to match app numbering (no cancelled races)
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://fxwgbpassouaddakgyus.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDQ0NDAsImV4cCI6MjA4NzQ4MDQ0MH0.OLiqosY-xSUAs1o3oPyAx9OFN97ldqxLWeZbbJmxgN8'
);

const UPDATED_RACES = [
  {id:'r01',round:1,name:'Australian Grand Prix',location:'Melbourne',country:'Australia',country_flag:'🇦🇺',race_date:'2026-03-08',race_time:'05:00',status:'completed',has_sprint:false,total_laps:58},
  {id:'r02',round:2,name:'Chinese Grand Prix',location:'Shanghai',country:'China',country_flag:'🇨🇳',race_date:'2026-03-15',race_time:'07:00',status:'completed',has_sprint:true,total_laps:56},
  {id:'r03',round:3,name:'Japanese Grand Prix',location:'Suzuka',country:'Japan',country_flag:'🇯🇵',race_date:'2026-03-29',race_time:'06:00',status:'completed',has_sprint:false,total_laps:53},
  {id:'r04',round:4,name:'Miami Grand Prix',location:'Miami',country:'USA',country_flag:'🇺🇸',race_date:'2026-05-03',race_time:'20:00',status:'completed',has_sprint:true,total_laps:57},
  {id:'r05',round:5,name:'Canadian Grand Prix',location:'Montreal',country:'Canada',country_flag:'🇨🇦',race_date:'2026-05-24',race_time:'18:00',status:'completed',has_sprint:true,total_laps:70},
  {id:'r06',round:6,name:'Monaco Grand Prix',location:'Monte Carlo',country:'Monaco',country_flag:'🇲🇨',race_date:'2026-06-07',race_time:'13:00',status:'completed',has_sprint:false,total_laps:78},
  {id:'r07',round:7,name:'Barcelona Grand Prix',location:'Barcelona',country:'Spain',country_flag:'🇪🇸',race_date:'2026-06-14',race_time:'13:00',status:'completed',has_sprint:false,total_laps:66},
  {id:'r08',round:8,name:'Austrian Grand Prix',location:'Spielberg',country:'Austria',country_flag:'🇦🇹',race_date:'2026-06-28',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:71},
  {id:'r09',round:9,name:'British Grand Prix',location:'Silverstone',country:'United Kingdom',country_flag:'🇬🇧',race_date:'2026-07-05',race_time:'14:00',status:'upcoming',has_sprint:true,total_laps:52},
  {id:'r10',round:10,name:'Belgian Grand Prix',location:'Spa-Francorchamps',country:'Belgium',country_flag:'🇧🇪',race_date:'2026-07-19',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:44},
  {id:'r11',round:11,name:'Hungarian Grand Prix',location:'Budapest',country:'Hungary',country_flag:'🇭🇺',race_date:'2026-07-26',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:70},
  {id:'r12',round:12,name:'Dutch Grand Prix',location:'Zandvoort',country:'Netherlands',country_flag:'🇳🇱',race_date:'2026-08-23',race_time:'13:00',status:'upcoming',has_sprint:true,total_laps:72},
  {id:'r13',round:13,name:'Italian Grand Prix',location:'Monza',country:'Italy',country_flag:'🇮🇹',race_date:'2026-09-06',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:53},
  {id:'r14',round:14,name:'Spanish Grand Prix',location:'Madrid',country:'Spain',country_flag:'🇪🇸',race_date:'2026-09-13',race_time:'13:00',status:'upcoming',has_sprint:false,total_laps:66},
  {id:'r15',round:15,name:'Azerbaijan Grand Prix',location:'Baku',country:'Azerbaijan',country_flag:'🇦🇿',race_date:'2026-09-26',race_time:'12:00',status:'upcoming',has_sprint:false,total_laps:51},
  {id:'r16',round:16,name:'Singapore Grand Prix',location:'Marina Bay',country:'Singapore',country_flag:'🇸🇬',race_date:'2026-10-11',race_time:'12:00',status:'upcoming',has_sprint:true,total_laps:62},
  {id:'r17',round:17,name:'United States Grand Prix',location:'Austin',country:'USA',country_flag:'🇺🇸',race_date:'2026-10-25',race_time:'19:00',status:'upcoming',has_sprint:false,total_laps:56},
  {id:'r18',round:18,name:'Mexico City Grand Prix',location:'Mexico City',country:'Mexico',country_flag:'🇲🇽',race_date:'2026-11-01',race_time:'20:00',status:'upcoming',has_sprint:false,total_laps:71},
  {id:'r19',round:19,name:'Brazilian Grand Prix',location:'Interlagos',country:'Brazil',country_flag:'🇧🇷',race_date:'2026-11-08',race_time:'17:00',status:'upcoming',has_sprint:false,total_laps:71},
  {id:'r20',round:20,name:'Las Vegas Grand Prix',location:'Las Vegas',country:'USA',country_flag:'🇺🇸',race_date:'2026-11-22',race_time:'06:00',status:'upcoming',has_sprint:false,total_laps:50},
  {id:'r21',round:21,name:'Qatar Grand Prix',location:'Lusail',country:'Qatar',country_flag:'🇶🇦',race_date:'2026-11-29',race_time:'17:00',status:'upcoming',has_sprint:false,total_laps:57},
  {id:'r22',round:22,name:'Abu Dhabi Grand Prix',location:'Yas Marina',country:'UAE',country_flag:'🇦🇪',race_date:'2026-12-06',race_time:'14:00',status:'upcoming',has_sprint:false,total_laps:58},
];

async function main() {
  console.log('Updating Supabase races...');
  
  // Upsert all 22 races
  for (const r of UPDATED_RACES) {
    const { error } = await supabase.from('races').upsert({
      id: r.id, round: r.round, name: r.name, location: r.location,
      country: r.country, country_flag: r.country_flag, race_date: r.race_date,
      race_time: r.race_time, status: r.status, has_sprint: r.has_sprint,
      total_laps: r.total_laps
    }, { onConflict: 'id' });
    if (error) console.log(`ERROR ${r.id}: ${error.message}`);
    else console.log(`OK ${r.id}: ${r.name} (R${r.round}) ${r.status}`);
  }
  
  // Delete r23 and r24 (no longer needed)
  const { data: extras } = await supabase.from('races').select('id').in('id', ['r23','r24']);
  if (extras && extras.length > 0) {
    const { error } = await supabase.from('races').delete().in('id', ['r23','r24']);
    if (error) console.log('Delete r23/r24 error:', error.message);
    else console.log('Deleted r23, r24');
  }
  
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
