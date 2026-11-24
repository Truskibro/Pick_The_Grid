//
//  CalendarView.swift + RaceResultView.swift
//  PickTheGridIOS
//
//  Season calendar grouped by status, and the full result screen with a
//  per-pick scoring breakdown (display-only; the server scores stored rows).
//

import SwiftUI

// MARK: - Calendar

struct CalendarView: View {
    var store: AppStore

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if store.races.isEmpty {
                        ProgressView()
                            .tint(theme.primary)
                            .padding(.top, 80)
                    }
                    if !upcoming.isEmpty { group("UPCOMING", upcoming) }
                    if !live.isEmpty { group("LIVE NOW", live) }
                    if !completed.isEmpty { group("COMPLETED", completed) }
                }
                .padding(16)
            }
            .background(theme.background)
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var upcoming: [Race] { store.races.filter { $0.raceStatus == .upcoming } }
    private var live: [Race] { store.races.filter { $0.raceStatus == .live } }
    private var completed: [Race] { store.races.filter { $0.raceStatus == .completed } }

    private func group(_ title: String, _ races: [Race]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .heavy))
                .tracking(2)
                .foregroundStyle(AppColors.textSecondary)
                .padding(.leading, 4)
            ForEach(races) { race in
                NavigationLink {
                    race.raceStatus == .completed && store.result(for: race.id) != nil
                        ? AnyView(RaceResultView(store: store, race: race))
                        : AnyView(PredictView(store: store, focusedRace: race))
                } label: {
                    RaceCard(store: store, race: race)
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
    }
}

struct RaceCard: View {
    var store: AppStore
    var race: Race

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("R\(race.round)")
                    .font(.system(size: 12, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 26)
                    .background(race.raceStatus == .completed ? AppColors.surfaceHighlight : theme.primary)
                    .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius))
                if race.hasSprint {
                    Text("SPRINT")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(1)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(theme.highlight.opacity(0.15))
                        .foregroundStyle(theme.highlight)
                        .clipShape(Capsule())
                }
                if race.raceStatus == .live {
                    Text("LIVE")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(AppColors.error)
                        .clipShape(Capsule())
                }
                Spacer()
                if let prediction = store.myPredictions[race.id] {
                    Text("\(prediction.pointsEarned + prediction.sprintPointsEarned) pts")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(theme.highlight)
                }
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(AppColors.textMuted)
            }
            Text(race.name)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundStyle(AppColors.text)
            HStack(spacing: 10) {
                Label(race.location, systemImage: "mappin")
                Label(shortDate(race.raceDate), systemImage: "calendar")
                if let winner = store.driver(race.winner) {
                    Label(winner.shortName, systemImage: "trophy")
                        .foregroundStyle(theme.highlight)
                }
            }
            .font(.caption)
            .foregroundStyle(AppColors.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                .strokeBorder(theme.border, lineWidth: 1)
        )
    }

    private func shortDate(_ date: String) -> String {
        let input = DateFormatter()
        input.dateFormat = "yyyy-MM-dd"
        guard let parsed = input.date(from: date) else { return date }
        let output = DateFormatter()
        output.dateFormat = "MMM d"
        return output.string(from: parsed)
    }
}

// MARK: - Race result

struct RaceResultView: View {
    var store: AppStore
    var race: Race

    @State private var showingSprint = false

