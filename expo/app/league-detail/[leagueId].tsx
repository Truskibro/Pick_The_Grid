const renderMember = ({ item, index }: { item: LeagueMember; index: number }) => {
  const rank = index + 1;
  const isTop3 = index < 3;
  const accentColor: string | undefined = isTop3 ? top3Accents[index] : undefined;
  const isCurrentUser = item.userId === profile.id;
  const isDemo = isMockMember(item.userId);

  return (
    <AnimatedPressable
      style={[
        styles.memberCard,
        isTop3 && styles.memberCardTop,
        { opacity: fadeAnim },
      ]}
      onPress={() => router.push(`/profile/${item.userId}` as any)}
    >
      {isTop3 && (
        <LinearGradient
          colors={[`${accentColor}10`, 'transparent']}
          style={StyleSheet.absoluteFill as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
        />
      )}

      {accentColor && (
        <View style={[styles.accentStrip, { backgroundColor: accentColor }]} />
      )}

      <View style={styles.rankColumn}>
        <View
          style={[
            styles.rankBadge,
            accentColor && {
              backgroundColor: `${accentColor}18`,
              borderColor: `${accentColor}40`,
            },
          ]}
        >
          {isTop3 ? (
            <Medal size={15} color={accentColor} />
          ) : (
            <Text style={styles.rankBadgeText}>#{rank}</Text>
          )}
        </View>
      </View>

      <View style={styles.memberMain}>
        <View style={styles.memberTopRow}>
          <View style={styles.memberInfo}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.displayName, accentColor && { color: accentColor }]}
                numberOfLines={1}
              >
                {item.displayName || item.username}
              </Text>

              {item.role === 'owner' && (
                <Crown size={12} color={Colors.warning} style={{ marginLeft: 4 }} />
              )}

              {isCurrentUser && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>YOU</Text>
                </View>
              )}

              {isDemo && (
                <View style={styles.demoBadge}>
                  <Text style={styles.demoBadgeText}>DEMO</Text>
                </View>
              )}
            </View>

            <Text style={styles.usernameText} numberOfLines={1}>
              @{item.username}
            </Text>
          </View>

          <View style={styles.pointsColumn}>
            <Text
              style={[
                styles.pointsText,
                accentColor && { color: accentColor },
              ]}
            >
              {item.points.toLocaleString()}
            </Text>
            <Text style={styles.pointsLabel}>PTS</Text>
          </View>
        </View>

        <View style={styles.memberBottomRow}>
          <Text style={styles.memberMetaText}>
            {item.role === 'owner' ? 'League Owner' : 'League Member'}
          </Text>

          <Text style={styles.memberMetaText}>
            Rank #{rank}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
};