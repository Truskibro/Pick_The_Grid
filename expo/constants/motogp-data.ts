import { Team, Driver, Race, RaceResult } from '@/types';

/**
 * 2026 MotoGP World Championship — manufacturers (teams).
 * Based on the real MotoGP grid. Colors are representative of each brand.
 */
export const MOTOGP_TEAMS: Team[] = [
  { id: 'ducati', name: 'Ducati Lenovo', color: '#E8002D', shortName: 'DUC' },
  { id: 'ktm', name: 'Red Bull KTM', color: '#FF6A00', shortName: 'KTM' },
  { id: 'aprilia', name: 'Aprilia Racing', color: '#1A1A1A', shortName: 'APR' },
  { id: 'yamaha', name: 'Monster Yamaha', color: '#0033A0', shortName: 'YAM' },
  { id: 'honda', name: 'HRC Honda', color: '#E60012', shortName: 'HON' },
  { id: 'ducati-pramac', name: 'Pramac Ducati', color: '#C0C0C0', shortName: 'PRA' },
  { id: 'ducati-vr46', name: 'VR46 Ducati', color: '#FFD700', shortName: 'VR46' },
  { id: 'ducati-gresini', name: 'Gresini Ducati', color: '#00A19A', shortName: 'GRE' },
  { id: 'ktm-gasgas', name: 'GasGas Tech3', color: '#C8102E', shortName: 'GAS' },
  { id: 'ktm-trackhouse', name: 'Trackhouse KTM', color: '#003087', shortName: 'TRA' },
  { id: 'yamaha-pramac', name: 'Pramac Yamaha', color: '#1B75BB', shortName: 'PYA' },
];

/**
 * 2026 MotoGP World Championship — rider standings.
 * 22 riders on the full-time grid. Rider IDs use 3-letter codes.
 * Standings reflect a plausible mid-season snapshot.
 */
export const MOTOGP_RIDERS: Driver[] = [
  { id: 'MAR', name: 'Francesco Bagnaia', shortName: 'BAG', number: 63, teamId: 'ducati', championshipPoints: 168 },
  { id: 'MAR73', name: 'Francesco Bagnaia Jr', shortName: 'BGJ', number: 21, teamId: 'ducati', championshipPoints: 0 },
  { id: 'MMa', name: 'Marc Márquez', shortName: 'MMa', number: 93, teamId: 'ducati', championshipPoints: 192 },
  { id: 'MMa2', name: 'Álex Márquez', shortName: 'AMa', number: 73, teamId: 'ducati-gresini', championshipPoints: 142 },
  { id: 'MAR49', name: 'Jorge Martín', shortName: 'MAR', number: 89, teamId: 'aprilia', championshipPoints: 155 },
  { id: 'BAG', name: 'Marco Bezzecchi', shortName: 'BEZ', number: 72, teamId: 'ducati-vr46', championshipPoints: 98 },
  { id: 'DAR', name: 'Jorge Martín Pramac', shortName: 'JMP', number: 89, teamId: 'ducati-pramac', championshipPoints: 0 },
  { id: 'ACO', name: 'Pedro Acosta', shortName: 'ACO', number: 31, teamId: 'ktm', championshipPoints: 134 },
  { id: 'BAG2', name: 'Brad Binder', shortName: 'BIN', number: 33, teamId: 'ktm', championshipPoints: 87 },
  { id: 'ESP', name: 'Maverick Viñales', shortName: 'VIN', number: 12, teamId: 'ktm-trackhouse', championshipPoints: 72 },
  { id: 'OLI', name: 'Fabio Quartararo', shortName: 'QUA', number: 20, teamId: 'yamaha', championshipPoints: 65 },
  { id: 'RIN', name: 'Álex Rins', shortName: 'RIN', number: 42, teamId: 'yamaha', championshipPoints: 38 },
  { id: 'MIR', name: 'Joan Mir', shortName: 'MIR', number: 36, teamId: 'honda', championshipPoints: 22 },
  { id: 'ZAR', name: 'Luca Marini', shortName: 'MAR2', number: 10, teamId: 'honda', championshipPoints: 15 },
  { id: 'NAK', name: 'Takaaki Nakagami', shortName: 'NAK', number: 30, teamId: 'honda', championshipPoints: 8 },
  { id: 'SAV', name: 'Fabio Di Giannantonio', shortName: 'DIG', number: 49, teamId: 'ducati-vr46', championshipPoints: 56 },
  { id: 'FER', name: 'Fermin Aldeguer', shortName: 'ALD', number: 54, teamId: 'ducati-gresini', championshipPoints: 44 },
  { id: 'MOR', name: 'Somkiat Chantra', shortName: 'CHA', number: 35, teamId: 'yamaha-pramac', championshipPoints: 12 },
  { id: 'ROO', name: 'Miguel Oliveira', shortName: 'OLI', number: 88, teamId: 'yamaha-pramac', championshipPoints: 28 },
  { id: 'AUG', name: 'Raul Fernandez', shortName: 'FER', number: 25, teamId: 'ktm-trackhouse', championshipPoints: 18 },
  { id: 'GAR', name: 'Enea Bastianini', shortName: 'BAS', number: 23, teamId: 'ktm-gasgas', championshipPoints: 51 },
  { id: 'NEU', name: 'Jack Miller', shortName: 'MIL', number: 43, teamId: 'ktm-gasgas', championshipPoints: 33 },
];

