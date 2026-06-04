import { Team, Driver, Race, RaceResult, LeaderboardEntry } from '@/types';

export const TEAMS: Team[] = [
  { id: 'mclaren', name: 'McLaren', color: '#FF8000', shortName: 'MCL' },
  { id: 'ferrari', name: 'Scuderia Ferrari', color: '#E8002D', shortName: 'FER' },
  { id: 'red-bull', name: 'Red Bull Racing', color: '#3671C6', shortName: 'RBR' },
  { id: 'mercedes', name: 'Mercedes-AMG', color: '#27F4D2', shortName: 'MER' },
  { id: 'aston-martin', name: 'Aston Martin', color: '#229971', shortName: 'AMR' },
  { id: 'alpine', name: 'Alpine', color: '#FF87BC', shortName: 'ALP' },
  { id: 'williams', name: 'Williams', color: '#64C4FF', shortName: 'WIL' },
  { id: 'racing-bulls', name: 'Racing Bulls', color: '#6692FF', shortName: 'RCB' },
  { id: 'audi', name: 'Audi', color: '#E0003C', shortName: 'AUD' },
  { id: 'haas', name: 'Haas', color: '#B6BABD', shortName: 'HAA' },
  { id: 'cadillac', name: 'Cadillac', color: '#1C1C1C', shortName: 'CAD' },
];

export const DRIVERS: Driver[] = [
  { id: 'NOR', name: 'Lando Norris', shortName: 'NOR', number: 1, teamId: 'mclaren', championshipPoints: 0 },
  { id: 'PIA', name: 'Oscar Piastri', shortName: 'PIA', number: 81, teamId: 'mclaren', championshipPoints: 0 },
  { id: 'LEC', name: 'Charles Leclerc', shortName: 'LEC', number: 16, teamId: 'ferrari', championshipPoints: 0 },
  { id: 'HAM', name: 'Lewis Hamilton', shortName: 'HAM', number: 44, teamId: 'ferrari', championshipPoints: 0 },
  { id: 'VER', name: 'Max Verstappen', shortName: 'VER', number: 3, teamId: 'red-bull', championshipPoints: 0 },
  { id: 'HAD', name: 'Isack Hadjar', shortName: 'HAD', number: 6, teamId: 'red-bull', championshipPoints: 0 },
  { id: 'RUS', name: 'George Russell', shortName: 'RUS', number: 63, teamId: 'mercedes', championshipPoints: 0 },
  { id: 'ANT', name: 'Kimi Antonelli', shortName: 'ANT', number: 12, teamId: 'mercedes', championshipPoints: 0 },
  { id: 'ALO', name: 'Fernando Alonso', shortName: 'ALO', number: 14, teamId: 'aston-martin', championshipPoints: 0 },
  { id: 'STR', name: 'Lance Stroll', shortName: 'STR', number: 18, teamId: 'aston-martin', championshipPoints: 0 },
  { id: 'GAS', name: 'Pierre Gasly', shortName: 'GAS', number: 10, teamId: 'alpine', championshipPoints: 0 },
  { id: 'COL', name: 'Franco Colapinto', shortName: 'COL', number: 43, teamId: 'alpine', championshipPoints: 0 },
  { id: 'ALB', name: 'Alex Albon', shortName: 'ALB', number: 23, teamId: 'williams', championshipPoints: 0 },
  { id: 'SAI', name: 'Carlos Sainz', shortName: 'SAI', number: 55, teamId: 'williams', championshipPoints: 0 },
  { id: 'LAW', name: 'Liam Lawson', shortName: 'LAW', number: 30, teamId: 'racing-bulls', championshipPoints: 0 },
  { id: 'LIN', name: 'Arvid Lindblad', shortName: 'LIN', number: 41, teamId: 'racing-bulls', championshipPoints: 0 },
  { id: 'HUL', name: 'Nico Hulkenberg', shortName: 'HUL', number: 27, teamId: 'audi', championshipPoints: 0 },
  { id: 'BOR', name: 'Gabriel Bortoleto', shortName: 'BOR', number: 5, teamId: 'audi', championshipPoints: 0 },
  { id: 'BEA', name: 'Oliver Bearman', shortName: 'BEA', number: 87, teamId: 'haas', championshipPoints: 0 },
  { id: 'OCO', name: 'Esteban Ocon', shortName: 'OCO', number: 31, teamId: 'haas', championshipPoints: 0 },
  { id: 'PER', name: 'Sergio Perez', shortName: 'PER', number: 11, teamId: 'cadillac', championshipPoints: 0 },
  { id: 'BOT', name: 'Valtteri Bottas', shortName: 'BOT', number: 77, teamId: 'cadillac', championshipPoints: 0 },
];

