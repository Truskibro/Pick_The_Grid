//
//  RootView.swift
//  PickTheGridIOS
//
//  Main tab navigation: Home · Predict · Calendar · Leagues · Rankings · Challenges.
//

import SwiftUI

struct RootView: View {
    var store: AppStore
    @State private var showProfile = false
    @State private var selectedTab = 0

    init(store: AppStore) {
        self.store = store
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(store.series.theme.background)
        appearance.shadowColor = .clear
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(store: store, showProfile: $showProfile)
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(0)
            PredictView(store: store)
                .tabItem { Label("Predict", systemImage: "flag.checkered.2.crossed") }
                .tag(1)
            CalendarView(store: store)
                .tabItem { Label("Calendar", systemImage: "calendar") }
                .tag(2)
            LeaguesView(store: store)
                .tabItem { Label("Leagues", systemImage: "person.3.fill") }
                .tag(3)
            RankingsView(store: store)
                .tabItem { Label("Rankings", systemImage: "trophy.fill") }
                .tag(4)
            ChallengesView(store: store)
                .tabItem { Label("Challenges", systemImage: "bolt.fill") }
                .tag(5)
        }
        .tint(store.series.theme.primary)
        .sheet(isPresented: $showProfile) {
            ProfileView(store: store)
                .presentationDetents([.medium, .large])
        }
        .task {
            await store.loadSeriesData(force: false)
        }
        .refreshable {
            await store.loadSeriesData(force: true)
        }
    }
}