    private var theme: SeriesTheme { store.series.theme }
    private var result: RaceResult? { store.result(for: race.id) }
    private var prediction: PredictionRow? { store.myPredictions[race.id] }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                winnerHeader
                if race.hasSprint, let sprint = result?.sprintClassification, !sprint.isEmpty {
                    segmentPicker
                }
                classificationTable
                if let prediction { breakdownCard(prediction) }
            }
            .padding(16)
        }
        .background(theme.background)
        .navigationTitle(race.name)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if race.hasSprint, let sprint = result?.sprintClassification, !sprint.isEmpty {
                showingSprint = true
            }
        }
    }

    private var segmentPicker: some View {
        Picker("Session", selection: $showingSprint) {
            Text("Sprint").tag(true)
            Text("Race").tag(false)
        }
        .pickerStyle(.segmented)
        .tint(theme.primary)
    }

    private var winnerHeader: some View {
        HStack(spacing: 12) {
            if let winner = store.driver(currentClassification.first?.driverId) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(store.teamColor(forDriverId: winner.id))
                    .frame(width: 6, height: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(winner.name)
                        .font(.system(size: 20, weight: .black, design: .rounded))
                        .foregroundStyle(AppColors.text)
                    Text("\(race.location) · \(shortDate(race.raceDate))")
                        .font(.caption)
                        .foregroundStyle(AppColors.textSecondary)
                }
                Spacer()
                if showingSprint {
                    Text("SPRINT")
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(theme.highlight)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                .strokeBorder(theme.borderLight, lineWidth: 1)
        )
    }

    private var currentClassification: [ClassificationEntry] {
        guard let result else { return [] }
        if showingSprint { return result.sprintClassification ?? [] }
        return result.classification
    }

    private var classificationTable: some View {
        VStack(spacing: 2) {
            if currentClassification.isEmpty {
                Text("No result data yet")
                    .font(.subheadline)
                    .foregroundStyle(AppColors.textSecondary)
                    .padding(30)
            } else {
                ForEach(currentClassification, id: \.driverId) { entry in
                    resultRow(entry)
                    if entry.position < currentClassification.count {
                        Divider().overlay(theme.border)
                    }
                }
            }
        }
        .padding(.vertical, 8)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                .strokeBorder(theme.border, lineWidth: 1)
        )
    }

    private func resultRow(_ entry: ClassificationEntry) -> some View {
        let isPick = showingSprint
            ? (prediction?.predictedSprintTop8.contains(entry.driverId) ?? false)
            : (prediction?.predictedTop10.contains(entry.driverId) ?? false)
        let isFastestLap = !showingSprint && result?.fastestLapDriverId == entry.driverId

        return HStack(spacing: 10) {
            Text("\(entry.position)")
                .font(.system(size: 13, weight: .black, design: .rounded))
                .foregroundStyle(entry.position <= 3 ? theme.highlight : AppColors.textSecondary)
                .frame(width: 24, alignment: .leading)

            RoundedRectangle(cornerRadius: 2)
                .fill(store.teamColor(forDriverId: entry.driverId))
                .frame(width: 4, height: 26)

            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(store.driver(entry.driverId)?.name ?? entry.driverId)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(AppColors.text)
                    if isPick {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption2)
                            .foregroundStyle(AppColors.success)
                    }
                }
                if isFastestLap {
                    Text("Fastest lap")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(theme.highlight)
                }
            }
            Spacer()
            statusChip(entry)
            Text(entry.position <= (showingSprint ? store.series.sprintPoints.count : store.series.racePoints.count)
                ? "+\(showingSprint ? store.series.sprintPoints[entry.position - 1] : store.series.racePoints[entry.position - 1])"
                : "")
                .font(.caption.weight(.bold))
                .foregroundStyle(AppColors.textSecondary)
                .frame(width: 30, alignment: .trailing)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private func statusChip(_ entry: ClassificationEntry) -> some View {
        let normalized = entry.status.lowercased()
        guard normalized != "finished" else {
            return AnyView(
                Text(entry.gap == "Leader" ? (entry.time.isEmpty ? "Winner" : entry.time) : entry.gap)
                    .font(.caption2)
                    .foregroundStyle(AppColors.textSecondary)
            )
        }
        let color: Color = normalized == "dns" ? AppColors.textMuted : AppColors.error
        let label = normalized == "dns" ? "DNS" : (normalized == "retired" ? "DNF" : "DNF")
        return AnyView(
            Text(label)
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(color)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(color.opacity(0.15))
                .clipShape(Capsule())
        )
    }

    // MARK: Breakdown

    private func breakdownCard(_ prediction: PredictionRow) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("YOUR BREAKDOWN")
                .font(.system(size: 11, weight: .heavy))
                .tracking(2)
                .foregroundStyle(AppColors.textSecondary)

            if showingSprint {
                if let sprintResult = result?.sprintClassification {
                    let breakdown = calculateSprintPoints(prediction.predictedSprintTop8, sprintResult, series: store.series)
                    HStack {
                        breakdownStat("Position", "\(breakdown.positionPoints)")
                        breakdownStat("Correct", "\(breakdown.correctPositions.count)/\(store.series.sprintTopN)")
                        breakdownStat("Sprint pts", "\(breakdown.totalPoints)")
                    }
                }
            } else if let result {
                let breakdown = calculatePoints(
                    top10: prediction.predictedTop10,
                    fastestLap: prediction.predictedFastestLap,
                    dnf: prediction.predictedDnf,
                    result: result,
                    series: store.series
                )
                HStack {
                    breakdownStat("Positions", "\(breakdown.positionPoints)")
                    breakdownStat("Fastest lap", "\(breakdown.fastestLapPoints)")
                    breakdownStat(store.series.labels.dnfLabel, "\(breakdown.dnfPoints)")
                    breakdownStat("Total", "\(breakdown.totalPoints)")
                }

                // Per-position detail
                VStack(spacing: 6) {
                    ForEach(0..<min(prediction.predictedTop10.count, store.series.raceTopN), id: \.self) { index in
                        let driverId = prediction.predictedTop10[index]
                        let correct = breakdown.correctPositions.contains(index)
                        HStack(spacing: 8) {
                            Image(systemName: correct ? "checkmark.circle.fill" : "xmark.circle")
                                .font(.caption)
                                .foregroundStyle(correct ? AppColors.success : AppColors.textMuted)
                            Text("P\(index + 1)")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(AppColors.textSecondary)
                                .frame(width: 30, alignment: .leading)
                            Text(store.driver(driverId)?.name ?? driverId)
                                .font(.caption)
                                .foregroundStyle(AppColors.text)
                            Spacer()
                            if correct {
                                Text("+\(store.series.racePoints[index])")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(AppColors.success)
                            }
                        }
                    }
                }
                .padding(10)
                .background(theme.background.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 2))
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                .strokeBorder(theme.border, lineWidth: 1)
        )
    }

    private func breakdownStat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 17, weight: .black, design: .rounded))
                .foregroundStyle(theme.primaryLight)
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .tracking(1)
                .foregroundStyle(AppColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func shortDate(_ date: String) -> String {
        let input = DateFormatter()
        input.dateFormat = "yyyy-MM-dd"
        guard let parsed = input.date(from: date) else { return date }
        let output = DateFormatter()
        output.dateFormat = "MMM d, yyyy"
        return output.string(from: parsed)
    }
}

#Preview {
    CalendarView(store: .shared)
        .preferredColorScheme(.dark)
}