export const RACES: Race[] = [
  { id: 'r01', round: 1, name: 'Australian Grand Prix', location: 'Melbourne', country: 'Australia', countryFlag: '🇦🇺', raceDate: '2026-03-08', raceTime: '05:00', status: 'upcoming', hasSprint: false, totalLaps: 58 },
  { id: 'r02', round: 2, name: 'Chinese Grand Prix', location: 'Shanghai', country: 'China', countryFlag: '🇨🇳', raceDate: '2026-03-15', raceTime: '07:00', status: 'upcoming', hasSprint: true, totalLaps: 56 },
  { id: 'r03', round: 3, name: 'Japanese Grand Prix', location: 'Suzuka', country: 'Japan', countryFlag: '🇯🇵', raceDate: '2026-03-29', raceTime: '06:00', status: 'upcoming', hasSprint: false, totalLaps: 53 },
  { id: 'r04', round: 4, name: 'Bahrain Grand Prix', location: 'Sakhir', country: 'Bahrain', countryFlag: '🇧🇭', raceDate: '2026-04-12', raceTime: '16:00', status: 'cancelled', hasSprint: false, totalLaps: 57 },
  { id: 'r05', round: 5, name: 'Saudi Arabian Grand Prix', location: 'Jeddah', country: 'Saudi Arabia', countryFlag: '🇸🇦', raceDate: '2026-04-19', raceTime: '18:00', status: 'cancelled', hasSprint: false, totalLaps: 50 },
  { id: 'r06', round: 6, name: 'Miami Grand Prix', location: 'Miami', country: 'USA', countryFlag: '🇺🇸', raceDate: '2026-05-03', raceTime: '20:00', status: 'upcoming', hasSprint: true, totalLaps: 57 },
  { id: 'r07', round: 7, name: 'Canadian Grand Prix', location: 'Montreal', country: 'Canada', countryFlag: '🇨🇦', raceDate: '2026-05-24', raceTime: '18:00', status: 'upcoming', hasSprint: true, totalLaps: 70 },
  { id: 'r08', round: 8, name: 'Monaco Grand Prix', location: 'Monte Carlo', country: 'Monaco', countryFlag: '🇲🇨', raceDate: '2026-06-07', raceTime: '13:00', status: 'upcoming', hasSprint: false, totalLaps: 78 },
  { id: 'r09', round: 9, name: 'Spanish Grand Prix', location: 'Barcelona', country: 'Spain', countryFlag: '🇪🇸', raceDate: '2026-06-14', raceTime: '13:00', status: 'upcoming', hasSprint: false, totalLaps: 66 },
  { id: 'r10', round: 10, name: 'Austrian Grand Prix', location: 'Spielberg', country: 'Austria', countryFlag: '🇦🇹', raceDate: '2026-06-28', raceTime: '13:00', status: 'upcoming', hasSprint: false, totalLaps: 71 },
  { id: 'r11', round: 11, name: 'British Grand Prix', location: 'Silverstone', country: 'United Kingdom', countryFlag: '🇬🇧', raceDate: '2026-07-05', raceTime: '14:00', status: 'upcoming', hasSprint: true, totalLaps: 52 },
  { id: 'r12', round: 12, name: 'Belgian Grand Prix', location: 'Spa-Francorchamps', country: 'Belgium', countryFlag: '🇧🇪', raceDate: '2026-07-19', raceTime: '13:00', status: 'upcoming', hasSprint: false, totalLaps: 44 },
  { id: 'r13', round: 13, name: 'Hungarian Grand Prix', location: 'Budapest', country: 'Hungary', countryFlag: '🇭🇺', raceDate: '2026-07-26', raceTime: '13:00', status: 'upcoming', hasSprint: false, totalLaps: 70 },
  { id: 'r14', round: 14, name: 'Dutch Grand Prix', location: 'Zandvoort', country: 'Netherlands', countryFlag: '🇳🇱', raceDate: '2026-08-23', raceTime: '13:00', status: 'upcoming', hasSprint: true, totalLaps: 72 },
  { id: 'r15', round: 15, name: 'Italian Grand Prix', location: 'Monza', country: 'Italy', countryFlag: '🇮🇹', raceDate: '2026-09-06', raceTime: '13:00', status: 'upcoming', hasSprint: false, totalLaps: 53 },
  { id: 'r16', round: 16, name: 'Madrid Grand Prix', location: 'Madrid', country: 'Spain', countryFlag: '🇪🇸', raceDate: '2026-09-13', raceTime: '13:00', status: 'upcoming', hasSprint: false, totalLaps: 55 },
  { id: 'r17', round: 17, name: 'Azerbaijan Grand Prix', location: 'Baku', country: 'Azerbaijan', countryFlag: '🇦🇿', raceDate: '2026-09-27', raceTime: '12:00', status: 'upcoming', hasSprint: false, totalLaps: 51 },
  { id: 'r18', round: 18, name: 'Singapore Grand Prix', location: 'Marina Bay', country: 'Singapore', countryFlag: '🇸🇬', raceDate: '2026-10-11', raceTime: '12:00', status: 'upcoming', hasSprint: true, totalLaps: 62 },
  { id: 'r19', round: 19, name: 'United States Grand Prix', location: 'Austin', country: 'USA', countryFlag: '🇺🇸', raceDate: '2026-10-25', raceTime: '19:00', status: 'upcoming', hasSprint: false, totalLaps: 56 },
  { id: 'r20', round: 20, name: 'Mexico City Grand Prix', location: 'Mexico City', country: 'Mexico', countryFlag: '🇲🇽', raceDate: '2026-11-01', raceTime: '20:00', status: 'upcoming', hasSprint: false, totalLaps: 71 },
  { id: 'r21', round: 21, name: 'São Paulo Grand Prix', location: 'Interlagos', country: 'Brazil', countryFlag: '🇧🇷', raceDate: '2026-11-08', raceTime: '17:00', status: 'upcoming', hasSprint: false, totalLaps: 71 },
  { id: 'r22', round: 22, name: 'Las Vegas Grand Prix', location: 'Las Vegas', country: 'USA', countryFlag: '🇺🇸', raceDate: '2026-11-21', raceTime: '06:00', status: 'upcoming', hasSprint: false, totalLaps: 50 },
  { id: 'r23', round: 23, name: 'Qatar Grand Prix', location: 'Lusail', country: 'Qatar', countryFlag: '🇶🇦', raceDate: '2026-11-29', raceTime: '17:00', status: 'upcoming', hasSprint: false, totalLaps: 57 },
  { id: 'r24', round: 24, name: 'Abu Dhabi Grand Prix', location: 'Yas Marina', country: 'UAE', countryFlag: '🇦🇪', raceDate: '2026-12-06', raceTime: '14:00', status: 'upcoming', hasSprint: false, totalLaps: 58 },
];

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, userId: 'u1', username: 'speedking', displayName: 'Speed King', totalPoints: 287, previousRank: 1 },
  { rank: 2, userId: 'u2', username: 'f1oracle', displayName: 'F1 Oracle', totalPoints: 264, previousRank: 3 },
  { rank: 3, userId: 'u3', username: 'racefan99', displayName: 'Race Fan 99', totalPoints: 251, previousRank: 2 },
  { rank: 4, userId: 'u4', username: 'apexhunter', displayName: 'Apex Hunter', totalPoints: 238, previousRank: 5 },
  { rank: 5, userId: 'u5', username: 'pitstopguru', displayName: 'Pit Stop Guru', totalPoints: 225, previousRank: 4 },
  { rank: 6, userId: 'u6', username: 'slipstream', displayName: 'Slipstream', totalPoints: 212, previousRank: 7 },
  { rank: 7, userId: 'u7', username: 'drszone', displayName: 'DRS Zone', totalPoints: 198, previousRank: 6 },
  { rank: 8, userId: 'u8', username: 'gridwalker', displayName: 'Grid Walker', totalPoints: 185, previousRank: 9 },
  { rank: 9, userId: 'u9', username: 'checkered', displayName: 'Checkered Flag', totalPoints: 172, previousRank: 8 },
  { rank: 10, userId: 'u10', username: 'turbolag', displayName: 'Turbo Lag', totalPoints: 158, previousRank: 10 },
];

