//
//  LeaguesView.swift
//  PickTheGridIOS
//
//  League list (mine + public), create / join sheets, and the detail screen
//  with member standings and a challenge button per member.
//

import SwiftUI

struct LeaguesView: View {
    var store: AppStore
    @State private var showCreate = false
    @State private var showJoin = false

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    if store.leagues.isEmpty {
                        VStack(spacing: 10) {
                            Image(systemName: "person.3")
                                .font(.system(size: 36))
                                .foregroundStyle(AppColors.textMuted)
                            Text("No leagues yet")
                                .font(.headline)
                                .foregroundStyle(AppColors.text)
                            Text("Create one for your friends or join with a code.")
                                .font(.subheadline)
                                .foregroundStyle(AppColors.textSecondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.vertical, 50)
                    }
                    ForEach(store.leagues) { league in
                        NavigationLink {
                            LeagueDetailView(store: store, league: league)
                        } label: {
                            leagueCard(league)
                        }
                        .buttonStyle(PressableButtonStyle())
                    }
                }
                .padding(16)
            }
            .background(theme.background)
            .navigationTitle("Leagues")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 14) {
                        Button { showJoin = true } label: {
                            Image(systemName: "plus.viewfinder")
                        }
                        Button { showCreate = true } label: {
                            Image(systemName: "square.and.pencil")
                        }
                    }
                    .foregroundStyle(theme.primary)
                }
            }
            .sheet(isPresented: $showCreate) {
                CreateLeagueSheet(store: store)
            }
            .sheet(isPresented: $showJoin) {
                JoinLeagueSheet(store: store)
            }
        }
    }

    private func leagueCard(_ league: LeagueRow) -> some View {
        let isOwner = league.ownerId == store.user?.id
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(league.name)
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(AppColors.text)
                if league.visibility == "private" {
                    Image(systemName: "lock.fill")
                        .font(.caption)
                        .foregroundStyle(AppColors.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(AppColors.textMuted)
            }
            if let description = league.description, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundStyle(AppColors.textSecondary)
                    .lineLimit(2)
            }
            HStack(spacing: 14) {
                Label("\(league.memberCount) members", systemImage: "person.2")
                if isOwner {
                    Label("Owner", systemImage: "crown")
                        .foregroundStyle(theme.highlight)
                } else {
                    Label("Code \(league.joinCode)", systemImage: "number")
                }
            }
            .font(.caption)
            .foregroundStyle(AppColors.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous)
                .strokeBorder(isOwner ? theme.primary.opacity(0.5) : theme.border, lineWidth: 1)
        )
    }
}

// MARK: - Create sheet

