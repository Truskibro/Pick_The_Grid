//
//  PredictView.swift
//  PickTheGridIOS
//
//  Grid picking: top-N slots, fastest lap, DNF, sprint top-N (when the race
//  has one). Saves through the save_user_prediction RPC (server-scored).
//

import SwiftUI

struct PredictView: View {
    var store: AppStore
    var focusedRace: Race?

    @State private var race: Race?
    @State private var topN: [String?] = []
    @State private var fastestLap: String?
    @State private var dnf: String?
    @State private var sprintTopN: [String?] = []
    @State private var pickingSlot: Int?
    @State private var pickingSprintSlot: Int?
    @State private var pickingFastestLap = false
    @State private var pickingDnf = false
    @State private var saving = false
    @State private var savedMessage: String?
    @State private var errorText: String?
    @Environment(\.dismiss) private var dismiss

    private var theme: SeriesTheme { store.series.theme }
    private var series: SeriesConfig { store.series }

    var body: some View {
        content
            .onAppear(perform: setup)
            .sheet(item: gridPickerBinding) { target in
                DriverPickerSheet(
                    store: store,
                    title: gridPickerTitle(target),
                    exclude: pickedIds(excluding: target.slot)
                ) { driverId in
                    topN[target.slot] = driverId
                    pickingSlot = nil
                }
            }
            .sheet(item: sprintPickerBinding) { target in
                DriverPickerSheet(
                    store: store,
                    title: sprintPickerTitle(target),
                    exclude: sprintPickedIds(excluding: target.slot)
                ) { driverId in
                    sprintTopN[target.slot] = driverId
                    pickingSprintSlot = nil
                }
            }
            .sheet(isPresented: $pickingFastestLap) {
                DriverPickerSheet(store: store, title: "Fastest Lap", exclude: []) { driverId in
                    fastestLap = driverId
                    pickingFastestLap = false
                }
            }
            .sheet(isPresented: $pickingDnf) {
                DriverPickerSheet(store: store, title: series.labels.dnfLabel, exclude: []) { driverId in
                    dnf = driverId
                    pickingDnf = false
                }
            }
    }

