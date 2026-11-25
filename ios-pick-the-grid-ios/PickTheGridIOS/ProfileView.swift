//
//  ProfileView.swift
//  PickTheGridIOS
//
//  Profile sheet: account info, series switcher, two-tap sign out
//  (mirroring expo/app/settings.tsx's two-tap confirm).
//

import SwiftUI

struct ProfileView: View {
    var store: AppStore

    @State private var signOutArmed = false
    @State private var signOutTimer: Timer?
    @Environment(\.dismiss) private var dismiss

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    profileCard
                    seriesCard
                    signOutButton
                }
                .padding(16)
            }
            .background(theme.background)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var profileCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(theme.primary.opacity(0.15))
                    .frame(width: 60, height: 60)
                Text(store.displayName.prefix(1).uppercased())
                    .font(.system(size: 24, weight: .black, design: .rounded))
                    .foregroundStyle(theme.primaryLight)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(store.displayName)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(AppColors.text)
                Text("@\(store.displayUsername)")
                    .font(.caption)
                    .foregroundStyle(AppColors.textSecondary)
                if let email = store.user?.email {
                    Text(email)
                        .font(.caption2)
                        .foregroundStyle(AppColors.textMuted)
                }
            }
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous)
                .strokeBorder(theme.borderLight, lineWidth: 1)
        )
    }

    private var seriesCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("SERIES")
                .font(.system(size: 11, weight: .heavy))
                .tracking(2)
                .foregroundStyle(AppColors.textSecondary)
            ForEach([SeriesConfig.f1, SeriesConfig.motogp], id: \.id) { config in
                Button {
                    Haptics.tap()
                    store.selectSeries(config.id)
                } label: {
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: config.theme.badgeRadius)
                            .fill(config.theme.primary)
                            .frame(width: 36, height: 5)
                        Text(config.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AppColors.text)
                        Spacer()
                        if store.seriesId == config.id {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(theme.primary)
                        }
                    }
                    .padding(12)
                    .background(store.seriesId == config.id ? theme.surfaceHighlight : theme.background.opacity(0.4))
                    .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 2))
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous)
                .strokeBorder(theme.border, lineWidth: 1)
        )
    }

    private var signOutButton: some View {
        Button {
            handleSignOutTap()
        } label: {
            Text(signOutArmed ? "Tap Again to Confirm Sign Out" : "Sign Out")
                .font(.system(size: 15, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(signOutArmed ? theme.surfaceHighlight : theme.surface)
                .foregroundStyle(signOutArmed ? AppColors.error : AppColors.textSecondary)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(signOutArmed ? AppColors.error : theme.borderLight, lineWidth: 1)
                )
        }
        .disabled(store.authState != .signedIn)
        .buttonStyle(PressableButtonStyle())
        .onDisappear {
            signOutTimer?.invalidate()
            signOutArmed = false
        }
    }

    private func handleSignOutTap() {
        Haptics.tap()
        guard signOutArmed else {
            signOutArmed = true
            signOutTimer?.invalidate()
            signOutTimer = Timer.scheduledTimer(withTimeInterval: 4, repeats: false) { _ in
                Task { @MainActor in
                    signOutArmed = false
                }
            }
            return
        }
        signOutTimer?.invalidate()
        signOutArmed = false
        Task {
            await store.signOut()
            dismiss()
        }
    }
}

#Preview {
    ProfileView(store: .shared)
        .preferredColorScheme(.dark)
}
