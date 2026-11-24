//
//  SeriesSelectView.swift
//  PickTheGridIOS
//
//  Series picker shown once before the app opens (stored selection after).
//

import SwiftUI

struct SeriesSelectView: View {
    var store: AppStore

    var body: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer(minLength: 40)

                VStack(spacing: 8) {
                    Text("CHOOSE YOUR SERIES")
                        .font(.system(size: 13, weight: .bold))
                        .tracking(3)
                        .foregroundStyle(AppColors.textSecondary)
                    Text("Two championships. One grid of bragging rights.")
                        .font(.subheadline)
                        .foregroundStyle(AppColors.textSecondary.opacity(0.7))
                }

                Spacer(minLength: 24)

                seriesCard(config: .f1, title: "FORMULA 1", subtitle: "22 drivers · 24 rounds · sprints")
                Spacer(minLength: 16)
                seriesCard(config: .motogp, title: "MotoGP", subtitle: "22 riders · 22 rounds · sprints")

                Spacer()
            }
            .padding(.horizontal, 20)
        }
    }

    private func seriesCard(config: SeriesConfig, title: String, subtitle: String) -> some View {
        Button {
            Haptics.tap()
            store.selectSeries(config.id)
        } label: {
            ZStack(alignment: .bottomLeading) {
                LinearGradient(
                    colors: config.theme.heroGradient + [config.theme.background],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .overlay(alignment: .topTrailing) {
                    Circle()
                        .fill(config.theme.primary.opacity(0.22))
                        .frame(width: 220, height: 220)
                        .blur(radius: 60)
                        .offset(x: 60, y: -60)
                }

                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        RoundedRectangle(cornerRadius: config.theme.badgeRadius)
                            .fill(config.theme.primary)
                            .frame(width: 44, height: 5)
                        Text(config.name.uppercased())
                            .font(.system(size: 12, weight: .heavy))
                            .tracking(2)
                            .foregroundStyle(config.theme.primaryLight)
                    }
                    Text(title)
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .foregroundStyle(AppColors.text)
                    Text(config.tagline)
                        .font(.subheadline)
                        .foregroundStyle(AppColors.textSecondary)
                        .multilineTextAlignment(.leading)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(AppColors.textMuted)
                }
                .padding(22)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 190)
            .clipShape(RoundedRectangle(cornerRadius: config.theme.cardRadius, style: config.theme.angular ? .rect : .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: config.theme.cardRadius, style: config.theme.angular ? .rect : .continuous)
                    .strokeBorder(config.theme.borderLight, lineWidth: 1)
            )
        }
        .buttonStyle(PressableButtonStyle())
    }
}

// MARK: - Shared small components

struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.8), value: configuration.isPressed)
    }
}

enum Haptics {
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

#Preview {
    SeriesSelectView(store: .shared)
        .preferredColorScheme(.dark)
}
