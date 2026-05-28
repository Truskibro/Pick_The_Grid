export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  if (path.includes('join?league=')) {
    const leagueId = path.split('league=')[1];
    if (leagueId) {
      return `/join-league`;
    }
  }
  return '/';
}
