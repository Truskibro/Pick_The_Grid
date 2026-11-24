//
//  HomeView.swift
//  PickTheGridIOS
//
//  Hero with the next race, live status, quick stats, recent result.
//

import SwiftUI

struct HomeView: View {
    var store: AppStore
    @Binding var showProfile: Bool
    @State private var now = Date()

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    hero
                    statsRow
                    if let last = store.lastCompletedRace, store.result(for: last.id) != nil {
                        lastResultCard(last)
                    }
                    yourPickCard
                }
                .padding(16)
            }
            .background(theme.background)
            .navigationTitle("Pick The Grid")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showProfile = true } label: {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.title3)
                            .foregroundStyle(theme.primary)
                    }
                }
            }
        }
    }

    // MARK: Hero

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: theme.heroGradient, startPoint: .topLeading, endPoint: .bottomTrailing)
            Circle()
                .fill(theme.primary.opacity(0.25))
                .frame(width: 260, height: 260)
                .blur(radius: 70)
                .offset(x: 110, y: -90)

            if let race = store.nextRace {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Text("ROUND \(race.round)")
                            .font(.system(size: 11, weight: .heavy))
                            .tracking(2)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(theme.primary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius))
                        if race.raceStatus == .live {
                            livePill
                        }
                        Spacer()
                        Text(race.countryFlag.isEmpty ? "🏁" : race.countryFlag)
                            .font(.title3)
                    }
                    Text(race.name)
                        .font(.system(size: 26, weight: .black, design: .rounded))
                        .foregroundStyle(AppColors.text)
                    Text("\(race.location), \(race.country)")
                        .font(.subheadline)
                        .foregroundStyle(AppColors.textSecondary)

                    countdown(race: race)

                    NavigationLink {
                        PredictView(store: store, focusedRace: race)
                    } label: {
                        Text("Make Your Pick")
                            .font(.system(size: 15, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(theme.primary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 4))
                    }
                    .buttonStyle(PressableButtonStyle())
                    .padding(.top, 4)
                }
                .padding(20)
                .padding(.top, 60)
            } else {
                Text("Season complete — see you next year!")
                    .foregroundStyle(AppColors.textSecondary)
                    .padding(24)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                .strokeBorder(theme.borderLight, lineWidth: 1)
        )
    }

    private var livePill: some View {
        HStack(spacing: 5) {
            Circle().fill(AppColors.error).frame(width: 6, height: 6)
            Text("LIVE")
                .font(.system(size: 10, weight: .heavy))
                .tracking(1)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(AppColors.error.opacity(0.25))
        .clipShape(Capsule())
    }

    private func countdown(race: Race) -> some View {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.day, .hour]
        formatter.unitsStyle = .abbreviated
        var text = "Race weekend"
        if let date = AppStore.parseDate(race.raceDate, race.raceTime) {
            let interval = date.timeIntervalSince(now)
            if interval > 0, let compact = formatter.string(from: interval) {
                text = "\(compact) to lights out"
            } else if interval <= 0 {
                text = "Race day"
            }
        }
        return HStack(spacing: 6) {
            Image(systemName: "clock")
                .font(.caption)
            Text(text)
                .font(.footnote.weight(.semibold))
        }
        .foregroundStyle(theme.highlight)
    }

    // MARK: Stats

    private var statsRow: some View {
        HStack(spacing: 12) {
            statCard(value: "\(store.totalPoints)", label: "Points")
            statCard(value: store.globalRank > 0 ? "#\(store.globalRank)" : "—", label: "Rank")
            statCard(value: "\(store.leagues.count)", label: "Leagues")
        }
    }

    private func statCard(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 22, weight: .black, design: .rounded))
                .foregroundStyle(theme.primaryLight)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(1.5)
                .foregroundStyle(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                .strokeBorder(theme.border, lineWidth: 1)
        )
    }

    // MARK: Recent result

    private func lastResultCard(_ race: Race) -> some View {
        NavigationLink {
            RaceResultView(store: store, race: race)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("LAST RESULT")
                        .font(.system(size: 11, weight: .heavy))
                        .tracking(2)
                        .foregroundStyle(AppColors.textSecondary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(AppColors.textMuted)
                }
                if let winner = store.driver(race.winner) {
                    HStack(spacing: 10) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(store.teamColor(forDriverId: winner.id))
                            .frame(width: 4, height: 34)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(winner.name)
                                .font(.headline)
                                .foregroundStyle(AppColors.text)
                            Text("Winner · \(store.series.labels.competitor) #\(winner.number)")
                                .font(.caption)
                                .foregroundStyle(AppColors.textSecondary)
                        }
                        Spacer()
                        Text(winner.shortName)
                            .font(.system(size: 15, weight: .black, design: .rounded))
                            .foregroundStyle(theme.primaryLight)
                    }
                }
            }
            .padding(14)
            .background(theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                    .strokeBorder(theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: Your pick

    @ViewBuilder
    private var yourPickCard: some View {
        if let race = store.nextRace {
            let prediction = store.myPredictions[race.id]
            VStack(alignment: .leading, spacing: 8) {
                Text("YOUR PICK FOR ROUND \(race.round)")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(2)
                    .foregroundStyle(AppColors.textSecondary)
                if let prediction {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.seal.fill")
                            .foregroundStyle(AppColors.success)
                        Text(submittedText(prediction))
                            .font(.subheadline)
                            .foregroundStyle(AppColors.text)
                    }
                } else {
                    Text("No pick yet — the grid is waiting.")
                        .font(.subheadline)
                        .foregroundStyle(AppColors.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(theme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                    .strokeBorder(theme.border, lineWidth: 1)
            )
        }
    }

    private func submittedText(_ prediction: PredictionRow) -> String {
        var parts = ["Top \(store.series.raceTopN) locked in"]
        if !prediction.predictedSprintTop8.isEmpty { parts.append("sprint picked") }
        if prediction.predictedFastestLap != nil { parts.append("fastest lap picked") }
        return parts.joined(separator: " · ")
    }
}

#Preview {
    HomeView(store: .shared, showProfile: .constant(false))
        .preferredColorScheme(.dark)
}
