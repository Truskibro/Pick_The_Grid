//
//  Theme.swift
//  PickTheGrid
//
//  Dark motorsport theme matching the Expo app.
//

import SwiftUI

enum Theme {
    static let background = Color(hex: 0x0B0E11)
    static let surface = Color(hex: 0x141820)
    static let surfaceElevated = Color(hex: 0x1A1F2A)
    static let surfaceHighlight = Color(hex: 0x232A36)
    static let border = Color(hex: 0x1E2530)
    static let borderLight = Color(hex: 0x2A3340)

    static let f1Red = Color(hex: 0xE10600)
    static let f1RedLight = Color(hex: 0xFF2D2D)
    static let f1RedDark = Color(hex: 0xB30500)

    static let accent = Color(hex: 0xFF3B30)
    static let accentGlow = Color(hex: 0xE10600).opacity(0.15)

    static let text = Color(hex: 0xF5F5F7)
    static let textSecondary = Color(hex: 0x8E8E93)
    static let textMuted = Color(hex: 0x48484A)
    static let textInverse = Color(hex: 0x0B0E11)

    static let success = Color(hex: 0x30D158)
    static let warning = Color(hex: 0xFFD60A)
    static let info = Color(hex: 0x0A84FF)
    static let error = Color(hex: 0xFF453A)

    static let gold = Color(hex: 0xFFD700)
    static let silver = Color(hex: 0xC0C0C0)
    static let bronze = Color(hex: 0xCD7F32)

    static func podiumColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return gold
        case 2: return silver
        case 3: return bronze
        default: return textSecondary
        }
    }
}

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha
        )
    }
}
