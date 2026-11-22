import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Search, Swords, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';

import AnimatedPressable from '@/components/AnimatedPressable';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { Challenge, useChallenges } from '@/providers/ChallengeProvider';
import { useSeries } from '@/providers/SeriesProvider';
import { useUser } from '@/providers/UserProvider';

function nameOf(p: { display_name: string; username: string } | null | undefined): string {
  return p?.display_name || p?.username || 'Player';
}

function when(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface ProfileHit {
  id: string;
  username: string | null;
  display_name: string | null;
  total_points: number | null;
  motogp_total_points: number | null;
}

/** Strip characters that would break the PostgREST `.or()` filter. */
function sanitizeQuery(q: string): string {
  return q.replace(/[,()%_]/g, ' ').trim();
}

export default function ChallengesScreen() {
  const router = useRouter();
  const { config, currentSeries } = useSeries();
  const seriesColors = config.colors;
  const { profile, isGuest } = useUser();
  const {
    challenges,
    pendingIncoming,
    loading,
    refresh,
    respondToChallenge,
    cancelChallenge,
    sendChallenge,
  } = useChallenges();

  const [busyId, setBusyId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const incoming = useMemo(
    () => pendingIncoming,
    [pendingIncoming],
  );
  const sent = useMemo(
    () => challenges.filter((c) => c.status === 'pending' && c.challenger_id === profile?.id),
    [challenges, profile?.id],
  );
  const decided = useMemo(
    () =>
      challenges
        .filter((c) => c.status !== 'pending')
        .sort((a, b) => (b.responded_at ?? b.created_at).localeCompare(a.responded_at ?? a.created_at)),
    [challenges],
  );

  const accept = async (c: Challenge) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setBusyId(c.id);
    await respondToChallenge(c.id, true);
    setBusyId(null);
    router.push(`/challenge/${c.challenger_id}?name=${encodeURIComponent(nameOf(c.challenger))}` as any);
  };

  const decline = async (c: Challenge) => {
    setBusyId(c.id);
    await respondToChallenge(c.id, false);
    setBusyId(null);
  };

  const withdraw = (c: Challenge) => {
    Alert.alert('Withdraw Challenge', 'Take back this pending invite?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () => void cancelChallenge(c.id),
      },
    ]);
  };

  const rivalOf = (c: Challenge) =>
    c.challenger_id === profile?.id
      ? { user: c.challenged, id: c.challenged_id }
      : { user: c.challenger, id: c.challenger_id };

  // ---- rival search -------------------------------------------------------
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProfileHit[]>([]);
  const searchSeq = useRef(0);

  useEffect(() => {
    const q = sanitizeQuery(query);
    if (q.length < 2 || !profile?.id) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, total_points, motogp_total_points')
          .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
          .neq('id', profile.id)
          .limit(10);
        if (seq !== searchSeq.current) return;
        if (error) {
          console.log('[challenges] search error:', error.message);
          setResults([]);
        } else {
          setResults((data ?? []) as ProfileHit[]);
        }
      } catch (e) {
        if (seq === searchSeq.current) {
          console.log('[challenges] search threw:', e);
          setResults([]);
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, profile?.id]);

  // Existing challenge per rival, so search results show Pending / View
  // instead of offering a duplicate invite. accepted > pending > declined.
  const statusRank = { accepted: 3, pending: 2, declined: 1 } as const;
  const challengeByRival = useMemo(() => {
    const map = new Map<string, Challenge>();
    for (const c of challenges) {
      const rivalId = c.challenger_id === profile?.id ? c.challenged_id : c.challenger_id;
      const prev = map.get(rivalId);
      if (!prev || statusRank[c.status] > statusRank[prev.status]) map.set(rivalId, c);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenges, profile?.id]);

  const challengeUser = async (hit: ProfileHit) => {
    if (!profile?.id) {
      router.push('/auth' as any);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const displayName = hit.display_name?.trim() || hit.username?.trim() || 'this player';
    const res = await sendChallenge(hit.id);
    if (res.ok) {
      Alert.alert(
        'Challenge Sent',
        `${displayName} can accept it from their Challenges tab. Once they do, the head-to-head battle opens up.`,
      );
    } else if (res.reason === 'pending') {
      Alert.alert('Already Challenged', `Your invite to ${displayName} is still waiting.`);
    } else if (res.reason === 'accepted') {
      router.push(`/challenge/${hit.id}?name=${encodeURIComponent(displayName)}` as any);
    } else if (res.reason === 'no-league') {
      Alert.alert(
        'League Rivals Only',
        `You and ${displayName} need to share a league in this series before you can challenge them.`,
      );
    } else if (res.reason === 'guest') {
      router.push('/auth' as any);
    } else {
      Alert.alert('Something Went Wrong', 'Could not send the challenge. Try again in a moment.');
    }
  };

  const seriesPointsOf = (hit: ProfileHit): number =>
    (currentSeries === 'motogp' ? hit.motogp_total_points : hit.total_points) ?? 0;

  const initialsOf = (name: string): string =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const renderSearchRow = (hit: ProfileHit) => {
    const displayName = hit.display_name?.trim() || hit.username?.trim() || 'Player';
    const existing = challengeByRival.get(hit.id);

    return (
      <AnimatedPressable
        key={hit.id}
        style={[styles.row, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
        onPress={() =>
          existing?.status === 'accepted' &&
          (router.push(`/challenge/${hit.id}?name=${encodeURIComponent(displayName)}` as any), true)
        }
      >
        <View style={[styles.avatar, { borderColor: seriesColors.primary }]}>
          <Text style={styles.avatarText}>{initialsOf(displayName)}</Text>
        </View>

        <View style={styles.rowMain}>
          <Text style={styles.rowName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {hit.username ? `@${hit.username}` : 'Player'} · {seriesPointsOf(hit)} pts
          </Text>
        </View>

        {existing?.status === 'accepted' ? (
          <View style={[styles.openPill, { backgroundColor: `${seriesColors.primary}1A` }]}>
            <Swords size={13} color={seriesColors.primary} />
            <Text style={[styles.openText, { color: seriesColors.primary }]}>View</Text>
          </View>
        ) : existing?.status === 'pending' ? (
          <View style={[styles.pendingPill, { borderColor: Colors.border }]}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        ) : (
          <AnimatedPressable
            style={[styles.challengeBtn, { backgroundColor: seriesColors.primary }]}
            onPress={() => void challengeUser(hit)}
          >
            <Swords size={13} color="#fff" />
            <Text style={styles.challengeBtnText}>Challenge</Text>
          </AnimatedPressable>
        )}
      </AnimatedPressable>
    );
  };

  const searchBar = !isGuest && profile?.id && (
    <View style={styles.searchWrap}>
      <View
        style={[styles.searchBar, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
      >
        <Search size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Find a rival to challenge..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <AnimatedPressable onPress={() => setQuery('')} hitSlop={8}>
            <X size={16} color={Colors.textMuted} />
          </AnimatedPressable>
        )}
      </View>

      {searching && (
        <ActivityIndicator style={styles.searchSpinner} color={seriesColors.primary} />
      )}
      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <Text style={styles.noResults}>No players found for "{query.trim()}"</Text>
      )}
      {results.length > 0 && <View style={styles.searchResults}>{results.map(renderSearchRow)}</View>}
    </View>
  );

  const renderRow = ({ item }: { item: Challenge }) => {
    const isIncoming = item.challenged_id === profile?.id;
    const rival = rivalOf(item);
    const statusLabel =
      item.status === 'accepted'
        ? 'Accepted'
        : item.status === 'declined'
          ? 'Declined'
          : isIncoming
            ? 'Wants to race you'
            : 'Waiting';

    return (
      <AnimatedPressable
        style={[styles.row, { backgroundColor: Colors.surface, borderColor: Colors.border }]}
        onPress={() =>
          item.status === 'accepted' &&
          router.push(`/challenge/${rival.id}?name=${encodeURIComponent(nameOf(rival.user))}` as any)
        }
      >
        <LinearGradient
          colors={[`${seriesColors.primary}0D`, 'transparent']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={[styles.avatar, { borderColor: seriesColors.primary }]}>
          <Text style={styles.avatarText}>
            {nameOf(rival.user)
              .split(' ')
              .map((w) => w[0])
              .join('')
              .substring(0, 2)
              .toUpperCase()}
          </Text>
        </View>

        <View style={styles.rowMain}>
          <Text style={styles.rowName} numberOfLines={1}>
            {nameOf(rival.user)}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {item.league?.name ?? 'League'} · {when(item.responded_at ?? item.created_at)}
          </Text>
          <Text
            style={[
              styles.rowStatus,
              {
                color:
                  item.status === 'accepted'
                    ? Colors.success
                    : item.status === 'declined'
                      ? Colors.error
                      : Colors.textMuted,
              },
            ]}
          >
            {statusLabel}
          </Text>
        </View>

        {item.status === 'pending' && isIncoming && (
          <View style={styles.actions}>
            <AnimatedPressable
              style={[styles.actionBtn, { backgroundColor: Colors.success }]}
              disabled={busyId === item.id}
              onPress={() => void accept(item)}
            >
              <Check size={15} color="#fff" />
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.actionBtn, { backgroundColor: Colors.error }]}
              disabled={busyId === item.id}
              onPress={() => void decline(item)}
            >
              <X size={15} color="#fff" />
            </AnimatedPressable>
          </View>
        )}

        {item.status === 'pending' && !isIncoming && (
          <AnimatedPressable style={styles.withdrawBtn} onPress={() => withdraw(item)}>
            <Text style={styles.withdrawText}>Withdraw</Text>
          </AnimatedPressable>
        )}

        {item.status === 'accepted' && (
          <View style={[styles.openPill, { backgroundColor: `${seriesColors.primary}1A` }]}>
            <Swords size={13} color={seriesColors.primary} />
            <Text style={[styles.openText, { color: seriesColors.primary }]}>View</Text>
          </View>
        )}
      </AnimatedPressable>
    );
  };

  const sectionHeader = (title: string, count?: number) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      {count !== undefined && count > 0 && (
        <View style={styles.countPill}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </View>
  );

  const emptyBody = (
    <View style={styles.empty}>
      <Swords size={44} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No Challenges Yet</Text>
      <Text style={styles.emptyText}>
        Sign in, join a league, and tap Challenge on a rival to start a head-to-head battle.
      </Text>
      <AnimatedPressable style={styles.signInBtn} onPress={() => router.push('/auth' as any)}>
        <Text style={styles.signInText}>Sign In</Text>
      </AnimatedPressable>
    </View>
  );

  const hasAnything = incoming.length + sent.length + decided.length > 0;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: Colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Challenges',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
        }}
      />

      {loading && challenges.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator color={seriesColors.primary} />
        </View>
      ) : isGuest && !hasAnything ? (
        emptyBody
      ) : (
        <FlatList
          data={[...incoming, ...sent, ...decided]}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshing={loading}
          onRefresh={() => void refresh()}
          ListHeaderComponent={
            <View>
              {searchBar}
              {!hasAnything && query.trim().length === 0 && (
                <View style={styles.emptyHint}>
                  <Swords size={36} color={Colors.textMuted} />
                  <Text style={styles.emptyHintText}>
                    Search for a league rival above, or tap Challenge on a member in your league,
                    to send your first invite.
                  </Text>
                </View>
              )}
              {incoming.length > 0 && sectionHeader('Invites', incoming.length)}
              {sent.length > 0 && (
                <View style={incoming.length > 0 ? { marginTop: 18 } : undefined}>
                  {sectionHeader('Sent', sent.length)}
                </View>
              )}
              {decided.length > 0 && (
                <View style={{ marginTop: 18 }}>{sectionHeader('Recent')}</View>
              )}
            </View>
          }
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
  },

  countPill: {
    backgroundColor: Colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  countText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800' as const,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: Colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  avatarText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '900' as const,
  },

  rowMain: {
    flex: 1,
    minWidth: 0,
  },

  rowName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '800' as const,
  },

  rowMeta: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 2,
  },

  rowStatus: {
    fontSize: 10,
    fontWeight: '700' as const,
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },

  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },

  withdrawBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
  },

  withdrawText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700' as const,
  },

  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
  },

  openText: {
    fontSize: 10,
    fontWeight: '800' as const,
  },

  empty: {
    alignItems: 'center',
    paddingTop: 90,
    paddingHorizontal: 40,
    gap: 12,
  },

  emptyTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
  },

  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  signInBtn: {
    backgroundColor: Colors.f1Red,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 11,
    marginTop: 8,
  },

  signInText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800' as const,
  },

  searchWrap: {
    marginBottom: 14,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },

  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    paddingVertical: 0,
  },

  searchSpinner: {
    marginTop: 12,
  },

  noResults: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center',
    marginTop: 14,
  },

  searchResults: {
    marginTop: 12,
  },

  pendingPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
  },

  pendingText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
  },

  challengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },

  challengeBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800' as const,
  },

  emptyHint: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 30,
    gap: 12,
  },

  emptyHintText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
