import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Platform } from "react-native";
import Colors from "@/constants/colors";
import { UserProvider } from "@/providers/UserProvider";
import { GameProvider } from "@/providers/GameProvider";
import { F1DataProvider } from "@/providers/F1DataProvider";
import { AchievementProvider } from "@/providers/AchievementProvider";
import ScoringBridge from "@/components/ScoringBridge";
import AchievementCelebrationOverlay from "@/components/AchievementCelebrationOverlay";

void SplashScreen.preventAutoHideAsync();

function NotificationTapHandler() {
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // expo-notifications is not available on web.
    if (Platform.OS === 'web') return;

    // Handle notifications that were tapped while the app was closed/backgrounded.
    // End-of-event notifications (sprint_end / race_end) deep-link to the
    // race-results screen so users see their score; start reminders route to
    // the predict screen so they can finalise their picks.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data;
      const raceId = data?.raceId as string | undefined;
      const event = data?.event as string | undefined;
      if (!raceId) return;
      const isEndEvent = event === 'sprint_end' || event === 'race_end';
      router.push(isEndEvent ? `/race-results/${raceId}` : `/predict-race/${raceId}`);
    });

    // Handle future notification taps while the app is in the foreground.
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        const raceId = data?.raceId as string | undefined;
        const event = data?.event as string | undefined;
        if (!raceId) return;
        const isEndEvent = event === 'sprint_end' || event === 'race_end';
        router.push(isEndEvent ? `/race-results/${raceId}` : `/predict-race/${raceId}`);
      }
    );
    responseListener.current = sub;

    return () => {
      sub.remove();
    };
  }, [router]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      staleTime: 30_000,
      networkMode: 'always',
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' as const },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{
          presentation: "modal",
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="create-league"
        options={{
          presentation: "modal",
          title: "Create League",
        }}
      />
      <Stack.Screen
        name="join-league"
        options={{
          presentation: "modal",
          title: "Join League",
        }}
      />
      <Stack.Screen
        name="league-detail/[leagueId]"
        options={{
          title: "League",
        }}
      />
      <Stack.Screen
        name="race-results/[raceId]"
        options={{
          title: "Race Details",
        }}
      />
      <Stack.Screen
        name="predict-race/[raceId]"
        options={{
          title: "Predict",
        }}
      />
      <Stack.Screen
        name="profile/[userId]"
        options={{
          title: "Profile",
        }}
      />
      <Stack.Screen
        name="achievements"
        options={{
          title: "Grid Badges",
        }}
      />
      <Stack.Screen
        name="auth"
        options={{
          presentation: "modal",
          title: "Sign In",
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <UserProvider>
          <F1DataProvider>
            <GameProvider>
              <AchievementProvider>
                <ScoringBridge />
                <NotificationTapHandler />
                <StatusBar style="light" />
                <RootLayoutNav />
                <AchievementCelebrationOverlay />
              </AchievementProvider>
            </GameProvider>
          </F1DataProvider>
        </UserProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
