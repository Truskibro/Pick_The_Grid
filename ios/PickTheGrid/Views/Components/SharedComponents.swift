//
//  SharedComponents.swift
//  PickTheGrid
//
//  Reusable UI building blocks.
//

import SwiftUI

/// Card surface with optional colored left accent border.
struct SurfaceCard<Content: View>: View {
    var accent: Color? = nil
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        HStack(spacing: 0) {
            if let accent {
                Rectangle().fill(accent).frame(width: 3)
            }
            content
                .padding(padding)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.surface)
        .clipShape(.rect(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Theme.border, lineWidth: 1)
        )
    }
}

/// Small pill badge.
struct PillBadge: View {
    let text: String
    var color: Color = Theme.f1Red
    var filled: Bool = false

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(filled ? Theme.textInverse : color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(filled ? color : color.opacity(0.15))
            .clipShape(Capsule())
    }
}

/// Section header with red label and divider line.
struct SectionHeader: View {
    let title: String
    var accent: Color = Theme.f1Red

    var body: some View {
        HStack(spacing: 10) {
            Text(title.uppercased())
                .font(.system(size: 12, weight: .heavy))
                .tracking(1.2)
                .foregroundStyle(accent)
            Rectangle()
                .fill(LinearGradient(colors: [accent.opacity(0.4), .clear], startPoint: .leading, endPoint: .trailing))
                .frame(height: 1)
        }
    }
}

/// Stat tile with icon, value and label.
struct StatTile: View {
    let icon: String
    let value: String
    let label: String
    var accent: Color = Theme.f1Red

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(accent)
            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(Theme.text)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Theme.surfaceElevated)
        .clipShape(.rect(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14).stroke(Theme.border, lineWidth: 1)
        )
    }
}

/// Driver avatar chip showing team color and short name.
struct DriverBadge: View {
    let driverId: String
    var size: CGFloat = 44

    private var team: Team? { F1Data.teamForDriver(driverId) }

    var body: some View {
        ZStack {
            Circle()
                .fill(team.map { Color(hex: $0.color) } ?? Theme.surfaceHighlight)
            Text(driverId)
                .font(.system(size: size * 0.3, weight: .heavy))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }
}

/// Gradient primary button.
struct GradientButton: View {
    let title: String
    var icon: String? = nil
    var enabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon { Image(systemName: icon).font(.system(size: 16, weight: .bold)) }
                Text(title).font(.system(size: 16, weight: .bold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(
                LinearGradient(
                    colors: enabled ? [Theme.f1RedLight, Theme.f1Red] : [Theme.surfaceHighlight, Theme.surfaceHighlight],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
            )
            .clipShape(.rect(cornerRadius: 14))
            .shadow(color: enabled ? Theme.f1Red.opacity(0.4) : .clear, radius: 12, y: 4)
        }
        .disabled(!enabled)
    }
}

/// Race countdown that updates every second.
struct CountdownTimerView: View {
    let target: Date
    var compact: Bool = false

    @State private var now = Date()
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var remaining: TimeInterval { max(0, target.timeIntervalSince(now)) }
    private var isUrgent: Bool { remaining > 0 && remaining < 900 }
    private var isLocked: Bool { remaining <= 0 }

    var body: some View {
        Group {
            if isLocked {
                Label("Predictions Locked", systemImage: "lock.fill")
                    .font(.system(size: compact ? 12 : 13, weight: .bold))
                    .foregroundStyle(Theme.textSecondary)
            } else {
                HStack(spacing: compact ? 4 : 8) {
                    if !compact {
                        Image(systemName: "timer")
                            .foregroundStyle(isUrgent ? Theme.warning : Theme.f1Red)
                    }
                    Text(formatted)
                        .font(.system(size: compact ? 13 : 16, weight: .bold, design: .monospaced))
                        .foregroundStyle(isUrgent ? Theme.warning : Theme.text)
                        .scaleEffect(isUrgent ? pulse : 1)
                }
            }
        }
        .onReceive(timer) { now = $0 }
    }

    @State private var pulse: CGFloat = 1
    private var formatted: String {
        let total = Int(remaining)
        let days = total / 86400
        let hours = (total % 86400) / 3600
        let minutes = (total % 3600) / 60
        let seconds = total % 60
        if days > 0 { return "\(days)d \(hours)h \(minutes)m" }
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }
}

extension View {
    /// Subtle slide-up + fade entrance.
    func entrance(_ delay: Double = 0) -> some View {
        modifier(EntranceModifier(delay: delay))
    }
}

private struct EntranceModifier: ViewModifier {
    let delay: Double
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 14)
            .onAppear {
                withAnimation(.easeOut(duration: 0.45).delay(delay)) { shown = true }
            }
    }
}
