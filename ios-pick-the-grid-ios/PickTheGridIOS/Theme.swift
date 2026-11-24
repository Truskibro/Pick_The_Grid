//
//  Theme.swift
//  PickTheGridIOS
//
//  Dark racing look ported from expo/constants/colors.ts + series.ts.
//

import SwiftUI

extension Color {
    init(hex: String) {
        var value: UInt64 = 0
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hexString.hasPrefix("#") { hexString.removeFirst() }
        Scanner(string: hexString).scanHexInt64(&value)
        let r, g, b, a: Double
        if hexString.count == 8 {
            r = Double((value >> 24) & 0xFF) / 255
            g = Double((value >> 16) & 0xFF) / 255
            b = Double((value >> 8) & 0xFF) / 255
            a = Double(value & 0xFF) / 255
        } else {
            r = Double((value >> 16) & 0xFF) / 255
            g = Double((value >> 8) & 0xFF) / 255
            b = Double(value & 0xFF) / 255
            a = 1
        }
        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}

/// Fixed neutral palette shared by every series (expo/constants/colors.ts).
enum AppColors {
    static let background = Color(hex: "#0B0E11")
    static let surface = Color(hex: "#141820")
    static let surfaceElevated = Color(hex: "#1A1F2A")
    static let surfaceHighlight = Color(hex: "#232A36")
    static let border = Color(hex: "#1E2530")
    static let borderLight = Color(hex: "#2A3340")
    static let text = Color(hex: "#F5F5F7")
    static let textSecondary = Color(hex: "#8E8E93")
    static let textMuted = Color(hex: "#48484A")
    static let success = Color(hex: "#30D158")
    static let warning = Color(hex: "#FFD60A")
    static let error = Color(hex: "#FF453A")
    static let tabBarInactive = Color(hex: "#48484A")
}

// MARK: - Series configuration (ported from expo/constants/series.ts)

struct SeriesTheme {
    let primary: Color
    let primaryLight: Color
    let highlight: Color
    let background: Color
    let surface: Color
    let surfaceElevated: Color
    let surfaceHighlight: Color
    let border: Color
    let borderLight: Color
    let heroGradient: [Color]
    let cardRadius: CGFloat
    let badgeRadius: CGFloat
    let angular: Bool
}

struct SeriesLabels {
    let competitor: String
    let competitors: String
    let team: String
    let dnfLabel: String
    let heroTitle: String
    let heroSubtitle: String
}

struct SeriesConfig {
    let id: String
    let name: String
    let shortName: String
    let tagline: String
    let racePoints: [Int]
    let sprintPoints: [Int]
    let fastestLapBonus: Int
    let dnfBonus: Int
    let raceTopN: Int
    let sprintTopN: Int
    let labels: SeriesLabels
    let theme: SeriesTheme

    static let f1 = SeriesConfig(
        id: "f1",
        name: "Formula 1",
        shortName: "F1",
        tagline: "Predict the grid, sprints, fastest lap, DNFs, and climb the leaderboard.",
        racePoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
        sprintPoints: [8, 7, 6, 5, 4, 3, 2, 1],
        fastestLapBonus: 1,
        dnfBonus: 10,
        raceTopN: 10,
        sprintTopN: 8,
        labels: SeriesLabels(
            competitor: "Driver", competitors: "Drivers", team: "Team",
            dnfLabel: "DNF", heroTitle: "Pick The Grid",
            heroSubtitle: "Predict the top 10. Score big. Own the paddock."
        ),
        theme: SeriesTheme(
            primary: Color(hex: "#E10600"),
            primaryLight: Color(hex: "#FF2D2D"),
            highlight: Color(hex: "#FFD700"),
            background: Color(hex: "#0B0E11"),
            surface: Color(hex: "#141820"),
            surfaceElevated: Color(hex: "#1A1F2A"),
            surfaceHighlight: Color(hex: "#232A36"),
            border: Color(hex: "#1E2530"),
            borderLight: Color(hex: "#2A3340"),
            heroGradient: [Color(hex: "#1A0204"), Color(hex: "#10060C"), Color(hex: "#0B0E11")],
            cardRadius: 16,
            badgeRadius: 12,
            angular: false
        )
    )

    static let motogp = SeriesConfig(
        id: "motogp",
        name: "MotoGP",
        shortName: "MotoGP",
        tagline: "Predict riders, sprints, race results, crashes, and fight for the championship.",
        racePoints: [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        sprintPoints: [12, 9, 7, 6, 5, 4, 3, 2, 1],
        fastestLapBonus: 1,
        dnfBonus: 10,
        raceTopN: 15,
        sprintTopN: 9,
        labels: SeriesLabels(
            competitor: "Rider", competitors: "Riders", team: "Manufacturer",
            dnfLabel: "Crash/DNF", heroTitle: "Pick Your Race",
            heroSubtitle: "Predict the top 15. Score big. Own the circuit."
        ),
        theme: SeriesTheme(
            primary: Color(hex: "#00E5FF"),
            primaryLight: Color(hex: "#4DEEFF"),
            highlight: Color(hex: "#FFF000"),
            background: Color(hex: "#0A0C0E"),
            surface: Color(hex: "#121418"),
            surfaceElevated: Color(hex: "#1A1E24"),
            surfaceHighlight: Color(hex: "#22282F"),
            border: Color(hex: "#1C2228"),
            borderLight: Color(hex: "#2A3138"),
            heroGradient: [Color(hex: "#0A1E26"), Color(hex: "#0E141A"), Color(hex: "#0A0C0E")],
            cardRadius: 4,
            badgeRadius: 2,
            angular: true
        )
    )

    static func config(for id: String) -> SeriesConfig {
        id == "motogp" ? .motogp : .f1
    }

    var isSprintWeekendSupported: Bool { true }
}

// MARK: - Shared card styling

struct CardStyle: ViewModifier {
    @Bindable var store: AppStore

    func body(content: Content) -> some View {
        content
            .padding(14)
            .background(store.series.theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: store.series.theme.cardRadius, style: store.series.theme.angular ? .rect : .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: store.series.theme.cardRadius, style: store.series.theme.angular ? .rect : .continuous)
                    .strokeBorder(store.series.theme.border, lineWidth: 1)
            )
    }
}