    @ViewBuilder
    private var content: some View {
        if let race {
            NavigationStack {
                ScrollView {
                    VStack(spacing: 14) {
                        raceHeader(race)
                        gridSection(race)
                        bonusSection(race)
                        if race.hasSprint { sprintSection(race) }
                        saveButton(race)
                        if let savedMessage { savedBanner(savedMessage) }
                        if let errorText { errorBanner(errorText) }
                    }
                    .padding(16)
                }
                .background(theme.background)
                .navigationTitle("Predict")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if focusedRace != nil {
                        ToolbarItem(placement: .topBarLeading) {
                            Button("Done") { dismiss() }
                        }
                    }
                }
            }
        } else {
            NavigationStack {
                VStack(spacing: 14) {
                    Text("No upcoming race")
                        .font(.headline)
                        .foregroundStyle(AppColors.text)
                    Text("The next round will open for picks as soon as it is on the calendar.")
                        .font(.subheadline)
                        .foregroundStyle(AppColors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(30)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(theme.background)
                .navigationTitle("Predict")
            }
        }
    }

    private var gridPickerBinding: Binding<PickerTarget?> {
        Binding(
            get: { pickingSlot.flatMap { PickerTarget(kind: .grid, slot: $0) } },
            set: { _ in }
        )
    }

    private var sprintPickerBinding: Binding<PickerTarget?> {
        Binding(
            get: { pickingSprintSlot.flatMap { PickerTarget(kind: .sprint, slot: $0) } },
            set: { _ in }
        )
    }

    private func gridPickerTitle(_ target: PickerTarget) -> String {
        "Pick P" + String(target.slot + 1)
    }

    private func sprintPickerTitle(_ target: PickerTarget) -> String {
        "Sprint P" + String(target.slot + 1)
    }

    private func setup() {
        let target = focusedRace ?? store.nextRace
        race = target
        if topN.isEmpty {
            topN = Array(repeating: nil, count: series.raceTopN)
        }
        if sprintTopN.isEmpty {
            sprintTopN = Array(repeating: nil, count: series.sprintTopN)
        }
        // Pre-fill from the saved prediction when there is one.
        if let target, let saved = store.myPredictions[target.id], topN.allSatisfy({ $0 == nil }) {
            for (index, id) in saved.predictedTop10.enumerated() where index < series.raceTopN {
                topN[index] = id
            }
            fastestLap = saved.predictedFastestLap
            dnf = saved.predictedDnf
            for (index, id) in saved.predictedSprintTop8.enumerated() where index < series.sprintTopN {
                sprintTopN[index] = id
            }
        }
    }

    // MARK: Header

    private func raceHeader(_ race: Race) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("ROUND \(race.round) · \(race.country.uppercased())")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(2)
                    .foregroundStyle(theme.primaryLight)
                Spacer()
                Text(maxPossibleText(race))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(theme.highlight)
            }
            Text(race.name)
                .font(.system(size: 22, weight: .black, design: .rounded))
                .foregroundStyle(AppColors.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func maxPossibleText(_ race: Race) -> String {
        let max = maxPossiblePoints(series: series, includeSprint: race.hasSprint)
        return "Max \(max) pts"
    }

    // MARK: Grid

    private func gridSection(_ race: Race) -> some View {
        card {
            VStack(alignment: .leading, spacing: 10) {
                sectionTitle("PREDICT THE TOP \(series.raceTopN)")
                ForEach(0..<series.raceTopN, id: \.self) { index in
                    slotRow(index: index, driverId: topN.indices.contains(index) ? topN[index] : nil) {
                        pickingSlot = index
                    }
                    if index == 0 {
                        // Hero visual separation after P1
                        Rectangle().fill(theme.border).frame(height: 1).opacity(0.6)
                    }
                }
            }
        }
    }

    private func slotRow(index: Int, driverId: String?, action: @escaping () -> Void) -> some View {
        Button(action: { Haptics.tap(); action() }) {
            HStack(spacing: 12) {
                Text("P\(index + 1)")
                    .font(.system(size: 13, weight: .black, design: .rounded))
                    .foregroundStyle(theme.primaryLight)
                    .frame(width: 34, alignment: .leading)

                if let driverId, let driver = store.driver(driverId) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(store.teamColor(forDriverId: driver.id))
                        .frame(width: 4, height: 26)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(driver.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppColors.text)
                        Text(store.team(driver.teamId)?.name ?? "")
                            .font(.caption2)
                            .foregroundStyle(AppColors.textSecondary)
                    }
                    Spacer()
                    Text(driver.shortName)
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                        .foregroundStyle(theme.primaryLight)
                } else {
                    Image(systemName: "plus.circle")
                        .foregroundStyle(AppColors.textMuted)
                    Text("Pick \(series.labels.competitorLower)")
                        .font(.subheadline)
                        .foregroundStyle(AppColors.textMuted)
                    Spacer()
                }
            }
            .padding(10)
            .background(driverId != nil ? theme.surfaceHighlight : theme.background.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 2))
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: Bonus picks

    private func bonusSection(_ race: Race) -> some View {
        card {
            VStack(alignment: .leading, spacing: 12) {
                sectionTitle("BONUS PICKS")
                pickButtonRow(
                    label: "Fastest Lap",
                    value: fastestLap.flatMap { store.driver($0)?.name },
                    symbol: "timer",
                    action: { pickingFastestLap = true }
                )
                pickButtonRow(
                    label: series.labels.dnfLabel,
                    value: dnf.flatMap { store.driver($0)?.name },
                    symbol: "exclamationmark.triangle",
                    action: { pickingDnf = true }
                )
            }
        }
    }

