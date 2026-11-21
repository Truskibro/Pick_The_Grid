import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Swords, TrendingUp, Zap } from 'lucide-react-native';

import Colors from '@/constants/colors';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSeries } from '@/providers/SeriesProvider';
import { useUser } from '@/providers/UserProvider';
import { getSeriesConfig } from '@/constants/series';

interface HeadToHeadRow {
  raceId: string;
  raceName: string;
  round: number;
  sprint: boolean;
  myPoints: number;
  theirPoints: number;
}

interface HeadToHeadSummary {
  rows: HeadToHeadRow[];
  myTotal: number;
  theirTotal: number;
  myWins: number;
  theirWins: number;
  ties: number;
  myBest: HeadToHeadRow | null;
  theirBest: HeadToHeadRow | null;
  biggestMargin: HeadToHeadRow | null;
}

function initialsOf(name: string): string {
  return (
    (name || '??')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || '??'
  );
}

export default function ChallengeScreen() {
  const { userId, name: nameParam } = useLocalSearchParams<{
    userId: string;
    name?: string;
  }>();
  const { currentSeries } = useSeries();
  const { profile } = useUser();
  const config = getSeriesConfig(currentSeries);
  const seriesColors = config.colors;

  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState<null | 'pending' | 'none'>(null);
  const [theirName, setTheirName] = useState<string>(
    typeof nameParam === 'string' ? decodeURIComponent(nameParam) : 'Rival',
  );
  const [summary, setSummary] = useState<HeadToHeadSummary | null>(null);
  const [myName] = useState<string>(profile?.displayName || 'You');

  useEffect(() => {
    if (!userId || !profile?.id) return;
    if (userId === profile.id) return; // can't challenge yourself
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLocked(null);
      try {
        // Head-to-head unlocks only once an accepted challenge exists between
        // the two players in this series. This guards deep links too.
        const chRes = await supabase
          .from('challenges')
          .select('id, status')
          .eq('series_id', currentSeries)
          .or(
            `and(challenger_id.eq.${userId},challenged_id.eq.${profile.id}),` +
              `and(challenger_id.eq.${profile.id},challenged_id.eq.${userId})`,
          );
        if (cancelled) return;
        if (!chRes.error) {
          const rows = chRes.data ?? [];
          if (!rows.some((c) => c.status === 'accepted')) {
            setLocked(rows.some((c) => c.status === 'pending') ? 'pending' : 'none');
            setLoading(false);
            return;
          }
        }

        // Fetch both users' scored predictions for the active series.
        const [predRes, racesRes, profileRes] = await Promise.all([
          supabase
            .from('user_predictions')
            .select('user_id, race_id, points_earned, sprint_points_earned')
            .in('user_id', [userId, profile.id])
            .eq('series_id', currentSeries),
          supabase
            .from('races')
            .select('id, round, name, has_sprint')
            .eq('series_id', currentSeries)
            .order('round', { ascending: true }),
          supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', userId)
            .single(),
        ]);

        if (cancelled) return;

        if (profileRes.data) {
          setTheirName(profileRes.data.display_name || profileRes.data.username || theirName);
        }

        const races = racesRes.data ?? [];

        const mine = new Map<string, number>();
        const theirs = new Map<string, number>();
        for (const p of predRes.data ?? []) {
          const pts = (p.points_earned ?? 0) + (p.sprint_points_earned ?? 0);
          if (p.user_id === profile.id) mine.set(p.race_id, (mine.get(p.race_id) ?? 0) + pts);
          else theirs.set(p.race_id, (theirs.get(p.race_id) ?? 0) + pts);
        }

        const rows: HeadToHeadRow[] = [];
        for (const race of races) {
          const myPts = mine.get(race.id) ?? 0;
          const theirPts = theirs.get(race.id) ?? 0;
          // Only show rounds where at least one side has scored.
          if (!mine.has(race.id) && !theirs.has(race.id)) continue;
          rows.push({
            raceId: race.id,
            raceName: race.name,
            round: race.round,
            sprint: race.has_sprint ?? false,
            myPoints: myPts,
            theirPoints: theirPts,
          });
        }

        let myTotal = 0;
        let theirTotal = 0;
        let myWins = 0;
        let theirWins = 0;
        let ties = 0;
        let myBest: HeadToHeadRow | null = null;
        let theirBest: HeadToHeadRow | null = null;
        let biggestMargin: HeadToHeadRow | null = null;

        for (const row of rows) {
          myTotal += row.myPoints;
          theirTotal += row.theirPoints;
          if (row.myPoints > row.theirPoints) myWins += 1;
          else if (row.theirPoints > row.myPoints) theirWins += 1;
          else ties += 1;

          if (!myBest || row.myPoints > myBest.myPoints) myBest = row;
          if (!theirBest || row.theirPoints > theirBest.theirPoints) theirBest = row;
          if (
            !biggestMargin ||
            Math.abs(row.myPoints - row.theirPoints) > Math.abs(biggestMargin.myPoints - biggestMargin.theirPoints)
          ) {
            biggestMargin = row;
          }
        }

        setSummary({
          rows: rows.reverse(), // latest round first
          myTotal,
          theirTotal,
          myWins,
          theirWins,
          ties,
          myBest,
          theirBest,
          biggestMargin,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profile?.id, currentSeries]);

  const isWinning = (summary?.myTotal ?? 0) > (summary?.theirTotal ?? 0);
  const isTie = summary && summary.myTotal === summary.theirTotal;

  const renderRaceRow = (row: HeadToHeadRow) => {
    const iWon = row.myPoints > row.theirPoints;
    const theyWon = row.theirPoints > row.myPoints;

    return (
      <View
        key={row.raceId}
        style={[
          styles.raceRow,
          { backgroundColor: seriesColors.surface, borderColor: seriesColors.border },
        ]}
      >
        <View style={[styles.halfCell, iWon && { backgroundColor: `${seriesColors.primary}12` }]}>
          <Text
            style={[
              styles.halfPoints,
              { color: iWon ? seriesColors.primary : Colors.textSecondary },
            ]}
          >
            {row.myPoints}
          </Text>
        </View>

        <View style={styles.raceMiddle}>
          <Text style={[styles.raceName, { color: Colors.text }]} numberOfLines={1}>
            {row.raceName}
          </Text>
          <Text style={[styles.raceMeta, { color: Colors.textMuted }]}>
            Round {row.round}
            {row.sprint ? ' · Sprint weekend' : ''}
          </Text>
          {iWon || theyWon ? (
            <View
              style={[
                styles.winBadge,
                {
                  backgroundColor:
                    iWon ? `${seriesColors.primary}1A` : `${seriesColors.highlight}1A`,
                },
              ]}
            >
              <Text
                style={[
                  styles.winBadgeText,
                  { color: iWon ? seriesColors.primary : seriesColors.highlight },
                ]}
              >
                {iWon ? 'You' : theirName}
              </Text>
            </View>
          ) : (
            <View style={[styles.winBadge, { backgroundColor: `${Colors.textMuted}1A` }]}>
              <Text style={[styles.winBadgeText, { color: Colors.textMuted }]}>Tie</Text>
            </View>
          )}
        </View>

        <View style={[styles.halfCell, styles.halfCellRight, theyWon && { backgroundColor: `${seriesColors.highlight}12` }]}>
          <Text
            style={[
              styles.halfPoints,
              { color: theyWon ? seriesColors.highlight : Colors.textSecondary },
            ]}
          >
            {row.theirPoints}
          </Text>
        </View>
      </View>
    );
  };

  const me = myName || 'You';
  const them = theirName || 'Rival';

  return (
    <View style={[styles.container, { backgroundColor: seriesColors.background }]}>
      <Stack.Screen
        options={{
          title: 'Head to Head',
          headerStyle: { backgroundColor: seriesColors.background },
          headerTintColor: Colors.text,
        }}
      />

      <LinearGradient
        colors={[seriesColors.primaryDark, seriesColors.surfaceElevated, seriesColors.background]}
        style={styles.hero}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroSide}>
            <View style={[styles.heroAvatar, { borderColor: seriesColors.primary }]}>
              <Text style={styles.heroInitials}>{initialsOf(me)}</Text>
            </View>
            <Text style={[styles.heroName, { color: Colors.text }]} numberOfLines={1}>
              {me}
            </Text>
            <Text style={[styles.heroPoints, { color: seriesColors.primary }]}>
              {summary?.myTotal ?? 0} pts
            </Text>
          </View>

          <View style={styles.heroCenter}>
            <Swords size={26} color={seriesColors.primary} />
            <Text style={[styles.vsText, { color: seriesColors.primary }]}>VS</Text>
          </View>

          <View style={styles.heroSide}>
            <View style={[styles.heroAvatar, { borderColor: seriesColors.highlight }]}>
              <Text style={styles.heroInitials}>{initialsOf(them)}</Text>
            </View>
            <Text style={[styles.heroName, { color: Colors.text }]} numberOfLines={1}>
              {them}
            </Text>
            <Text style={[styles.heroPoints, { color: seriesColors.highlight }]}>
              {summary?.theirTotal ?? 0} pts
            </Text>
          </View>
        </View>

        {summary && !isTie && (
          <Text style={[styles.heroVerdict, { color: Colors.textSecondary }]}>
            {isWinning
              ? `${me} leads by ${summary!.myTotal - summary!.theirTotal} points`
              : `${them} leads by ${summary!.theirTotal - summary!.myTotal} points`}
          </Text>
        )}
        {isTie && (
          <Text style={[styles.heroVerdict, { color: Colors.textSecondary }]}>
            Dead even — level on points
          </Text>
        )}
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={seriesColors.primary} />
          <Text style={[styles.loadingText, { color: Colors.textSecondary }]}>
            Loading head-to-head...
          </Text>
        </View>
      ) : !isSupabaseConfigured ? (
        <View style={styles.loadingContainer}>
          <Swords size={42} color={Colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: Colors.text }]}>Not Connected</Text>
          <Text style={[styles.emptyText, { color: Colors.textMuted }]}>
            Connect to the server to challenge other players.
          </Text>
        </View>
      ) : locked ? (
        <View style={styles.loadingContainer}>
          <Swords size={42} color={Colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: Colors.text }]}>
            {locked === 'pending' ? 'Challenge Pending' : 'No Challenge Yet'}
          </Text>
          <Text style={[styles.emptyText, { color: Colors.textMuted }]}>
            {locked === 'pending'
              ? `Your invite to ${them || 'them'} hasn't been accepted yet. The head-to-head battle opens once they respond.`
              : `Send a challenge from the Rankings or a league page — you can only race players who share a league with you.`}
          </Text>
        </View>
      ) : !summary || summary.rows.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Swords size={42} color={Colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: Colors.text }]}>Nothing To Compare</Text>
          <Text style={[styles.emptyText, { color: Colors.textMuted }]}>
            Once you and {them} have scored predictions for the same rounds, the
            round-by-round battle shows up here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Record strip */}
          <View
            style={[
              styles.recordCard,
              { backgroundColor: seriesColors.surface, borderColor: seriesColors.border },
            ]}
          >
            <View style={styles.recordCell}>
              <Text style={[styles.recordNumber, { color: seriesColors.primary }]}>
                {summary.myWins}
              </Text>
              <Text style={[styles.recordLabel, { color: Colors.textMuted }]}>You won</Text>
            </View>
            <View style={[styles.recordDivider, { backgroundColor: seriesColors.border }]} />
            <View style={styles.recordCell}>
              <Text style={[styles.recordNumber, { color: Colors.textSecondary }]}>
                {summary.ties}
              </Text>
              <Text style={[styles.recordLabel, { color: Colors.textMuted }]}>Tied</Text>
            </View>
            <View style={[styles.recordDivider, { backgroundColor: seriesColors.border }]} />
            <View style={styles.recordCell}>
              <Text style={[styles.recordNumber, { color: seriesColors.highlight }]}>
                {summary.theirWins}
              </Text>
              <Text style={[styles.recordLabel, { color: Colors.textMuted }]}>They won</Text>
            </View>
          </View>

          {/* Highlight chips */}
          <View style={styles.chipsRow}>
            {summary.myBest && summary.myBest.myPoints > 0 && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: seriesColors.surfaceElevated, borderColor: seriesColors.border },
                ]}
              >
                <View style={styles.chipHeader}>
                  <Zap size={13} color={seriesColors.primary} />
                  <Text style={[styles.chipLabel, { color: Colors.textMuted }]}>Your best round</Text>
                </View>
                <Text style={[styles.chipValue, { color: Colors.text }]} numberOfLines={1}>
                  {summary.myBest.myPoints} pts · {summary.myBest.raceName}
                </Text>
              </View>
            )}
            {summary.theirBest && summary.theirBest.theirPoints > 0 && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: seriesColors.surfaceElevated, borderColor: seriesColors.border },
                ]}
              >
                <View style={styles.chipHeader}>
                  <Zap size={13} color={seriesColors.highlight} />
                  <Text style={[styles.chipLabel, { color: Colors.textMuted }]}>Their best round</Text>
                </View>
                <Text style={[styles.chipValue, { color: Colors.text }]} numberOfLines={1}>
                  {summary.theirBest.theirPoints} pts · {summary.theirBest.raceName}
                </Text>
              </View>
            )}
            {summary.biggestMargin && Math.abs(summary.biggestMargin.myPoints - summary.biggestMargin.theirPoints) > 0 && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: seriesColors.surfaceElevated, borderColor: seriesColors.border },
                ]}
              >
                <View style={styles.chipHeader}>
                  <TrendingUp size={13} color={seriesColors.primary} />
                  <Text style={[styles.chipLabel, { color: Colors.textMuted }]}>Biggest swing</Text>
                </View>
                <Text style={[styles.chipValue, { color: Colors.text }]} numberOfLines={1}>
                  {Math.abs(summary.biggestMargin.myPoints - summary.biggestMargin.theirPoints)} pts ·{' '}
                  {summary.biggestMargin.raceName}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: Colors.textMuted }]}>
            ROUND BY ROUND
          </Text>
          {summary.rows.map(renderRaceRow)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroSide: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },

  heroCenter: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
  },

  vsText: {
    fontSize: 15,
    fontWeight: '900' as const,
    letterSpacing: 2,
  },

  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroInitials: {
    fontSize: 22,
    fontWeight: '900' as const,
    color: '#FFF',
  },

  heroName: {
    fontSize: 14,
    fontWeight: '800' as const,
    textAlign: 'center',
  },

  heroPoints: {
    fontSize: 18,
    fontWeight: '900' as const,
  },

  heroVerdict: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700' as const,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    paddingHorizontal: 40,
    gap: 12,
  },

  loadingText: {
    fontSize: 14,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
  },

  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },

  recordCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },

  recordCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },

  recordDivider: {
    width: 1,
  },

  recordNumber: {
    fontSize: 24,
    fontWeight: '900' as const,
  },

  recordLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  chipsRow: {
    gap: 8,
  },

  chip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },

  chipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  chipLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  chipValue: {
    fontSize: 14,
    fontWeight: '700' as const,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
    marginTop: 8,
  },

  raceRow: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },

  halfCell: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },

  halfCellRight: {},

  halfPoints: {
    fontSize: 22,
    fontWeight: '900' as const,
  },

  raceMiddle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 3,
  },

  raceName: {
    fontSize: 14,
    fontWeight: '800' as const,
    textAlign: 'center',
  },

  raceMeta: {
    fontSize: 11,
    fontWeight: '600' as const,
  },

  winBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 3,
  },

  winBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
  },
});
