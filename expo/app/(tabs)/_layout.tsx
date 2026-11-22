import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grid3x3, Target, CalendarDays, Users, BarChart3, Swords } from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";
import Colors from "@/constants/colors";
import { useSeries } from "@/providers/SeriesProvider";
import { useChallenges } from "@/providers/ChallengeProvider";

export default function TabLayout() {
  const { config } = useSeries();
  const seriesColors = config.colors;
  const { pendingIncoming } = useChallenges();
  const insets = useSafeAreaInsets();

  return (
    // All tab screens draw their own headers (headerShown: false below), so
    // nothing else keeps content clear of the iPhone status bar / Dynamic
    // Island. Padding the whole navigator down by the top inset fixes that
    // for every tab in one place.
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: Colors.background }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: seriesColors.primary,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: seriesColors.tabBarBackground,
          borderTopColor: seriesColors.border,
          borderTopWidth: 1,
          ...(Platform.OS === 'web' ? { height: 60 } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600' as const,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Grid3x3 size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="predict"
        options={{
          title: config.labels.pickTabLabel,
          tabBarIcon: ({ color, size }) => <Target size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => <CalendarDays size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: "Leagues",
          tabBarIcon: ({ color, size }) => <Users size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboards"
        options={{
          title: "Rankings",
          tabBarIcon: ({ color, size }) => <BarChart3 size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: "Challenges",
          tabBarIcon: ({ color, size }) => <Swords size={size - 2} color={color} />,
          tabBarBadge: pendingIncoming.length > 0 ? pendingIncoming.length : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.error, color: '#fff' },
        }}
      />
    </Tabs>
    </View>
  );
}