    private func pickButtonRow(label: String, value: String?, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: { Haptics.tap(); action() }) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(theme.primaryLight)
                    .frame(width: 22)
                Text(label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppColors.text)
                Spacer()
                Text(value ?? "Pick")
                    .font(.subheadline)
                    .foregroundStyle(value != nil ? theme.highlight : AppColors.textMuted)
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(AppColors.textMuted)
            }
            .padding(12)
            .background(theme.background.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 2))
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: Sprint

    private func sprintSection(_ race: Race) -> some View {
        card {
            VStack(alignment: .leading, spacing: 10) {
                sectionTitle("SPRINT — TOP \(series.sprintTopN)")
                ForEach(0..<series.sprintTopN, id: \.self) { index in
                    slotRow(index: index, driverId: sprintTopN.indices.contains(index) ? sprintTopN[index] : nil) {
                        pickingSprintSlot = index
                    }
                }
            }
        }
    }

    // MARK: Save

    private func saveButton(_ race: Race) -> some View {
        let complete = topN.allSatisfy { $0 != nil }
        return Button {
            Task { await save(race) }
        } label: {
            HStack {
                if saving {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "flag.checkered")
                    Text(store.myPredictions[race.id] != nil ? "Update Pick" : "Submit Pick")
                        .font(.system(size: 16, weight: .bold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(complete ? theme.primary : theme.surfaceHighlight)
            .foregroundStyle(complete ? .white : AppColors.textSecondary)
            .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 6))
        }
        .disabled(!complete || saving)
        .buttonStyle(PressableButtonStyle())
    }

    private func save(_ race: Race) async {
        saving = true
        savedMessage = nil
        errorText = nil
        do {
            try await store.savePrediction(
                race: race,
                top10: topN.compactMap { $0 },
                fastestLap: fastestLap,
                dnf: dnf,
                sprintTop8: sprintTopN.compactMap { $0 }
            )
            savedMessage = "Pick saved — points are scored automatically once the result is in."
            Haptics.success()
        } catch {
            errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        saving = false
    }

    private func savedBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(AppColors.success)
            Text(text).font(.footnote).foregroundStyle(AppColors.text)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(AppColors.error)
            Text(text).font(.footnote).foregroundStyle(AppColors.text)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: Helpers

    private func card(@ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous)
                    .strokeBorder(theme.border, lineWidth: 1)
            )
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .heavy))
            .tracking(2)
            .foregroundStyle(AppColors.textSecondary)
    }

    private func pickedIds(excluding slot: Int) -> [String] {
        topN.enumerated().compactMap { index, value in index == slot ? nil : value }
    }

    private func sprintPickedIds(excluding slot: Int) -> [String] {
        sprintTopN.enumerated().compactMap { index, value in index == slot ? nil : value }
    }
}

// MARK: - Picker targets

private struct PickerTarget: Identifiable {
    enum Kind: String { case grid, sprint }
    let kind: Kind
    let slot: Int
    var id: String { "\(kind.rawValue)-\(slot)" }
    var gridSlot: Int? { kind == .grid ? slot : nil }
    var sprintSlot: Int? { kind == .sprint ? slot : nil }
}

// MARK: - Driver picker sheet

struct DriverPickerSheet: View {
    var store: AppStore
    var title: String
    var exclude: [String]
    var onPick: (String) -> Void

    @State private var search = ""
    @Environment(\.dismiss) private var dismiss

    private var filtered: [Driver] {
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        return store.drivers
            .sorted { $0.championshipPoints > $1.championshipPoints }
            .filter { driver in
                if exclude.contains(driver.id) { return false }
                if query.isEmpty { return true }
                return driver.name.lowercased().contains(query)
                    || driver.shortName.lowercased().contains(query)
            }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { driver in
                Button {
                    Haptics.tap()
                    onPick(driver.id)
                } label: {
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(store.teamColor(forDriverId: driver.id))
                            .frame(width: 5, height: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(driver.name)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(AppColors.text)
                            Text("\(store.team(driver.teamId)?.name ?? "") · \(driver.championshipPoints) pts")
                                .font(.caption2)
                                .foregroundStyle(AppColors.textSecondary)
                        }
                        Spacer()
                        Text("#\(driver.number)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(AppColors.textMuted)
                        Text(driver.shortName)
                            .font(.system(size: 13, weight: .heavy, design: .rounded))
                            .foregroundStyle(store.series.theme.primaryLight)
                            .frame(width: 44)
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(AppColors.background)
            .searchable(text: $search, prompt: "Search \(store.series.labels.competitorsLower)")
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

#Preview {
    PredictView(store: .shared)
        .preferredColorScheme(.dark)
}