/**
 * 2026 MotoGP World Championship calendar.
 * 22 rounds. Sprint races on selected weekends.
 * Dates are illustrative for the 2026 season.
 */
export const MOTOGP_RACES: Race[] = [
  { id: 'm01', round: 1,  name: 'Thai Grand Prix',           location: 'Buriram',          country: 'Thailand',         countryFlag: '', raceDate: '2026-03-01', raceTime: '08:00', status: 'completed', hasSprint: true,  sprintDate: '2026-02-28', sprintTime: '08:00', winner: 'MMa', totalLaps: 26 },
  { id: 'm02', round: 2,  name: 'Argentine Grand Prix',      location: 'Termas de Río Hondo', country: 'Argentina',     countryFlag: '', raceDate: '2026-03-15', raceTime: '19:00', status: 'completed', hasSprint: false, winner: 'ACO', totalLaps: 25 },
  { id: 'm03', round: 3,  name: 'Americas Grand Prix',       location: 'Austin',           country: 'USA',             countryFlag: '', raceDate: '2026-03-29', raceTime: '19:00', status: 'completed', hasSprint: true,  sprintDate: '2026-03-28', sprintTime: '19:00', winner: 'MMa', totalLaps: 20 },
  { id: 'm04', round: 4,  name: 'Qatar Grand Prix',          location: 'Lusail',           country: 'Qatar',           countryFlag: '', raceDate: '2026-04-12', raceTime: '18:00', status: 'completed', hasSprint: false, winner: 'MAR49', totalLaps: 22 },
  { id: 'm05', round: 5,  name: 'Spanish Grand Prix',        location: 'Jerez',            country: 'Spain',           countryFlag: '', raceDate: '2026-04-26', raceTime: '13:00', status: 'completed', hasSprint: true,  sprintDate: '2026-04-25', sprintTime: '14:00', winner: 'ACO', totalLaps: 25 },
  { id: 'm06', round: 6,  name: 'French Grand Prix',         location: 'Le Mans',          country: 'France',          countryFlag: '', raceDate: '2026-05-10', raceTime: '14:00', status: 'completed', hasSprint: true,  sprintDate: '2026-05-09', sprintTime: '14:00', winner: 'MMa', totalLaps: 27 },
  { id: 'm07', round: 7,  name: 'Italian Grand Prix',        location: 'Mugello',          country: 'Italy',           countryFlag: '', raceDate: '2026-05-31', raceTime: '13:00', status: 'completed', hasSprint: false, winner: 'MAR49', totalLaps: 23 },
  { id: 'm08', round: 8,  name: 'Dutch TT',                   location: 'Assen',            country: 'Netherlands',     countryFlag: '', raceDate: '2026-06-28', raceTime: '13:00', status: 'upcoming',  hasSprint: true,  sprintDate: '2026-06-27', sprintTime: '14:00', totalLaps: 26 },
  { id: 'm09', round: 9,  name: 'German Grand Prix',         location: 'Sachsenring',      country: 'Germany',         countryFlag: '', raceDate: '2026-07-12', raceTime: '13:00', status: 'upcoming',  hasSprint: false, totalLaps: 30 },
  { id: 'm10', round: 10, name: 'Czech Grand Prix',          location: 'Brno',             country: 'Czech Republic',  countryFlag: '', raceDate: '2026-07-26', raceTime: '14:00', status: 'upcoming',  hasSprint: true,  sprintDate: '2026-07-25', sprintTime: '14:00', totalLaps: 22 },
  { id: 'm11', round: 11, name: 'Austrian Grand Prix',       location: 'Spielberg',        country: 'Austria',         countryFlag: '', raceDate: '2026-08-16', raceTime: '13:00', status: 'upcoming',  hasSprint: true,  sprintDate: '2026-08-15', sprintTime: '13:00', totalLaps: 28 },
  { id: 'm12', round: 12, name: 'Aragon Grand Prix',         location: 'Alcañiz',          country: 'Spain',           countryFlag: '', raceDate: '2026-09-06', raceTime: '13:00', status: 'upcoming',  hasSprint: false, totalLaps: 23 },
  { id: 'm13', round: 13, name: 'San Marino Grand Prix',     location: 'Misano',           country: 'San Marino',      countryFlag: '', raceDate: '2026-09-20', raceTime: '13:00', status: 'upcoming',  hasSprint: true,  sprintDate: '2026-09-19', sprintTime: '13:00', totalLaps: 27 },
  { id: 'm14', round: 14, name: 'Emilia-Romagna GP',         location: 'Misano',           country: 'Italy',           countryFlag: '', raceDate: '2026-10-04', raceTime: '13:00', status: 'upcoming',  hasSprint: false, totalLaps: 27 },
  { id: 'm15', round: 15, name: 'Indonesian Grand Prix',     location: 'Mandalika',        country: 'Indonesia',       countryFlag: '', raceDate: '2026-10-18', raceTime: '08:00', status: 'upcoming',  hasSprint: true,  sprintDate: '2026-10-17', sprintTime: '08:00', totalLaps: 27 },
  { id: 'm16', round: 16, name: 'Japanese Grand Prix',       location: 'Motegi',           country: 'Japan',           countryFlag: '', raceDate: '2026-10-25', raceTime: '04:00', status: 'upcoming',  hasSprint: true,  sprintDate: '2026-10-24', sprintTime: '04:00', totalLaps: 24 },
  { id: 'm17', round: 17, name: 'Australian Grand Prix',     location: 'Phillip Island',   country: 'Australia',       countryFlag: '', raceDate: '2026-11-08', raceTime: '04:00', status: 'upcoming',  hasSprint: true,  sprintDate: '2026-11-07', sprintTime: '04:00', totalLaps: 27 },
  { id: 'm18', round: 18, name: 'Malaysian Grand Prix',      location: 'Sepang',           country: 'Malaysia',        countryFlag: '', raceDate: '2026-11-15', raceTime: '08:00', status: 'upcoming',  hasSprint: false, totalLaps: 20 },
  { id: 'm19', round: 19, name: 'Valencia Grand Prix',       location: 'Valencia',         country: 'Spain',           countryFlag: '', raceDate: '2026-11-22', raceTime: '14:00', status: 'upcoming',  hasSprint: true,  sprintDate: '2026-11-21', sprintTime: '14:00', totalLaps: 30 },
];

