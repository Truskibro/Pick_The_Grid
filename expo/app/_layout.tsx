import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Colors from "@/constants/colors";
import { UserProvider } from "@/providers/UserProvider";
import { GameProvider } from "@/providers/GameProvider";
import { F1DataProvider } from "@/providers/F1DataProvider";
import ScoringBridge from "@/components/ScoringBridge";

void SplashScreen.preventAutoHideAsync();

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
              <ScoringBridge />
              <StatusBar style="light" />
              <RootLayoutNav />
            </GameProvider>
          </F1DataProvider>
        </UserProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
