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
  { id: 'r04', round: 4, name: 'Bahrain Grand Prix', location: 'Sakhir', country: 'Bahrain', countryFlag: '🇧🇭', raceDate: '2026-04-12', raceTime: '16:00', status: 'upcoming', hasSprint: false, totalLaps: 57 },
  { id: 'r05', round: 5, name: 'Saudi Arabian Grand Prix', location: 'Jeddah', country: 'Saudi Arabia', countryFlag: '🇸🇦', raceDate: '2026-04-19', raceTime: '18:00', status: 'upcoming', hasSprint: false, totalLaps: 50 },
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

export const MOCK_RACE_RESULTS: RaceResult[] = [];

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