struct CreateLeagueSheet: View {
    var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var description = ""
    @State private var isPrivate = false
    @State private var busy = false
    @State private var errorText: String?

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        NavigationStack {
            Form {
                Section("League") {
                    TextField("Name", text: $name)
                    TextField("Description (optional)", text: $description)
                    Toggle("Private league", isOn: $isPrivate)
                }
                Section {
                    Text("Private leagues are joinable by code only. Public leagues show up for everyone playing \(store.series.shortName).")
                        .font(.footnote)
                        .foregroundStyle(AppColors.textSecondary)
                }
                if let errorText {
                    Section { Text(errorText).foregroundStyle(AppColors.error).font(.footnote) }
                }
            }
            .scrollContentBackground(.hidden)
            .background(theme.background)
            .navigationTitle("Create League")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create") { Task { await create() } }
                        .font(.body.weight(.bold))
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func create() async {
        busy = true
        errorText = nil
        do {
            try await store.createLeague(
                name: name.trimmingCharacters(in: .whitespaces),
                description: description.trimmingCharacters(in: .whitespaces),
                isPrivate: isPrivate
            )
            Haptics.success()
            dismiss()
        } catch {
            errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        busy = false
    }
}

// MARK: - Join sheet

struct JoinLeagueSheet: View {
    var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var busy = false
    @State private var errorText: String?

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        NavigationStack {
            Form {
                Section("Join code") {
                    TextField("6-digit code", text: $code)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.system(.title2, design: .monospaced).weight(.bold))
                }
                if let errorText {
                    Section { Text(errorText).foregroundStyle(AppColors.error).font(.footnote) }
                }
            }
            .scrollContentBackground(.hidden)
            .background(theme.background)
            .navigationTitle("Join League")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Join") { Task { await join() } }
                        .font(.body.weight(.bold))
                        .disabled(code.count < 4 || busy)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func join() async {
        busy = true
        errorText = nil
        do {
            try await store.joinLeague(code: code)
            Haptics.success()
            dismiss()
        } catch {
            errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        busy = false
    }
}

// MARK: - Detail

struct LeagueDetailView: View {
    var store: AppStore
    var league: LeagueRow
    @State private var challengeTarget: ProfileRow?
    @Environment(\.dismiss) private var dismiss

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                headerCard
                membersCard
            }
            .padding(16)
        }
        .background(theme.background)
        .navigationTitle(league.name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $challengeTarget) { target in
            ChallengeConfirmSheet(store: store, target: target, league: league) { sent in
                if sent { challengeTarget = nil }
            }
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(league.visibility == "private" ? "PRIVATE LEAGUE" : "PUBLIC LEAGUE")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(2)
                    .foregroundStyle(theme.primaryLight)
                Spacer()
                Text("CODE: \(league.joinCode)")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundStyle(theme.highlight)
            }
            if let description = league.description, !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(AppColors.textSecondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous)
                .strokeBorder(theme.borderLight, lineWidth: 1)
        )
    }

    private var membersCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("STANDINGS")
                .font(.system(size: 11, weight: .heavy))
                .tracking(2)
                .foregroundStyle(AppColors.textSecondary)
                .padding(.bottom, 6)

            let members = store.leagueMembers[league.id] ?? []
            if members.isEmpty {
                Text("No members yet — share the code \(league.joinCode).")
                    .font(.subheadline)
                    .foregroundStyle(AppColors.textSecondary)
                    .padding(.vertical, 10)
            } else {
                ForEach(Array(members.enumerated()), id: \.element.id) { index, member in
                    memberRow(rank: index + 1, member: member)
                    if index < members.count - 1 {
                        Divider().overlay(theme.border)
                    }
                }
            }
        }
        .padding(14)
        .background(theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .circular : .continuous)
                .strokeBorder(theme.border, lineWidth: 1)
        )
    }

    private func memberRow(rank: Int, member: LeagueMember) -> some View {
        let isMe = member.userId == store.user?.id
        return HStack(spacing: 12) {
            Text("#\(rank)")
                .font(.system(size: 14, weight: .black, design: .rounded))
                .foregroundStyle(rank == 1 ? theme.highlight : AppColors.textSecondary)
                .frame(width: 34, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(member.displayName)
                        .font(.subheadline.weight(isMe ? .bold : .medium))
                        .foregroundStyle(AppColors.text)
                    if isMe {
                        Text("YOU")
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(theme.primary)
                            .clipShape(Capsule())
                    }
                    if member.role == "owner" {
                        Image(systemName: "crown.fill")
                            .font(.caption2)
                            .foregroundStyle(theme.highlight)
                    }
                }
                Text("@\(member.username)")
                    .font(.caption2)
                    .foregroundStyle(AppColors.textMuted)
            }
            Spacer()
            Text("\(member.points) pts")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(theme.primaryLight)
            if !isMe {
                Button {
                    Haptics.tap()
                    challengeTarget = ProfileRow(
                        id: member.userId, username: member.username, displayName: member.displayName,
                        firstName: nil, lastName: nil, country: nil, totalPoints: nil, motogpTotalPoints: nil
                    )
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
        }
        .padding(.vertical, 8)
    }
}

// MARK: - Challenge confirm

struct ChallengeConfirmSheet: View {
    var store: AppStore
    var target: ProfileRow
    var league: LeagueRow
    var onDone: (Bool) -> Void

    @State private var busy = false
    @State private var errorText: String?
    @State private var sent = false

    var body: some View {
        VStack(spacing: 18) {
            Capsule().fill(AppColors.borderLight).frame(width: 40, height: 5).padding(.top, 10)

            if sent {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 40))
                    .foregroundStyle(AppColors.success)
                Text("Challenge sent!")
                    .font(.headline)
                    .foregroundStyle(AppColors.text)
                Text("You'll go head-to-head with \(target.displayName ?? target.username ?? "them") in \(league.name).")
                    .font(.subheadline)
                    .foregroundStyle(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            } else {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(store.series.theme.primary)
                Text("Challenge \(target.displayName ?? target.username ?? "them")?")
                    .font(.headline)
                    .foregroundStyle(AppColors.text)
                    .multilineTextAlignment(.center)
                Text("Head-to-head in \(league.name) for the \(store.series.shortName) season.")
                    .font(.subheadline)
                    .foregroundStyle(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
                if let errorText {
                    Text(errorText)
                        .font(.footnote)
                        .foregroundStyle(AppColors.error)
                        .multilineTextAlignment(.center)
                }
                Button {
                    Task { await send() }
                } label: {
                    if busy {
                        ProgressView().tint(.white)
                    } else {
                        Text("Send Challenge")
                            .font(.system(size: 15, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(store.series.theme.primary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .buttonStyle(PressableButtonStyle())
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .presentationDetents([.medium])
    }

    private func send() async {
        busy = true
        errorText = nil
        do {
            try await store.sendChallenge(to: target.id, in: league.id)
            sent = true
            Haptics.success()
            try? await Task.sleep(nanoseconds: 900_000_000)
            onDone(true)
        } catch {
            errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        busy = false
    }
}

#Preview {
    LeaguesView(store: .shared)
        .preferredColorScheme(.dark)
}
