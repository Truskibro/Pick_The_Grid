//
//  HomeScreen.swift
//  PickTheGrid
//

import SwiftUI

struct HomeScreen: View {
    @Environment(AppModel.self) private var model
    @State private var showAuth = false
    @State private var showCreateLeague = false
    @State private var showJoinLeague = false
    @State private var pickRace: Race?

    private var nextRace: Race? { F1Data.nextRace }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    heroBanner
                    if let race = nextRace {
                        nextRaceCard(race)
                    }
                    statsDashboard
                    leagueActions
                    if !model.isAuthenticated {
                        guestBanner
                    }
                    upcomingScroll
                    howItWorks
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
            .background(Theme.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        SettingsScreen()
                    } label: {
                        Image(systemName: "gearshape.fill").foregroundStyle(Theme.text)
                    }
                }
            }
            .sheet(isPresented: $showAuth) { AuthScreen() }
            .sheet(isPresented: $showCreateLeague) { CreateLeagueSheet() }
            .sheet(isPresented: $showJoinLeague) { JoinLeagueSheet() }
            .navigationDestination(item: $pickRace) { race in
                PredictRaceScreen(race: race)
            }
        }
    }

    private var heroBanner: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [Theme.f1RedDark, Theme.f1Red.opacity(0.2), Theme.surface],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            CircuitLines().stroke(Color.white.opacity(0.07), lineWidth: 2)

            VStack(alignment: .leading, spacing: 10) {
                PillBadge(text: "2026 Season", color: .white, filled: false)
                Text(model.isAuthenticated ? "Welcome back," : "Pick The Grid")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.white.opacity(0.85))
                Text(model.isAuthenticated ? model.profile.displayName : "Predict. Compete. Win.")
                    .font(.system(size: 28, weight: .heavy))
                    .foregroundStyle(.white)
            }
            .padding(20)
        }
        .frame(height: 170)
        .clipShape(.rect(cornerRadius: 20))
        .entrance()
    }

    private func nextRaceCard(_ race: Race) -> some View {
        SurfaceCard(accent: Theme.f1Red) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    SectionHeader(title: "Next Race")
                    if race.hasSprint { PillBadge(text: "Sprint", color: Theme.warning) }
                }
                HStack(spacing: 12) {
                    Text(F1Data.flag(forCountry: race.country)).font(.system(size: 40))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(race.name).font(.system(size: 18, weight: .bold)).foregroundStyle(Theme.text)
                        Text("Round \(race.round) · \(race.location)")
                            .font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                    }
                    Spacer()
                }
                CountdownTimerView(target: race.lockDate)
                GradientButton(title: race.isLocked ? "View Grid" : "Set Your Grid", icon: "flag.checkered") {
                    pickRace = race
                }
            }
        }
        .entrance(0.05)
    }

    private var statsDashboard: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Your Season")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                StatTile(icon: "star.fill", value: "\(model.profile.totalPoints)", label: "Points", accent: Theme.gold)
                StatTile(icon: "person.3.fill", value: "\(model.leagues.count)", label: "Leagues", accent: Theme.info)
                StatTile(icon: "checklist", value: "\(model.predictions.filter { !$0.top10.isEmpty }.count)", label: "Picks Made", accent: Theme.success)
                StatTile(icon: "steeringwheel", value: "\(F1Data.drivers.count)", label: "Drivers", accent: Theme.f1Red)
            }
        }
        .entrance(0.1)
    }

    private var leagueActions: some View {
        HStack(spacing: 12) {
            actionCard(icon: "plus.circle.fill", title: "Create League", color: Theme.f1Red) {
                model.isAuthenticated ? (showCreateLeague = true) : (showAuth = true)
            }
            actionCard(icon: "arrow.right.circle.fill", title: "Join League", color: Theme.info) {
                model.isAuthenticated ? (showJoinLeague = true) : (showAuth = true)
            }
        }
        .entrance(0.15)
    }

    private func actionCard(icon: String, title: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: icon).font(.system(size: 22)).foregroundStyle(color)
                Text(title).font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
        }
    }

    private var guestBanner: some View {
        Button { showAuth = true } label: {
            HStack(spacing: 12) {
                Image(systemName: "person.crop.circle.badge.plus")
                    .font(.system(size: 26)).foregroundStyle(Theme.f1Red)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Sign in to save your picks").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                    Text("Compete in leagues and climb the leaderboard")
                        .font(.system(size: 12)).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Theme.textSecondary)
            }
            .padding(16)
            .background(Theme.accentGlow)
            .clipShape(.rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.f1Red.opacity(0.3), lineWidth: 1))
        }
        .entrance(0.2)
    }

    private var upcomingScroll: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Upcoming Races")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(F1Data.races.filter { $0.status == .upcoming }.prefix(6)) { race in
                        Button { pickRace = race } label: { upcomingChip(race) }
                    }
                }
            }
            .contentMargins(.horizontal, 0, for: .scrollContent)
        }
        .entrance(0.25)
    }

    private func upcomingChip(_ race: Race) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(F1Data.flag(forCountry: race.country)).font(.system(size: 28))
            Text(race.name).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text)
                .lineLimit(2).multilineTextAlignment(.leading)
            Text(race.location).font(.system(size: 11)).foregroundStyle(Theme.textSecondary)
            Spacer(minLength: 0)
            Text("Round \(race.round)").font(.system(size: 10, weight: .semibold)).foregroundStyle(Theme.f1Red)
        }
        .frame(width: 130, height: 130, alignment: .topLeading)
        .padding(14)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.border, lineWidth: 1))
    }

    private var howItWorks: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "How It Works")
            VStack(spacing: 10) {
                howStep(1, "Predict", "Set your top 10 finishing order before lights out")
                howStep(2, "Score", "Earn points for every correct position, fastest lap and DNF")
                howStep(3, "Compete", "Climb global and league leaderboards all season")
            }
        }
        .entrance(0.3)
    }

    private func howStep(_ number: Int, _ title: String, _ subtitle: String) -> some View {
        HStack(spacing: 14) {
            Text("\(number)")
                .font(.system(size: 16, weight: .heavy))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(Circle().fill(Theme.f1Red))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                Text(subtitle).font(.system(size: 12)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: 14))
    }
}

/// Decorative circuit line path for hero banners.
struct CircuitLines: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.7))
        path.addCurve(
            to: CGPoint(x: rect.maxX, y: rect.maxY * 0.4),
            control1: CGPoint(x: rect.maxX * 0.3, y: rect.maxY * 0.9),
            control2: CGPoint(x: rect.maxX * 0.5, y: rect.maxY * 0.2)
        )
        path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.9))
        path.addCurve(
            to: CGPoint(x: rect.maxX, y: rect.maxY * 0.6),
            control1: CGPoint(x: rect.maxX * 0.4, y: rect.maxY * 1.1),
            control2: CGPoint(x: rect.maxX * 0.7, y: rect.maxY * 0.4)
        )
        return path
    }
}