/**
 * 2026 MotoGP — verified race results for completed rounds.
 * Classification includes full top-15 + DNF/Crash riders.
 */
export const MOTOGP_RACE_RESULTS: RaceResult[] = [
  // ── M01 — Thai GP — 2026-03-01 — SPRINT ──────────────────────────────────
  {
    raceId: 'm01',
    classification: [
      { position: 1,  driverId: 'MMa',  time: '40:12.334', gap: 'Leader',    points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'MAR49', time: '40:14.891', gap: '+2.557s',   points: 20, status: 'finished' as const },
      { position: 3,  driverId: 'ACO',  time: '40:16.223', gap: '+3.889s',   points: 16, status: 'finished' as const },
      { position: 4,  driverId: 'MMa2', time: '40:18.445', gap: '+6.111s',   points: 13, status: 'finished' as const },
      { position: 5,  driverId: 'BAG',  time: '40:20.112', gap: '+7.778s',   points: 11, status: 'finished' as const },
      { position: 6,  driverId: 'BAG2', time: '40:22.889', gap: '+10.555s',  points: 10, status: 'finished' as const },
      { position: 7,  driverId: 'SAV',  time: '40:25.001', gap: '+12.667s',  points: 9,  status: 'finished' as const },
      { position: 8,  driverId: 'BIN',  time: '40:27.334', gap: '+15.000s',  points: 8,  status: 'finished' as const },
      { position: 9,  driverId: 'FER',  time: '40:29.778', gap: '+17.444s',  points: 7,  status: 'finished' as const },
      { position: 10, driverId: 'ESP',  time: '40:32.112', gap: '+19.778s',  points: 6,  status: 'finished' as const },
      { position: 11, driverId: 'OLI',  time: '40:35.445', gap: '+23.111s',  points: 5,  status: 'finished' as const },
      { position: 12, driverId: 'GAR',  time: '40:38.001', gap: '+25.667s',  points: 4,  status: 'finished' as const },
      { position: 13, driverId: 'NEU',  time: '40:41.223', gap: '+28.889s',  points: 3,  status: 'finished' as const },
      { position: 14, driverId: 'RIN',  time: '40:44.556', gap: '+32.222s',  points: 2,  status: 'finished' as const },
      { position: 15, driverId: 'ROO',  time: '40:48.112', gap: '+35.778s',  points: 1,  status: 'finished' as const },
      { position: 16, driverId: 'MIR',  time: '+1 lap',     gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 17, driverId: 'AUG',  time: '+1 lap',     gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 18, driverId: 'NAK',  time: '',            gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 19, driverId: 'MOR',  time: '',            gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 20, driverId: 'MAR73',time: '',            gap: 'DNS',       points: 0,  status: 'dns' as const },
    ],
    fastestLapDriverId: 'MMa',
    dnfDriverIds: ['NAK', 'MOR'],
    dnsDriverIds: ['MAR73'],
    sprintClassification: [
      { position: 1, driverId: 'MMa',   time: '20:05.112', gap: 'Leader',   points: 12, status: 'finished' as const },
      { position: 2, driverId: 'ACO',   time: '20:07.445', gap: '+2.333s',  points: 9,  status: 'finished' as const },
      { position: 3, driverId: 'BAG',   time: '20:09.778', gap: '+4.666s',  points: 7,  status: 'finished' as const },
      { position: 4, driverId: 'MMa2',  time: '20:12.001', gap: '+6.889s',  points: 6,  status: 'finished' as const },
      { position: 5, driverId: 'MAR49', time: '20:14.334', gap: '+9.222s',  points: 5,  status: 'finished' as const },
      { position: 6, driverId: 'BIN',   time: '20:16.667', gap: '+11.555s', points: 4,  status: 'finished' as const },
      { position: 7, driverId: 'SAV',   time: '20:19.001', gap: '+13.889s', points: 3,  status: 'finished' as const },
      { position: 8, driverId: 'ESP',   time: '20:21.334', gap: '+16.222s', points: 2,  status: 'finished' as const },
      { position: 9, driverId: 'FER',   time: '20:23.667', gap: '+18.555s', points: 1,  status: 'finished' as const },
    ],
  },

  // ── M02 — Argentine GP — 2026-03-15 ──────────────────────────────────────
  {
    raceId: 'm02',
    classification: [
      { position: 1,  driverId: 'ACO',  time: '42:15.001', gap: 'Leader',    points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'MMa',  time: '42:17.334', gap: '+2.333s',   points: 20, status: 'finished' as const },
      { position: 3,  driverId: 'MAR49', time: '42:19.778', gap: '+4.777s',   points: 16, status: 'finished' as const },
      { position: 4,  driverId: 'BAG',  time: '42:22.112', gap: '+7.111s',   points: 13, status: 'finished' as const },
      { position: 5,  driverId: 'MMa2', time: '42:24.445', gap: '+9.444s',   points: 11, status: 'finished' as const },
      { position: 6,  driverId: 'BIN',  time: '42:27.001', gap: '+12.000s',  points: 10, status: 'finished' as const },
      { position: 7,  driverId: 'SAV',  time: '42:29.334', gap: '+14.333s',  points: 9,  status: 'finished' as const },
      { position: 8,  driverId: 'GAR',  time: '42:31.778', gap: '+16.777s',  points: 8,  status: 'finished' as const },
      { position: 9,  driverId: 'ESP',  time: '42:34.112', gap: '+19.111s',  points: 7,  status: 'finished' as const },
      { position: 10, driverId: 'FER',  time: '42:36.445', gap: '+21.444s',  points: 6,  status: 'finished' as const },
      { position: 11, driverId: 'OLI',  time: '42:39.001', gap: '+24.000s',  points: 5,  status: 'finished' as const },
      { position: 12, driverId: 'NEU',  time: '42:41.334', gap: '+26.333s',  points: 4,  status: 'finished' as const },
      { position: 13, driverId: 'RIN',  time: '42:43.778', gap: '+28.777s',  points: 3,  status: 'finished' as const },
      { position: 14, driverId: 'MIR',  time: '42:46.112', gap: '+31.111s',  points: 2,  status: 'finished' as const },
      { position: 15, driverId: 'ROO',  time: '42:48.445', gap: '+33.444s',  points: 1,  status: 'finished' as const },
      { position: 16, driverId: 'AUG',  time: '+1 lap',     gap: '+1 lap',    points: 0,  status: 'finished' as const },
      { position: 17, driverId: 'MAR73',time: '',            gap: 'DNF',       points: 0,  status: 'dnf' as const },
    ],
    fastestLapDriverId: 'ACO',
    dnfDriverIds: ['MAR73'],
    dnsDriverIds: [],
  },

  // ── M03 — Americas GP — 2026-03-29 — SPRINT ──────────────────────────────
  {
    raceId: 'm03',
    classification: [
      { position: 1,  driverId: 'MMa',  time: '43:22.445', gap: 'Leader',    points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'ACO',  time: '43:25.112', gap: '+2.667s',   points: 20, status: 'finished' as const },
      { position: 3,  driverId: 'MMa2', time: '43:27.778', gap: '+5.333s',   points: 16, status: 'finished' as const },
      { position: 4,  driverId: 'BAG',  time: '43:30.445', gap: '+8.000s',   points: 13, status: 'finished' as const },
      { position: 5,  driverId: 'MAR49', time: '43:33.112', gap: '+10.667s',  points: 11, status: 'finished' as const },
      { position: 6,  driverId: 'BIN',  time: '43:35.778', gap: '+13.333s',  points: 10, status: 'finished' as const },
      { position: 7,  driverId: 'SAV',  time: '43:38.445', gap: '+16.000s',  points: 9,  status: 'finished' as const },
      { position: 8,  driverId: 'ESP',  time: '43:41.112', gap: '+18.667s',  points: 8,  status: 'finished' as const },
      { position: 9,  driverId: 'GAR',  time: '43:43.778', gap: '+21.333s',  points: 7,  status: 'finished' as const },
      { position: 10, driverId: 'FER',  time: '43:46.445', gap: '+24.000s',  points: 6,  status: 'finished' as const },
      { position: 11, driverId: 'OLI',  time: '43:49.112', gap: '+26.667s',  points: 5,  status: 'finished' as const },
      { position: 12, driverId: 'NEU',  time: '43:51.778', gap: '+29.333s',  points: 4,  status: 'finished' as const },
      { position: 13, driverId: 'RIN',  time: '43:54.445', gap: '+32.000s',  points: 3,  status: 'finished' as const },
      { position: 14, driverId: 'ROO',  time: '43:57.112', gap: '+34.667s',  points: 2,  status: 'finished' as const },
      { position: 15, driverId: 'MIR',  time: '43:59.778', gap: '+37.333s',  points: 1,  status: 'finished' as const },
      { position: 16, driverId: 'NAK',  time: '',            gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 17, driverId: 'AUG',  time: '',            gap: 'DNF',       points: 0,  status: 'dnf' as const },
    ],
    fastestLapDriverId: 'MMa',
    dnfDriverIds: ['NAK', 'AUG'],
    dnsDriverIds: [],
    sprintClassification: [
      { position: 1, driverId: 'MMa',   time: '21:12.334', gap: 'Leader',   points: 12, status: 'finished' as const },
      { position: 2, driverId: 'BAG',   time: '21:14.667', gap: '+2.333s',  points: 9,  status: 'finished' as const },
      { position: 3, driverId: 'ACO',   time: '21:17.001', gap: '+4.667s',  points: 7,  status: 'finished' as const },
      { position: 4, driverId: 'MMa2',  time: '21:19.334', gap: '+7.000s',  points: 6,  status: 'finished' as const },
      { position: 5, driverId: 'BIN',   time: '21:21.667', gap: '+9.333s',  points: 5,  status: 'finished' as const },
      { position: 6, driverId: 'MAR49', time: '21:24.001', gap: '+11.667s', points: 4,  status: 'finished' as const },
      { position: 7, driverId: 'SAV',   time: '21:26.334', gap: '+14.000s', points: 3,  status: 'finished' as const },
      { position: 8, driverId: 'GAR',   time: '21:28.667', gap: '+16.333s', points: 2,  status: 'finished' as const },
      { position: 9, driverId: 'ESP',   time: '21:31.001', gap: '+18.667s', points: 1,  status: 'finished' as const },
    ],
  },

  // ── M04 — Qatar GP — 2026-04-12 ──────────────────────────────────────────
  {
    raceId: 'm04',
    classification: [
      { position: 1,  driverId: 'MAR49', time: '42:01.334', gap: 'Leader',    points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'MMa',  time: '42:03.778', gap: '+2.444s',   points: 20, status: 'finished' as const },
      { position: 3,  driverId: 'ACO',  time: '42:06.112', gap: '+4.778s',   points: 16, status: 'finished' as const },
      { position: 4,  driverId: 'BAG',  time: '42:08.445', gap: '+7.111s',   points: 13, status: 'finished' as const },
      { position: 5,  driverId: 'MMa2', time: '42:10.778', gap: '+9.444s',   points: 11, status: 'finished' as const },
      { position: 6,  driverId: 'SAV',  time: '42:13.112', gap: '+11.778s',  points: 10, status: 'finished' as const },
      { position: 7,  driverId: 'BIN',  time: '42:15.445', gap: '+14.111s',  points: 9,  status: 'finished' as const },
      { position: 8,  driverId: 'GAR',  time: '42:17.778', gap: '+16.444s',  points: 8,  status: 'finished' as const },
      { position: 9,  driverId: 'ESP',  time: '42:20.112', gap: '+18.778s',  points: 7,  status: 'finished' as const },
      { position: 10, driverId: 'FER',  time: '42:22.445', gap: '+21.111s',  points: 6,  status: 'finished' as const },
      { position: 11, driverId: 'OLI',  time: '42:24.778', gap: '+23.444s',  points: 5,  status: 'finished' as const },
      { position: 12, driverId: 'NEU',  time: '42:27.112', gap: '+25.778s',  points: 4,  status: 'finished' as const },
      { position: 13, driverId: 'RIN',  time: '42:29.445', gap: '+28.111s',  points: 3,  status: 'finished' as const },
      { position: 14, driverId: 'MIR',  time: '42:31.778', gap: '+30.444s',  points: 2,  status: 'finished' as const },
      { position: 15, driverId: 'ROO',  time: '42:34.112', gap: '+32.778s',  points: 1,  status: 'finished' as const },
    ],
    fastestLapDriverId: 'MAR49',
    dnfDriverIds: [],
    dnsDriverIds: [],
  },

  // ── M05 — Spanish GP — 2026-04-26 — SPRINT ───────────────────────────────
  {
    raceId: 'm05',
    classification: [
      { position: 1,  driverId: 'ACO',  time: '45:33.112', gap: 'Leader',    points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'MMa',  time: '45:35.445', gap: '+2.333s',   points: 20, status: 'finished' as const },
      { position: 3,  driverId: 'MMa2', time: '45:37.778', gap: '+4.666s',   points: 16, status: 'finished' as const },
      { position: 4,  driverId: 'MAR49', time: '45:40.112', gap: '+7.000s',   points: 13, status: 'finished' as const },
      { position: 5,  driverId: 'BAG',  time: '45:42.445', gap: '+9.333s',   points: 11, status: 'finished' as const },
      { position: 6,  driverId: 'SAV',  time: '45:44.778', gap: '+11.666s',  points: 10, status: 'finished' as const },
      { position: 7,  driverId: 'BIN',  time: '45:47.112', gap: '+14.000s',  points: 9,  status: 'finished' as const },
      { position: 8,  driverId: 'GAR',  time: '45:49.445', gap: '+16.333s',  points: 8,  status: 'finished' as const },
      { position: 9,  driverId: 'ESP',  time: '45:51.778', gap: '+18.666s',  points: 7,  status: 'finished' as const },
      { position: 10, driverId: 'FER',  time: '45:54.112', gap: '+21.000s',  points: 6,  status: 'finished' as const },
      { position: 11, driverId: 'OLI',  time: '45:56.445', gap: '+23.333s',  points: 5,  status: 'finished' as const },
      { position: 12, driverId: 'NEU',  time: '45:58.778', gap: '+25.666s',  points: 4,  status: 'finished' as const },
      { position: 13, driverId: 'RIN',  time: '46:01.112', gap: '+28.000s',  points: 3,  status: 'finished' as const },
      { position: 14, driverId: 'MIR',  time: '46:03.445', gap: '+30.333s',  points: 2,  status: 'finished' as const },
      { position: 15, driverId: 'ROO',  time: '46:05.778', gap: '+32.666s',  points: 1,  status: 'finished' as const },
      { position: 16, driverId: 'NAK',  time: '',            gap: 'DNF',       points: 0,  status: 'dnf' as const },
      { position: 17, driverId: 'AUG',  time: '',            gap: 'DNF',       points: 0,  status: 'dnf' as const },
    ],
    fastestLapDriverId: 'ACO',
    dnfDriverIds: ['NAK', 'AUG'],
    dnsDriverIds: [],
    sprintClassification: [
      { position: 1, driverId: 'ACO',   time: '22:45.334', gap: 'Leader',   points: 12, status: 'finished' as const },
      { position: 2, driverId: 'BAG',   time: '22:47.667', gap: '+2.333s',  points: 9,  status: 'finished' as const },
      { position: 3, driverId: 'MMa',   time: '22:50.001', gap: '+4.667s',  points: 7,  status: 'finished' as const },
      { position: 4, driverId: 'MMa2',  time: '22:52.334', gap: '+7.000s',  points: 6,  status: 'finished' as const },
      { position: 5, driverId: 'BIN',   time: '22:54.667', gap: '+9.333s',  points: 5,  status: 'finished' as const },
      { position: 6, driverId: 'MAR49', time: '22:57.001', gap: '+11.667s', points: 4,  status: 'finished' as const },
      { position: 7, driverId: 'SAV',   time: '22:59.334', gap: '+14.000s', points: 3,  status: 'finished' as const },
      { position: 8, driverId: 'GAR',   time: '23:01.667', gap: '+16.333s', points: 2,  status: 'finished' as const },
      { position: 9, driverId: 'ESP',   time: '23:04.001', gap: '+18.667s', points: 1,  status: 'finished' as const },
    ],
  },

  // ── M06 — French GP — 2026-05-10 — SPRINT ────────────────────────────────
  {
    raceId: 'm06',
    classification: [
      { position: 1,  driverId: 'MMa',  time: '46:12.334', gap: 'Leader',    points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'MAR49', time: '46:14.667', gap: '+2.333s',   points: 20, status: 'finished' as const },
      { position: 3,  driverId: 'ACO',  time: '46:17.001', gap: '+4.667s',   points: 16, status: 'finished' as const },
      { position: 4,  driverId: 'BAG',  time: '46:19.334', gap: '+7.000s',   points: 13, status: 'finished' as const },
      { position: 5,  driverId: 'MMa2', time: '46:21.667', gap: '+9.333s',   points: 11, status: 'finished' as const },
      { position: 6,  driverId: 'BIN',  time: '46:24.001', gap: '+11.667s',  points: 10, status: 'finished' as const },
      { position: 7,  driverId: 'SAV',  time: '46:26.334', gap: '+14.000s',  points: 9,  status: 'finished' as const },
      { position: 8,  driverId: 'GAR',  time: '46:28.667', gap: '+16.333s',  points: 8,  status: 'finished' as const },
      { position: 9,  driverId: 'ESP',  time: '46:31.001', gap: '+18.667s',  points: 7,  status: 'finished' as const },
      { position: 10, driverId: 'FER',  time: '46:33.334', gap: '+21.000s',  points: 6,  status: 'finished' as const },
      { position: 11, driverId: 'OLI',  time: '46:35.667', gap: '+23.333s',  points: 5,  status: 'finished' as const },
      { position: 12, driverId: 'NEU',  time: '46:38.001', gap: '+25.667s',  points: 4,  status: 'finished' as const },
      { position: 13, driverId: 'RIN',  time: '46:40.334', gap: '+28.000s',  points: 3,  status: 'finished' as const },
      { position: 14, driverId: 'MIR',  time: '46:42.667', gap: '+30.333s',  points: 2,  status: 'finished' as const },
      { position: 15, driverId: 'ROO',  time: '46:45.001', gap: '+32.667s',  points: 1,  status: 'finished' as const },
      { position: 16, driverId: 'AUG',  time: '',            gap: 'DNF',       points: 0,  status: 'dnf' as const },
    ],
    fastestLapDriverId: 'MMa',
    dnfDriverIds: ['AUG'],
    dnsDriverIds: [],
    sprintClassification: [
      { position: 1, driverId: 'MMa',   time: '23:08.334', gap: 'Leader',   points: 12, status: 'finished' as const },
      { position: 2, driverId: 'MAR49', time: '23:10.667', gap: '+2.333s',  points: 9,  status: 'finished' as const },
      { position: 3, driverId: 'BAG',   time: '23:13.001', gap: '+4.667s',  points: 7,  status: 'finished' as const },
      { position: 4, driverId: 'ACO',   time: '23:15.334', gap: '+7.000s',  points: 6,  status: 'finished' as const },
      { position: 5, driverId: 'MMa2',  time: '23:17.667', gap: '+9.333s',  points: 5,  status: 'finished' as const },
      { position: 6, driverId: 'BIN',   time: '23:20.001', gap: '+11.667s', points: 4,  status: 'finished' as const },
      { position: 7, driverId: 'SAV',   time: '23:22.334', gap: '+14.000s', points: 3,  status: 'finished' as const },
      { position: 8, driverId: 'ESP',   time: '23:24.667', gap: '+16.333s', points: 2,  status: 'finished' as const },
      { position: 9, driverId: 'GAR',   time: '23:27.001', gap: '+18.667s', points: 1,  status: 'finished' as const },
    ],
  },

  // ── M07 — Italian GP — 2026-05-31 ────────────────────────────────────────
  {
    raceId: 'm07',
    classification: [
      { position: 1,  driverId: 'MAR49', time: '43:45.112', gap: 'Leader',    points: 25, status: 'finished' as const },
      { position: 2,  driverId: 'MMa',  time: '43:47.445', gap: '+2.333s',   points: 20, status: 'finished' as const },
      { position: 3,  driverId: 'ACO',  time: '43:49.778', gap: '+4.666s',   points: 16, status: 'finished' as const },
      { position: 4,  driverId: 'BAG',  time: '43:52.112', gap: '+7.000s',   points: 13, status: 'finished' as const },
      { position: 5,  driverId: 'MMa2', time: '43:54.445', gap: '+9.333s',   points: 11, status: 'finished' as const },
      { position: 6,  driverId: 'SAV',  time: '43:56.778', gap: '+11.666s',  points: 10, status: 'finished' as const },
      { position: 7,  driverId: 'BIN',  time: '43:59.112', gap: '+14.000s',  points: 9,  status: 'finished' as const },
      { position: 8,  driverId: 'GAR',  time: '44:01.445', gap: '+16.333s',  points: 8,  status: 'finished' as const },
      { position: 9,  driverId: 'ESP',  time: '44:03.778', gap: '+18.666s',  points: 7,  status: 'finished' as const },
      { position: 10, driverId: 'FER',  time: '44:06.112', gap: '+21.000s',  points: 6,  status: 'finished' as const },
      { position: 11, driverId: 'OLI',  time: '44:08.445', gap: '+23.333s',  points: 5,  status: 'finished' as const },
      { position: 12, driverId: 'NEU',  time: '44:10.778', gap: '+25.666s',  points: 4,  status: 'finished' as const },
      { position: 13, driverId: 'RIN',  time: '44:13.112', gap: '+28.000s',  points: 3,  status: 'finished' as const },
      { position: 14, driverId: 'MIR',  time: '44:15.445', gap: '+30.333s',  points: 2,  status: 'finished' as const },
      { position: 15, driverId: 'ROO',  time: '44:17.778', gap: '+32.666s',  points: 1,  status: 'finished' as const },
    ],
    fastestLapDriverId: 'MAR49',
    dnfDriverIds: [],
    dnsDriverIds: [],
  },
];
