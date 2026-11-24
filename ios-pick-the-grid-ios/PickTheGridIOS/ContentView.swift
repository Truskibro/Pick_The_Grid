//
//  ContentView.swift
//  PickTheGridIOS
//
//  Root switch: series select → auth → main tabs.
//

import SwiftUI

struct ContentView: View {
    @State private var store = AppStore.shared
    @State private var bootstrapped = false

    var body: some View {
        Group {
            if !bootstrapped {
                SplashScreen
            } else if !store.hasSelectedSeries {
                SeriesSelectView(store: store)
            } else if store.authState == .signedIn {
                RootView(store: store)
            } else {
                AuthView(store: store)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: bootstrapped)
        .animation(.easeInOut(duration: 0.25), value: store.hasSelectedSeries)
        .animation(.easeInOut(duration: 0.25), value: store.authState)
        .task {
            await store.bootstrap()
            bootstrapped = true
        }
    }

    private var SplashScreen: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: "flag.checkered.2.crossed")
                    .font(.system(size: 44, weight: .bold))
                    .foregroundStyle(AppColors.error)
                Text("PICK THE GRID")
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundStyle(AppColors.text)
                    .tracking(4)
                ProgressView()
                    .tint(AppColors.textSecondary)
            }
        }
    }
}

#Preview {
    ContentView()
}
