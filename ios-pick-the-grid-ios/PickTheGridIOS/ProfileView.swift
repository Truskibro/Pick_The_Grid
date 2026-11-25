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
    @State private var showEditor = false
    @Environment(\.dismiss) private var dismiss

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    profileCard
                    editProfileButton
                    seriesCard
                    signOutButton
                }
                .padding(16)
            }
            .background(theme.background)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showEditor) {
                EditProfileView(store: store)
            }
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

    private var editProfileButton: some View {
        Button {
            Haptics.tap()
            showEditor = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "pencil.line")
                Text("Edit Profile")
                    .font(.system(size: 15, weight: .bold))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(AppColors.textMuted)
            }
            .foregroundStyle(theme.primaryLight)
            .padding(14)
            .background(theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: theme.angular ? .circular : .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: theme.angular ? .circular : .continuous)
                    .strokeBorder(theme.border, lineWidth: 1)
            )
        }
        .buttonStyle(PressableButtonStyle())
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

// MARK: - Edit Profile sheet

/// Mirrors expo/app/settings.tsx's editor: username (3-20 letters/digits/underscores),
/// display name, first/last name and country. Email is read-only (it is the sign-in).
struct EditProfileView: View {
    var store: AppStore

    @Environment(\.dismiss) private var dismiss

    @State private var displayName = ""
    @State private var username = ""
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var country = ""
    @State private var populated = false
    @State private var saving = false
    @State private var saveError: String?

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    accountSection
                    section("DISPLAY NAME") {
                        field("How your name appears on leaderboards", text: $displayName, autocap: .words)
                    }
                    section("USERNAME") {
                        field("3-20 characters, letters, numbers, underscores", text: $username, autocap: .never)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    section("NAME") {
                        field("First name", text: $firstName, autocap: .words)
                        divider
                        field("Last name", text: $lastName, autocap: .words)
                    }
                    section("COUNTRY") {
                        field("e.g. United States", text: $country, autocap: .words)
                    }
                    if let saveError {
                        errorBanner(saveError)
                    }
                    saveButton
                }
                .padding(16)
            }
            .background(theme.background)
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(AppColors.textSecondary)
                }
            }
            .onAppear(perform: populate)
        }
        .preferredColorScheme(.dark)
    }

    private func populate() {
        guard !populated else { return }
        populated = true
        displayName = store.profile?.displayName ?? store.displayName
        username = store.displayUsername
        firstName = store.profile?.firstName ?? ""
        lastName = store.profile?.lastName ?? ""
        country = store.profile?.country ?? ""
    }

    // MARK: sections

    private var accountSection: some View {
        section("ACCOUNT") {
            HStack(spacing: 10) {
                Image(systemName: "lock.fill")
                    .font(.caption)
                    .foregroundStyle(AppColors.textMuted)
                Text(store.user?.email ?? "No email on file")
                    .font(.subheadline)
                    .foregroundStyle(AppColors.textSecondary)
                Spacer()
                Text("Sign-in email")
                    .font(.caption2)
                    .foregroundStyle(AppColors.textMuted)
            }
        }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 11, weight: .heavy))
                .tracking(2)
                .foregroundStyle(AppColors.textSecondary)
            VStack(alignment: .leading, spacing: 0) {
                content()
            }
            .background(theme.background.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 2, style: theme.angular ? .circular : .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: theme.badgeRadius + 2, style: theme.angular ? .circular : .continuous)
                    .strokeBorder(theme.border, lineWidth: 1)
            )
        }
    }

    private func field(_ placeholder: String, text: Binding<String>, autocap: TextInputAutocapitalization) -> some View {
        TextField(placeholder, text: text)
            .font(.subheadline)
            .foregroundStyle(AppColors.text)
            .textInputAutocapitalization(autocap)
            .padding(12)
    }

    private var divider: some View {
        Rectangle()
            .fill(theme.borderLight)
            .frame(height: 1)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(message)
                .font(.footnote)
        }
        .foregroundStyle(AppColors.error)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(AppColors.error.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var saveButton: some View {
        Button(action: save) {
            HStack(spacing: 8) {
                if saving {
                    ProgressView()
                        .tint(AppColors.background)
                }
                Text(saving ? "Saving…" : "Save Changes")
            }
            .font(.system(size: 15, weight: .heavy))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(theme.primary)
            .foregroundStyle(AppColors.background)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: theme.angular ? .circular : .continuous))
        }
        .disabled(saving)
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: validation + save (mirrors expo/app/settings.tsx)

    private var trimmedUsername: String {
        var value = username.trimmingCharacters(in: .whitespaces)
        while value.hasPrefix("@") { value.removeFirst() }
        return value
    }

    private var validationError: String? {
        if displayName.trimmingCharacters(in: .whitespaces).isEmpty {
            return "Display name is required."
        }
        let u = trimmedUsername
        if u.isEmpty {
            return "Username is required."
        }
        if u.range(of: "^[A-Za-z0-9_]{3,20}$", options: .regularExpression) == nil {
            return "Username must be 3-20 characters: letters, numbers, and underscores only."
        }
        if country.trimmingCharacters(in: .whitespaces).isEmpty {
            return "Country is required."
        }
        return nil
    }

    private func save() {
        Haptics.tap()
        if let message = validationError {
            saveError = message
            return
        }
        saveError = nil
        saving = true
        Task {
            do {
                try await store.updateProfile(
                    username: trimmedUsername,
                    displayName: displayName.trimmingCharacters(in: .whitespaces),
                    firstName: firstName.trimmingCharacters(in: .whitespaces),
                    lastName: lastName.trimmingCharacters(in: .whitespaces),
                    country: country.trimmingCharacters(in: .whitespaces)
                )
                await MainActor.run {
                    saving = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    saving = false
                    saveError = Self.message(for: error)
                }
            }
        }
    }

    private static func message(for error: Error) -> String {
        if case SupabaseError.http(let code, let message) = error, code == 409 || message.contains("duplicate key") {
            return "That username is already taken."
        }
        return error.localizedDescription
    }
}
