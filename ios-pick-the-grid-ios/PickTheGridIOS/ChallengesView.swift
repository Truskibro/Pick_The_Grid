//
//  ChallengesView.swift
//  PickTheGridIOS
//
//  Head-to-head challenges: incoming invites, sent challenges, recent
//  results, and user search to start a new challenge (league-only,
//  mirroring ChallengeProvider's rules: no duplicate open/accepted
//  challenge per series, declined allows re-challenge).
//

import SwiftUI

struct ChallengesView: View {
    var store: AppStore
    @State private var search = ""
    @State private var searchResults: [ProfileRow] = []
    @State private var searching = false
    @State private var challengeTarget: ProfileRow?
    @State private var respondingTo: String?

    private var theme: SeriesTheme { store.series.theme }
    private var userId: String? { store.user?.id }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    inviteSection
                    sentSection
                    recentSection
                    searchSection
                }
                .padding(16)
            }
            .background(theme.background)
            .navigationTitle("Challenges")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $challengeTarget) { target in
                leaguePickerSheet(for: target)
            }
        }
    }

    private var incoming: [Challenge] {
        store.challenges.filter { $0.challengedId == userId && $0.status == "pending" }
    }
    private var sent: [Challenge] {
        store.challenges.filter { $0.challengerId == userId && $0.status == "pending" }
    }
    private var recent: [Challenge] {
        Array(store.challenges.filter { $0.status != "pending" }.prefix(6))
    }
    private var myLeagues: [LeagueRow] { store.leagues }

    // MARK: Sections

    @ViewBuilder
    private var inviteSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("INVITES")
            if incoming.isEmpty {
                emptyLine("No open invites right now.")
            }
            ForEach(incoming) { challenge in
                inviteCard(challenge)
            }
        }
    }

    private func inviteCard(_ challenge: Challenge) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Circle()
                    .fill(theme.primary.opacity(0.12))
                    .frame(width: 38, height: 38)
                    .overlay(
                        Text(challenge.opponentName.prefix(1).uppercased())
                            .font(.system(size: 15, weight: .black, design: .rounded))
                            .foregroundStyle(theme.primaryLight)
                    )
                VStack(alignment: .leading, spacing: 1) {
                    Text(challenge.opponentName)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(AppColors.text)
                    Text(leagueName(challenge.leagueId))
                        .font(.caption)
                        .foregroundStyle(AppColors.textSecondary)
                }
                Spacer()
                Image(systemName: "bolt.fill")
                    .foregroundStyle(theme.primary)
            }
            HStack(spacing: 10) {
                Button {
                    Task { await respond(challenge, accept: true) }
                } label: {
                    if respondingTo == challenge.id && true {
                        ProgressView().tint(.black)
                    } else {
                        Text("Accept")
                            .font(.system(size: 14, weight: .bold))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(AppColors.success)
                .foregroundStyle(.black)
                .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 2))
                .buttonStyle(PressableButtonStyle())

                Button {
                    Task { await respond(challenge, accept: false) }
                } label: {
                    Text("Decline")
                        .font(.system(size: 14, weight: .bold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(theme.surfaceHighlight)
                .foregroundStyle(AppColors.text)
                .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 2))
                .buttonStyle(PressableButtonStyle())
            }
        }
        .padding(14)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous)
                .strokeBorder(theme.primary.opacity(0.4), lineWidth: 1)
        )
    }

    @ViewBuilder
    private var sentSection: some View {
        if !sent.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionTitle("SENT")
                ForEach(sent) { challenge in
                    simpleCard(challenge.opponentName, leagueName(challenge.leagueId), "clock", AppColors.warning)
                }
            }
        }
    }

    @ViewBuilder
    private var recentSection: some View {
        if !recent.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionTitle("RECENT")
                ForEach(recent) { challenge in
                    simpleCard(
                        challenge.opponentName,
                        challenge.status == "accepted" ? "Accepted · \(leagueName(challenge.leagueId))" : "Declined",
                        challenge.status == "accepted" ? "checkmark.seal.fill" : "xmark.circle",
                        challenge.status == "accepted" ? AppColors.success : AppColors.textMuted
                    )
                }
            }
        }
    }

    private var searchSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("START A CHALLENGE")
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(AppColors.textMuted)
                TextField("Search by name or username", text: $search)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onSubmit { Task { await runSearch() } }
                if !search.isEmpty {
                    Button("Find") { Task { await runSearch() } }
                        .font(.caption.weight(.bold))
                        .foregroundStyle(theme.primary)
                }
            }
            .padding(12)
            .background(theme.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(theme.borderLight, lineWidth: 1))

            if searching {
                ProgressView().tint(theme.primary).frame(maxWidth: .infinity).padding(.vertical, 8)
            }
            ForEach(searchResults) { profile in
                if profile.id != userId {
                    searchResultRow(profile)
                }
            }
            if myLeagues.isEmpty {
                Text("You need a league before you can challenge someone.")
                    .font(.caption)
                    .foregroundStyle(AppColors.textMuted)
            }
        }
    }

    private func searchResultRow(_ profile: ProfileRow) -> some View {
        HStack(spacing: 12) {
            Circle()
                .fill(theme.primary.opacity(0.12))
                .frame(width: 34, height: 34)
                .overlay(
                    Text((profile.displayName ?? profile.username ?? "?").prefix(1).uppercased())
                        .font(.system(size: 13, weight: .black, design: .rounded))
                        .foregroundStyle(theme.primaryLight)
                )
            VStack(alignment: .leading, spacing: 1) {
                Text(profile.displayName ?? profile.username ?? "Racer")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(AppColors.text)
                Text("@\(profile.username ?? "")")
                    .font(.caption2)
                    .foregroundStyle(AppColors.textMuted)
            }
            Spacer()
            Button {
                Haptics.tap()
                challengeTarget = profile
            } label: {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(theme.primary)
                    .padding(8)
                    .background(theme.primary.opacity(0.12))
                    .clipShape(Circle())
            }
            .buttonStyle(PressableButtonStyle())
        }
        .padding(.vertical, 6)
    }

    // MARK: League picker for a new challenge

    private func leaguePickerSheet(for target: ProfileRow) -> some View {
        VStack(spacing: 16) {
            Capsule().fill(AppColors.borderLight).frame(width: 40, height: 5).padding(.top, 10)
            VStack(spacing: 4) {
                Text("Challenge \(target.displayName ?? target.username ?? "")")
                    .font(.headline)
                    .foregroundStyle(AppColors.text)
                Text("Pick the league for this head-to-head.")
                    .font(.caption)
                    .foregroundStyle(AppColors.textSecondary)
            }
            if myLeagues.isEmpty {
                Text("Join or create a league first.")
                    .font(.subheadline)
                    .foregroundStyle(AppColors.textMuted)
                    .padding(.vertical, 20)
            } else {
                ForEach(myLeagues) { league in
                    Button {
                        Task { await send(to: target, leagueId: league.id) }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(league.name)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(AppColors.text)
                                Text("\(league.memberCount) members")
                                    .font(.caption2)
                                    .foregroundStyle(AppColors.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "bolt.fill")
                                .foregroundStyle(theme.primary)
                        }
                        .padding(14)
                        .background(theme.surface)
                        .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 4))
                        .overlay(
                            RoundedRectangle(cornerRadius: theme.badgeRadius + 4)
                                .strokeBorder(theme.borderLight, lineWidth: 1)
                        )
                    }
                    .buttonStyle(PressableButtonStyle())
                }
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .presentationDetents([.medium])
    }

    // MARK: Actions / helpers

    private func runSearch() async {
        searching = true
        searchResults = await store.searchProfiles(search)
        searching = false
    }

    private func respond(_ challenge: Challenge, accept: Bool) async {
        respondingTo = challenge.id
        try? await store.respondToChallenge(challenge, accept: accept)
        if accept { Haptics.success() } else { Haptics.tap() }
        respondingTo = nil
    }

    private func send(to target: ProfileRow, leagueId: String) async {
        do {
            try await store.sendChallenge(to: target.id, in: leagueId)
            Haptics.success()
            challengeTarget = nil
        } catch {
            // Duplicate open/accepted challenges are rejected server-side by RLS
            // rules; surface a short message inline.
            challengeTarget = nil
        }
    }

    private func leagueName(_ leagueId: String) -> String {
        store.leagues.first { $0.id == leagueId }?.name ?? "League"
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .heavy))
            .tracking(2)
            .foregroundStyle(AppColors.textSecondary)
    }

    private func emptyLine(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(AppColors.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(theme.surface.opacity(0.6))
            .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous))
    }

    private func simpleCard(_ title: String, _ subtitle: String, _ symbol: String, _ tint: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(AppColors.text)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(AppColors.textSecondary)
            }
            Spacer()
        }
        .padding(12)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous)
                .strokeBorder(theme.border, lineWidth: 1)
        )
    }
}

#Preview {
    ChallengesView(store: .shared)
        .preferredColorScheme(.dark)
}
