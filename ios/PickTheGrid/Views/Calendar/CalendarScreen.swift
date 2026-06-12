//
//  CalendarScreen.swift
//  PickTheGrid
//

import SwiftUI

struct CalendarScreen: View {
    @Environment(AppModel.self) private var model
    @State private var pickRace: Race?
    @State private var resultRace: Race?

    private var grouped: [(String, Color, [Race])] {
        let races = F1Data.races
        return [
            ("Live Now", Theme.f1Red, races.filter { $0.status == .live }),
            ("Upcoming", Theme.info, races.filter { $0.status == .upcoming }),
            ("Completed", Theme.success, races.filter { $0.status == .completed }),
            ("Cancelled", Theme.textMuted, races.filter { $0.status == .cancelled }),
        ].filter { !$0.2.isEmpty }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    ForEach(grouped, id: \.0) { section in
                        VStack(alignment: .leading, spacing: 12) {
                            SectionHeader(title: section.0, accent: section.1)
                            ForEach(section.2) { race in
                                raceRow(race)
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .background(Theme.background)
            .navigationTitle("Calendar")
            .navigationDestination(item: $pickRace) { PredictRaceScreen(race: $0) }
            .navigationDestination(item: $resultRace) { RaceResultsScreen(race: $0) }
        }
    }

    private func raceRow(_ race: Race) -> some View {
        Button {
            if race.status == .completed { resultRace = race }
            else if race.status != .cancelled { pickRace = race }
        } label: {
            SurfaceCard(accent: statusColor(race.status)) {
                HStack(spacing: 14) {
                    VStack(spacing: 2) {
                        Text("R\(race.round)").font(.system(size: 11, weight: .heavy)).foregroundStyle(Theme.f1Red)
                        Text(F1Data.flag(forCountry: race.country)).font(.system(size: 28))
                    }
                    .frame(width: 44)

                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text(race.name).font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.text)
                                .lineLimit(1)
                            if race.hasSprint { PillBadge(text: "S", color: Theme.warning) }
                        }
                        Text("\(race.location) · \(formattedDate(race))")
                            .font(.system(size: 12)).foregroundStyle(Theme.textSecondary)
                        if race.status == .completed, let winner = race.winner {
                            HStack(spacing: 5) {
                                Image(systemName: "trophy.fill").font(.system(size: 10)).foregroundStyle(Theme.gold)
                                Text(F1Data.driver(winner)?.name ?? winner)
                                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.gold)
                                if let pts = pointsEarned(race) {
                                    Text("· +\(pts) pts").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.success)
                                }
                            }
                        }
                    }
                    Spacer()
                    statusChip(race.status)
                }
            }
        }
    }

    private func statusChip(_ status: RaceStatus) -> some View {
        let (text, color): (String, Color) = {
            switch status {
            case .live: return ("LIVE", Theme.f1Red)
            case .upcoming: return ("Soon", Theme.info)
            case .completed: return ("Done", Theme.success)
            case .cancelled: return ("X", Theme.textMuted)
            }
        }()
        return PillBadge(text: text, color: color)
    }

    private func statusColor(_ status: RaceStatus) -> Color {
        switch status {
        case .live: return Theme.f1Red
        case .upcoming: return Theme.info
        case .completed: return Theme.success
        case .cancelled: return Theme.textMuted
        }
    }

    private func formattedDate(_ race: Race) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        let input = DateFormatter()
        input.dateFormat = "yyyy-MM-dd"
        if let date = input.date(from: race.raceDate) { return formatter.string(from: date) }
        return race.raceDate
    }

    private func pointsEarned(_ race: Race) -> Int? {
        guard let pred = model.prediction(for: race.id), !pred.top10.isEmpty else { return nil }
        return pred.pointsEarned + pred.sprintPointsEarned
    }
}
