//
//  AuthView.swift
//  PickTheGridIOS
//
//  Sign in / sign up against the shared Supabase project, mirroring
//  expo/app/auth.tsx: email verification enforced, inline error banners,
//  username auto-generated from the name when left blank.
//

import SwiftUI

struct AuthView: View {
    var store: AppStore

    enum Mode: String, CaseIterable {
        case signIn = "Sign In"
        case signUp = "Sign Up"
    }

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var country = "United States"
    @State private var username = ""
    @State private var busy = false
    @State private var errorText: String?
    @State private var infoText: String?

    private let countries = [
        "United States", "United Kingdom", "Canada", "Australia", "Netherlands",
        "Germany", "France", "Italy", "Spain", "Mexico", "Brazil", "Japan",
        "Austria", "Belgium", "Monaco", "Switzerland", "Other",
    ]

    var body: some View {
        ZStack {
            AppColors.background.ignoresSafeArea()
            LinearGradient(
                colors: [Color(hex: "#1A0204"), AppColors.background],
                startPoint: .top, endPoint: .center
            )
            .ignoresSafeArea()
            .opacity(0.8)

            ScrollView {
                VStack(spacing: 22) {
                    header
                    segmented
                    fields
                    if let errorText { banner(text: errorText, isError: true) }
                    if let infoText { banner(text: infoText, isError: false) }
                    submitButton
                }
                .padding(24)
                .padding(.vertical, 30)
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: "flag.checkered.2.crossed")
                .font(.system(size: 40, weight: .bold))
                .foregroundStyle(AppColors.error)
            Text("APEX DRAFT F1")
                .font(.system(size: 26, weight: .black, design: .rounded))
                .tracking(4)
                .foregroundStyle(AppColors.text)
            Text("Predict. Score. Own the paddock.")
                .font(.subheadline)
                .foregroundStyle(AppColors.textSecondary)
        }
        .padding(.top, 20)
    }

    private var segmented: some View {
        HStack(spacing: 0) {
            ForEach(Mode.allCases, id: \.self) { candidate in
                Button {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) {
                        mode = candidate
                        errorText = nil
                        infoText = nil
                    }
                } label: {
                    Text(candidate.rawValue)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(mode == candidate ? AppColors.text : AppColors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            Group {
                                if mode == candidate {
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(AppColors.surfaceElevated)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .strokeBorder(AppColors.error.opacity(0.6), lineWidth: 1)
                                        )
                                }
                            }
                        )
                }
            }
        }
        .padding(4)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(AppColors.border, lineWidth: 1))
    }

    private var fields: some View {
        VStack(spacing: 12) {
            if mode == .signUp {
                HStack(spacing: 12) {
                    fieldIcon("person")
                    TextField("First name", text: $firstName)
                        .autocorrectionDisabled()
                    TextField("Last name", text: $lastName)
                        .autocorrectionDisabled()
                }
                .cardField()

                HStack(spacing: 12) {
                    fieldIcon("globe")
                    Picker("Country", selection: $country) {
                        ForEach(countries, id: \.self) { Text($0).tag($0) }
                    }
                    .tint(AppColors.text)
                }
                .cardField()

                HStack(spacing: 12) {
                    fieldIcon("at")
                    TextField("Username (optional)", text: $username)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
                .cardField()
            }

            HStack(spacing: 12) {
                fieldIcon("envelope")
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
            .cardField()

            HStack(spacing: 12) {
                fieldIcon("lock")
                SecureField("Password (min 6 characters)", text: $password)
            }
            .cardField()
        }
    }

    private func fieldIcon(_ symbol: String) -> some View {
        Image(systemName: symbol)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(AppColors.textMuted)
            .frame(width: 18)
    }

    private var submitButton: some View {
        Button {
            submit()
        } label: {
            HStack {
                if busy {
                    ProgressView().tint(.white)
                } else {
                    Text(mode == .signIn ? "Sign In" : "Create Account")
                        .font(.system(size: 16, weight: .bold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(AppColors.error)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(busy)
        .buttonStyle(PressableButtonStyle())
        .padding(.top, 4)
    }

    private func banner(text: String, isError: Bool) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: isError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                .foregroundStyle(isError ? AppColors.error : AppColors.success)
            Text(text)
                .font(.footnote)
                .foregroundStyle(AppColors.text.opacity(0.9))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(AppColors.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder((isError ? AppColors.error : AppColors.success).opacity(0.4), lineWidth: 1))
    }

    private func submit() {
        Haptics.tap()
        errorText = nil
        infoText = nil
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        let trimmedFirst = firstName.trimmingCharacters(in: .whitespaces)
        let trimmedLast = lastName.trimmingCharacters(in: .whitespaces)

        guard trimmedEmail.contains("@"), trimmedEmail.contains(".") else {
            errorText = "Enter a valid email address."
            return
        }
        guard password.count >= 6 else {
            errorText = "Password must be at least 6 characters."
            return
        }
        if mode == .signUp {
            guard !trimmedFirst.isEmpty, !trimmedLast.isEmpty else {
                errorText = "Enter your first and last name."
                return
            }
        }

        busy = true
        Task {
            do {
                if mode == .signIn {
                    try await store.signIn(email: trimmedEmail, password: password)
                    Haptics.success()
                } else {
                    try await store.signUp(
                        email: trimmedEmail, password: password,
                        firstName: trimmedFirst, lastName: trimmedLast,
                        country: country, username: username
                    )
                    infoText = "Account created! Check \(trimmedEmail) for the verification link, then sign in here."
                    mode = .signIn
                    Haptics.success()
                }
            } catch {
                errorText = friendlyMessage(error)
            }
            busy = false
        }
    }

    private func friendlyMessage(_ error: Error) -> String {
        let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        if message.lowercased().contains("invalid login") || message.lowercased().contains("invalid credentials") {
            return "Wrong email or password. Try again."
        }
        if message.lowercased().contains("email not confirmed") {
            return "Verify your email first — check your inbox for the link."
        }
        if message.lowercased().contains("already registered") {
            return "That email already has an account. Sign in instead."
        }
        if message.lowercased().contains("username") && message.lowercased().contains("taken") {
            return "That username is taken — pick another."
        }
        return message
    }
}

private extension View {
    func cardField() -> some View {
        padding(14)
            .background(AppColors.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(AppColors.borderLight, lineWidth: 1))
            .font(.system(size: 15))
            .foregroundStyle(AppColors.text)
    }
}

#Preview {
    AuthView(store: .shared)
        .preferredColorScheme(.dark)
}
