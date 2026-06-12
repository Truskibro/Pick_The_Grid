//
//  RootView.swift
//  PickTheGrid
//

import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        TabView {
            HomeScreen()
                .tabItem { Label("Home", systemImage: "house.fill") }
            CalendarScreen()
                .tabItem { Label("Calendar", systemImage: "calendar") }
            PickScreen()
                .tabItem { Label("Pick", systemImage: "flag.checkered") }
            LeaguesScreen()
                .tabItem { Label("Leagues", systemImage: "person.3.fill") }
            RankingsScreen()
                .tabItem { Label("Rankings", systemImage: "trophy.fill") }
        }
        .tint(Theme.f1Red)
    }
}