/**
 * Real 2026 F1 season race results for completed races before Monaco.
 * Used as fallback when Supabase / live API don't return data.
 * Excludes: Bahrain (r04) and Saudi Arabia (r05) — both cancelled.
 * Upcoming: Monaco (r08+) — not included.
 *
 * Data sourced from official FIA / Formula1.com race classifications.
 */
export const MOCK_RACE_RESULTS: RaceResult[] = [
  // ── r01: Australian GP (2026-03-08) — GP only, no sprint ──
  {
    raceId: 'r01',
    classification: [
      { position: 1,  driverId: 'RUS', time: '1:23:06.801', gap: 'Leader',   points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'ANT', time: '1:23:09.775', gap: '+2.974s',   points: 18, status: 'finished' as const },
      { position: 3,  driverId: 'LEC', time: '1:23:22.320', gap: '+15.519s',  points: 15, status: 'finished' as const },
      { position: 4,  driverId: 'HAM', time: '1:23:22.945', gap: '+16.144s',  points: 12, status: 'finished' as const },
      { position: 5,  driverId: 'NOR', time: '1:23:58.542', gap: '+51.741s',  points: 10, status: 'finished' as const },
      { position: 6,  driverId: 'VER', time: '1:24:01.418', gap: '+54.617s',  points: 8,  status: 'finished' as const },
      { position: 7,  driverId: 'BEA', time: '1:23:11.394', gap: '+1 lap',    points: 6,  status: 'finished' as const },
      { position: 8,  driverId: 'LIN', time: '1:23:18.617', gap: '+1 lap',    points: 4,  status: 'finished' as const },
      { position: 9,  driverId: 'BOR', time: '1:23:19.576', gap: '+1 lap',    points: 2,  status: 'finished' as const },
      { position: 10, driverId: 'GAS', time: '1:23:35.828', gap: '+1 lap',    points: 1,  status: 'finished' as const },
      { position: 11, driverId: 'OCO', time: '1:23:36.651', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 12, driverId: 'ALB', time: '1:24:02.876', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 13, driverId: 'LAW', time: '1:24:03.974', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 14, driverId: 'COL', time: '1:23:15.288', gap: '+2 laps',   points: 0,  status: 'finished' as const },
      { position: 15, driverId: 'SAI', time: '1:23:43.687', gap: '+2 laps',   points: 0,  status: 'finished' as const },
      { position: 16, driverId: 'PER', time: '1:23:--',     gap: '+3 laps',   points: 0,  status: 'finished' as const },
      { position: 17, driverId: 'STR', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 18, driverId: 'ALO', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 19, driverId: 'BOT', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 20, driverId: 'HAD', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 21, driverId: 'PIA', time: '',             gap: 'DNS',       points: 0,  status: 'dnf' as const },
      { position: 22, driverId: 'HUL', time: '',             gap: 'DNS',       points: 0,  status: 'dnf' as const },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['STR', 'ALO', 'BOT', 'HAD', 'PIA', 'HUL'],
  },

  // ── r02: Chinese GP (2026-03-15) — Sprint + GP ──
  {
    raceId: 'r02',
    classification: [
      { position: 1,  driverId: 'ANT', time: '1:33:15.607', gap: 'Leader',   points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'RUS', time: '1:33:21.122', gap: '+5.515s',   points: 18, status: 'finished' as const },
      { position: 3,  driverId: 'HAM', time: '1:33:40.874', gap: '+25.267s',  points: 15, status: 'finished' as const },
      { position: 4,  driverId: 'LEC', time: '1:33:44.501', gap: '+28.894s',  points: 12, status: 'finished' as const },
      { position: 5,  driverId: 'BEA', time: '1:34:12.875', gap: '+57.268s',  points: 10, status: 'finished' as const },
      { position: 6,  driverId: 'GAS', time: '1:34:15.254', gap: '+59.647s',  points: 8,  status: 'finished' as const },
      { position: 7,  driverId: 'LAW', time: '1:34:36.195', gap: '+80.588s',  points: 6,  status: 'finished' as const },
      { position: 8,  driverId: 'HAD', time: '1:34:42.854', gap: '+87.247s',  points: 4,  status: 'finished' as const },
      { position: 9,  driverId: 'SAI', time: '1:33:27.280', gap: '+1 lap',    points: 2,  status: 'finished' as const },
      { position: 10, driverId: 'COL', time: '1:33:28.010', gap: '+1 lap',    points: 1,  status: 'finished' as const },
      { position: 11, driverId: 'HUL', time: '1:33:36.716', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 12, driverId: 'LIN', time: '1:33:38.435', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 13, driverId: 'BOT', time: '1:34:11.765', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 14, driverId: 'OCO', time: '1:34:21.863', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 15, driverId: 'PER', time: '1:34:30.248', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 16, driverId: 'VER', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 17, driverId: 'ALO', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 18, driverId: 'STR', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 19, driverId: 'PIA', time: '',             gap: 'DNS',       points: 0,  status: 'dns' as const },
      { position: 20, driverId: 'NOR', time: '',             gap: 'DNS',       points: 0,  status: 'dns' as const },
      { position: 21, driverId: 'BOR', time: '',             gap: 'DNS',       points: 0,  status: 'dns' as const },
      { position: 22, driverId: 'ALB', time: '',             gap: 'DNS',       points: 0,  status: 'dns' as const },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['VER', 'ALO', 'STR', 'PIA', 'NOR', 'BOR', 'ALB'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', time: '33:38.998', gap: 'Leader',  points: 8, status: 'finished' as const },
      { position: 2, driverId: 'LEC', time: '33:39.672', gap: '+0.674s',  points: 7, status: 'finished' as const },
      { position: 3, driverId: 'HAM', time: '33:41.552', gap: '+2.554s',  points: 6, status: 'finished' as const },
      { position: 4, driverId: 'NOR', time: '33:43.431', gap: '+4.433s',  points: 5, status: 'finished' as const },
      { position: 5, driverId: 'ANT', time: '33:44.686', gap: '+5.688s',  points: 4, status: 'finished' as const },
      { position: 6, driverId: 'PIA', time: '33:45.807', gap: '+6.809s',  points: 3, status: 'finished' as const },
      { position: 7, driverId: 'LAW', time: '33:49.898', gap: '+10.900s', points: 2, status: 'finished' as const },
      { position: 8, driverId: 'BEA', time: '33:50.269', gap: '+11.271s', points: 1, status: 'finished' as const },
    ],
  },

  // ── r03: Japanese GP (2026-03-29) — GP only, no sprint ──
  {
    raceId: 'r03',
    classification: [
      { position: 1,  driverId: 'ANT', time: '1:28:03.403', gap: 'Leader',   points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'PIA', time: '1:28:17.125', gap: '+13.722s',  points: 18, status: 'finished' as const },
      { position: 3,  driverId: 'LEC', time: '1:28:18.673', gap: '+15.270s',  points: 15, status: 'finished' as const },
      { position: 4,  driverId: 'RUS', time: '1:28:19.157', gap: '+15.754s',  points: 12, status: 'finished' as const },
      { position: 5,  driverId: 'NOR', time: '1:28:26.882', gap: '+23.479s',  points: 10, status: 'finished' as const },
      { position: 6,  driverId: 'HAM', time: '1:28:28.440', gap: '+25.037s',  points: 8,  status: 'finished' as const },
      { position: 7,  driverId: 'GAS', time: '1:28:35.743', gap: '+32.340s',  points: 6,  status: 'finished' as const },
      { position: 8,  driverId: 'VER', time: '1:28:36.080', gap: '+32.677s',  points: 4,  status: 'finished' as const },
      { position: 9,  driverId: 'LAW', time: '1:28:53.583', gap: '+50.180s',  points: 2,  status: 'finished' as const },
      { position: 10, driverId: 'OCO', time: '1:28:54.619', gap: '+51.216s',  points: 1,  status: 'finished' as const },
      { position: 11, driverId: 'HUL', time: '1:28:55.683', gap: '+52.280s',  points: 0,  status: 'finished' as const },
      { position: 12, driverId: 'HAD', time: '1:28:59.557', gap: '+56.154s',  points: 0,  status: 'finished' as const },
      { position: 13, driverId: 'BOR', time: '1:29:02.481', gap: '+59.078s',  points: 0,  status: 'finished' as const },
      { position: 14, driverId: 'LIN', time: '1:29:03.251', gap: '+59.848s',  points: 0,  status: 'finished' as const },
      { position: 15, driverId: 'SAI', time: '1:29:08.411', gap: '+65.008s',  points: 0,  status: 'finished' as const },
      { position: 16, driverId: 'COL', time: '1:29:09.176', gap: '+65.773s',  points: 0,  status: 'finished' as const },
      { position: 17, driverId: 'PER', time: '1:29:35.856', gap: '+92.453s',  points: 0,  status: 'finished' as const },
      { position: 18, driverId: 'ALO', time: '1:28:--',     gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 19, driverId: 'BOT', time: '1:28:--',     gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 20, driverId: 'ALB', time: '1:28:--',     gap: '+2 laps',   points: 0,  status: 'finished' as const },
      { position: 21, driverId: 'STR', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 22, driverId: 'BEA', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['STR', 'BEA'],
  },

  // ── r06: Miami GP (2026-05-03) — Sprint + GP ──
  {
    raceId: 'r06',
    classification: [
      { position: 1,  driverId: 'ANT', time: '1:33:19.273', gap: 'Leader',   points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'NOR', time: '1:33:22.537', gap: '+3.264s',   points: 18, status: 'finished' as const },
      { position: 3,  driverId: 'PIA', time: '1:33:46.365', gap: '+27.092s',  points: 15, status: 'finished' as const },
      { position: 4,  driverId: 'RUS', time: '1:34:02.324', gap: '+43.051s',  points: 12, status: 'finished' as const },
      { position: 5,  driverId: 'VER', time: '1:34:03.222', gap: '+43.949s',  points: 10, status: 'finished' as const },
      { position: 6,  driverId: 'HAM', time: '1:34:13.026', gap: '+53.753s',  points: 8,  status: 'finished' as const },
      { position: 7,  driverId: 'COL', time: '1:34:21.144', gap: '+61.871s',  points: 6,  status: 'finished' as const },
      { position: 8,  driverId: 'LEC', time: '1:34:23.518', gap: '+64.245s',  points: 4,  status: 'finished' as const },
      { position: 9,  driverId: 'SAI', time: '1:34:41.345', gap: '+82.072s',  points: 2,  status: 'finished' as const },
      { position: 10, driverId: 'ALB', time: '1:34:50.245', gap: '+90.972s',  points: 1,  status: 'finished' as const },
      { position: 11, driverId: 'BEA', time: '1:33:25.673', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 12, driverId: 'BOR', time: '1:33:28.626', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 13, driverId: 'OCO', time: '1:33:33.146', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 14, driverId: 'LIN', time: '1:34:04.054', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 15, driverId: 'ALO', time: '1:34:34.237', gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 16, driverId: 'PER', time: '1:34:--',     gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 17, driverId: 'STR', time: '1:34:--',     gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 18, driverId: 'BOT', time: '1:35:--',     gap: '+2 laps',   points: 0,  status: 'finished' as const },
      { position: 19, driverId: 'HUL', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 20, driverId: 'LAW', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 21, driverId: 'GAS', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 22, driverId: 'HAD', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
    ],
    fastestLapDriverId: 'NOR',
    dnfDriverIds: ['HUL', 'LAW', 'GAS', 'HAD'],
    sprintClassification: [
      { position: 1, driverId: 'NOR', time: '29:15.045', gap: 'Leader',   points: 8, status: 'finished' as const },
      { position: 2, driverId: 'PIA', time: '29:18.811', gap: '+3.766s',   points: 7, status: 'finished' as const },
      { position: 3, driverId: 'LEC', time: '29:21.296', gap: '+6.251s',   points: 6, status: 'finished' as const },
      { position: 4, driverId: 'RUS', time: '29:27.996', gap: '+12.951s',  points: 5, status: 'finished' as const },
      { position: 5, driverId: 'VER', time: '29:28.684', gap: '+13.639s',  points: 4, status: 'finished' as const },
      { position: 6, driverId: 'ANT', time: '29:28.822', gap: '+13.777s',  points: 3, status: 'finished' as const },
      { position: 7, driverId: 'HAM', time: '29:36.710', gap: '+21.665s',  points: 2, status: 'finished' as const },
      { position: 8, driverId: 'GAS', time: '29:45.570', gap: '+30.525s',  points: 1, status: 'finished' as const },
    ],
  },

  // ── r07: Canadian GP (2026-05-24) — Sprint + GP ──
  {
    raceId: 'r07',
    classification: [
      { position: 1,  driverId: 'ANT', time: '1:28:15.758', gap: 'Leader',   points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'HAM', time: '1:28:26.526', gap: '+10.768s',  points: 18, status: 'finished' as const },
      { position: 3,  driverId: 'VER', time: '1:28:27.034', gap: '+11.276s',  points: 15, status: 'finished' as const },
      { position: 4,  driverId: 'LEC', time: '1:28:59.909', gap: '+44.151s',  points: 12, status: 'finished' as const },
      { position: 5,  driverId: 'HAD', time: '1:28:20.791', gap: '+1 lap',    points: 10, status: 'finished' as const },
      { position: 6,  driverId: 'COL', time: '1:28:35.268', gap: '+1 lap',    points: 8,  status: 'finished' as const },
      { position: 7,  driverId: 'LAW', time: '1:28:49.993', gap: '+1 lap',    points: 6,  status: 'finished' as const },
      { position: 8,  driverId: 'GAS', time: '1:28:50.330', gap: '+1 lap',    points: 4,  status: 'finished' as const },
      { position: 9,  driverId: 'SAI', time: '1:29:13.772', gap: '+1 lap',    points: 2,  status: 'finished' as const },
      { position: 10, driverId: 'BEA', time: '1:29:14.807', gap: '+1 lap',    points: 1,  status: 'finished' as const },
      { position: 11, driverId: 'PIA', time: '1:28:28.457', gap: '+2 laps',   points: 0,  status: 'finished' as const },
      { position: 12, driverId: 'HUL', time: '1:28:29.940', gap: '+2 laps',   points: 0,  status: 'finished' as const },
      { position: 13, driverId: 'BOR', time: '1:28:36.914', gap: '+2 laps',   points: 0,  status: 'finished' as const },
      { position: 14, driverId: 'OCO', time: '1:29:24.393', gap: '+2 laps',   points: 0,  status: 'finished' as const },
      { position: 15, driverId: 'STR', time: '1:28:34.155', gap: '+4 laps',   points: 0,  status: 'finished' as const },
      { position: 16, driverId: 'BOT', time: '1:28:--',     gap: '+4 laps',   points: 0,  status: 'finished' as const },
      { position: 17, driverId: 'PER', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 18, driverId: 'NOR', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 19, driverId: 'RUS', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 20, driverId: 'ALO', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 21, driverId: 'ALB', time: '',             gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 22, driverId: 'LIN', time: '',             gap: 'DNS',       points: 0,  status: 'dnf' as const },
    ],
    fastestLapDriverId: 'ANT',
    dnfDriverIds: ['PER', 'NOR', 'RUS', 'ALO', 'ALB', 'LIN'],
    sprintClassification: [
      { position: 1, driverId: 'RUS', time: '28:50.951', gap: 'Leader',   points: 8, status: 'finished' as const },
      { position: 2, driverId: 'NOR', time: '28:52.223', gap: '+1.272s',   points: 7, status: 'finished' as const },
      { position: 3, driverId: 'ANT', time: '28:52.794', gap: '+1.843s',   points: 6, status: 'finished' as const },
      { position: 4, driverId: 'PIA', time: '29:00.748', gap: '+9.797s',   points: 5, status: 'finished' as const },
      { position: 5, driverId: 'LEC', time: '29:00.880', gap: '+9.929s',   points: 4, status: 'finished' as const },
      { position: 6, driverId: 'HAM', time: '29:01.496', gap: '+10.545s',  points: 3, status: 'finished' as const },
      { position: 7, driverId: 'VER', time: '29:06.886', gap: '+15.935s',  points: 2, status: 'finished' as const },
      { position: 8, driverId: 'LIN', time: '29:20.661', gap: '+29.710s',  points: 1, status: 'finished' as const },
    ],
  },
];

export function getTeamById(id: string): Team | undefined {
  return TEAMS.find(t => t.id === id);
}

export function getDriverById(id: string): Driver | undefined {
  return DRIVERS.find(d => d.id === id);
}

export function getNextRace(): Race | undefined {
  return RACES.find(r => r.status === 'upcoming');
}

export function getRaceById(id: string): Race | undefined {
  return RACES.find(r => r.id === id);
}
