import { Tabs } from "expo-router";
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

  return (
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
  );
}
