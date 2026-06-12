//
//  PredictRaceScreen.swift
//  PickTheGrid
//
//  The full prediction editor for a specific race.
//

import SwiftUI

struct PredictRaceScreen: View {
    let race: Race
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var top10: [String] = []
    @State private var sprintTop8: [String] = []
    @State private var fastestLap: String?
    @State private var dnf: String?
    @State private var saving = false
    @State private var showSaved = false
    @State private var pickerMode: PickerMode?

    enum PickerMode: Identifiable {
        case fastestLap, dnf
        var id: Int { self == .fastestLap ? 0 : 1 }
    }

    private var availableDrivers: [Driver] {
        F1Data.drivers.filter { !top10.contains($0.id) }
    }
    private var availableSprintDrivers: [Driver] {
        F1Data.drivers.filter { !sprintTop8.contains($0.id) }
    }

    private var potentialPoints: Int {
        Scoring.potentialPoints(top10Count: top10.count, hasFastestLap: fastestLap != nil, hasDnf: dnf != nil, sprintCount: sprintTop8.count)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                VStack(spacing: 20) {
                    header
                    if race.isLocked { lockedBanner }
                    statTiles
                    gridSection
                    if !availableDrivers.isEmpty && !race.isLocked {
                        driverPool
                    }
                    bonusSection
                    if race.hasSprint {
                        sprintSection
                    }
                    Color.clear.frame(height: 90)
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
            }
            .background(Theme.background)

            if !race.isLocked {
                saveBar
            }
        }
        .navigationTitle(race.name)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: loadExisting)
        .sheet(item: $pickerMode) { mode in
            DriverPickerSheet(
                title: mode == .fastestLap ? "Fastest Lap" : "DNF Pick",
                selected: mode == .fastestLap ? fastestLap : dnf
            ) { id in
                if mode == .fastestLap { fastestLap = id } else { dnf = id }
            }
        }
        .overlay(alignment: .top) {
            if showSaved {
                Label("Prediction saved", systemImage: "checkmark.circle.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .background(Theme.success, in: Capsule())
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    private var header: some View {
        SurfaceCard(accent: Theme.f1Red) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Text(F1Data.flag(forCountry: race.country)).font(.system(size: 40))
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text("Round \(race.round)").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.f1Red)
                            if race.hasSprint { PillBadge(text: "Sprint", color: Theme.warning) }
                        }
                        Text(race.location).font(.system(size: 14)).foregroundStyle(Theme.textSecondary)
                    }
                    Spacer()
                }
                CountdownTimerView(target: race.lockDate)
            }
        }
    }

    private var lockedBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "lock.fill").foregroundStyle(Theme.warning)
            Text("Predictions are locked for this race")
                .font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.text)
            Spacer()
        }
        .padding(14)
        .background(Theme.warning.opacity(0.12))
        .clipShape(.rect(cornerRadius: 12))
    }

    private var statTiles: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatTile(icon: "target", value: "\(potentialPoints)", label: "Potential Pts", accent: Theme.gold)
            StatTile(icon: "checklist", value: "\(top10.count)/10", label: "Grid Progress", accent: Theme.success)
            StatTile(icon: "bolt.fill", value: fastestLap ?? "—", label: "Fastest Lap", accent: Theme.warning)
            StatTile(icon: "exclamationmark.triangle.fill", value: dnf ?? "—", label: "DNF Pick", accent: Theme.f1Red)
        }
    }

    private var gridSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Race Grid · Top 10")
            if top10.isEmpty {
                emptyGridHint
            } else {
                VStack(spacing: 8) {
                    ForEach(Array(top10.enumerated()), id: \.element) { index, driverId in
                        gridSlot(index: index, driverId: driverId)
                    }
                }
            }
        }
    }

    private var emptyGridHint: some View {
        VStack(spacing: 8) {
            Image(systemName: "flag.checkered").font(.system(size: 28)).foregroundStyle(Theme.textMuted)
            Text("Tap drivers below to build your grid")
                .font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: 14))
    }

    private func gridSlot(index: Int, driverId: String) -> some View {
        let team = F1Data.teamForDriver(driverId)
        let posColor = Theme.podiumColor(index + 1)
        return HStack(spacing: 0) {
            Rectangle().fill(team.map { Color(hex: $0.color) } ?? Theme.border).frame(width: 4)
            HStack(spacing: 12) {
                Text("P\(index + 1)")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(index < 3 ? Theme.textInverse : Theme.text)
                    .frame(width: 38, height: 30)
                    .background(index < 3 ? posColor : Theme.surfaceHighlight)
                    .clipShape(.rect(cornerRadius: 8))
                DriverBadge(driverId: driverId, size: 36)
                VStack(alignment: .leading, spacing: 1) {
                    Text(F1Data.driver(driverId)?.name ?? driverId)
                        .font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.text)
                    Text(team?.name ?? "").font(.system(size: 11)).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                if !race.isLocked {
                    VStack(spacing: 2) {
                        arrowButton("chevron.up", enabled: index > 0) { move(index, by: -1) }
                        arrowButton("chevron.down", enabled: index < top10.count - 1) { move(index, by: 1) }
                    }
                    Button { remove(driverId) } label: {
                        Image(systemName: "xmark.circle.fill").font(.system(size: 20)).foregroundStyle(Theme.textMuted)
                    }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 8)
        }
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(index < 3 ? posColor.opacity(0.4) : Theme.border, lineWidth: 1))
    }

    private func arrowButton(_ icon: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(enabled ? Theme.text : Theme.textMuted)
                .frame(width: 26, height: 18)
                .background(Theme.surfaceHighlight)
                .clipShape(.rect(cornerRadius: 5))
        }
        .disabled(!enabled)
    }

    private var driverPool: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Add Drivers", accent: Theme.info)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(availableDrivers) { driver in
                    Button { add(driver.id) } label: { driverPoolCard(driver) }
                        .disabled(top10.count >= 10)
                }
            }
        }
    }

    private func driverPoolCard(_ driver: Driver) -> some View {
        HStack(spacing: 10) {
            DriverBadge(driverId: driver.id, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(driver.shortName).font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.text)
                Text(F1Data.team(driver.teamId)?.shortName ?? "")
                    .font(.system(size: 10)).foregroundStyle(Theme.textSecondary)
            }
            Spacer()
            Image(systemName: "plus.circle.fill").foregroundStyle(Theme.success)
        }
        .padding(10)
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.border, lineWidth: 1))
        .opacity(top10.count >= 10 ? 0.4 : 1)
    }

    private var bonusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Bonus Picks", accent: Theme.warning)
            HStack(spacing: 12) {
                bonusCard(title: "Fastest Lap", value: fastestLap, icon: "bolt.fill", color: Theme.warning) {
                    if !race.isLocked { pickerMode = .fastestLap }
                }
                bonusCard(title: "DNF (+10)", value: dnf, icon: "exclamationmark.triangle.fill", color: Theme.f1Red) {
                    if !race.isLocked { pickerMode = .dnf }
                }
            }
        }
    }

    private func bonusCard(title: String, value: String?, icon: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Label(title, systemImage: icon)
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(color)
                if let value {
                    HStack(spacing: 8) {
                        DriverBadge(driverId: value, size: 30)
                        Text(F1Data.driver(value)?.shortName ?? value)
                            .font(.system(size: 14, weight: .bold)).foregroundStyle(Theme.text)
                    }
                } else {
                    Text("Tap to pick").font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Theme.surface)
            .clipShape(.rect(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(color.opacity(0.25), lineWidth: 1))
        }
    }

    private var sprintSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Sprint · Top 8", accent: Theme.warning)
            if sprintTop8.isEmpty {
                Text("Add drivers below for the sprint race")
                    .font(.system(size: 13)).foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity).padding(.vertical, 20)
                    .background(Theme.surface).clipShape(.rect(cornerRadius: 12))
            } else {
                VStack(spacing: 6) {
                    ForEach(Array(sprintTop8.enumerated()), id: \.element) { index, driverId in
                        HStack(spacing: 10) {
                            Text("S\(index + 1)").font(.system(size: 12, weight: .heavy))
                                .foregroundStyle(Theme.warning).frame(width: 30)
                            DriverBadge(driverId: driverId, size: 30)
                            Text(F1Data.driver(driverId)?.name ?? driverId)
                                .font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.text)
                            Spacer()
                            if !race.isLocked {
                                Button { sprintTop8.removeAll { $0 == driverId } } label: {
                                    Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.textMuted)
                                }
                            }
                        }
                        .padding(10).background(Theme.surface).clipShape(.rect(cornerRadius: 10))
                    }
                }
            }
            if !race.isLocked && sprintTop8.count < 8 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(availableSprintDrivers) { driver in
                            Button { if sprintTop8.count < 8 { sprintTop8.append(driver.id) } } label: {
                                HStack(spacing: 6) {
                                    DriverBadge(driverId: driver.id, size: 26)
                                    Text(driver.shortName).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.text)
                                }
                                .padding(.horizontal, 10).padding(.vertical, 7)
                                .background(Theme.surface).clipShape(Capsule())
                                .overlay(Capsule().stroke(Theme.border, lineWidth: 1))
                            }
                        }
                    }
                }
            }
        }
    }

    private var saveBar: some View {
        VStack(spacing: 0) {
            Divider().background(Theme.border)
            GradientButton(title: saving ? "Saving…" : "Save Prediction", icon: "checkmark", enabled: !top10.isEmpty && !saving) {
                save()
            }
            .padding(16)
            .background(.ultraThinMaterial)
        }
    }

    // MARK: - Actions

    private func loadExisting() {
        guard top10.isEmpty, let pred = model.prediction(for: race.id) else { return }
        top10 = pred.top10
        sprintTop8 = pred.sprintTop8
        fastestLap = pred.fastestLap
        dnf = pred.dnf
    }

    private func add(_ id: String) {
        guard top10.count < 10 else { return }
        withAnimation(.spring(response: 0.3)) { top10.append(id) }
    }
    private func remove(_ id: String) {
        withAnimation(.spring(response: 0.3)) { top10.removeAll { $0 == id } }
    }
    private func move(_ index: Int, by offset: Int) {
        let target = index + offset
        guard target >= 0, target < top10.count else { return }
        withAnimation(.spring(response: 0.3)) { top10.swapAt(index, target) }
    }

    private func save() {
        saving = true
        Task {
            await model.savePrediction(raceId: race.id, top10: top10, fastestLap: fastestLap, dnf: dnf, sprintTop8: sprintTop8)
            saving = false
            withAnimation { showSaved = true }
            try? await Task.sleep(for: .seconds(1.6))
            withAnimation { showSaved = false }
        }
    }
}
