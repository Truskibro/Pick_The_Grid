//
//  RankingsView.swift
//  PickTheGridIOS
//
//  Global and per-league standings with a podium for the top three.
//

import SwiftUI

struct RankingsView: View {
    var store: AppStore

    enum Scope: String, CaseIterable {
        case global = "Global"
        case league = "My League"
    }

    @State private var scope: Scope = .global
    @State private var selectedLeagueId: String?

    private var theme: SeriesTheme { store.series.theme }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Picker("Scope", selection: $scope) {
                        ForEach(Scope.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .tint(theme.primary)

                    if scope == .global {
                        globalBoard
                    } else {
                        leagueBoard
                    }
                }
                .padding(16)
            }
            .background(theme.background)
            .navigationTitle("Rankings")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func podiumRow(_ entry: LeaderboardEntry) -> some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(theme.primary.opacity(0.15))
                    .frame(width: 52, height: 52)
                Text(entry.displayName.prefix(1).uppercased())
                    .font(.system(size: 20, weight: .black, design: .rounded))
                    .foregroundStyle(theme.primaryLight)
                Circle()
                    .fill(theme.highlight)
                    .frame(width: 20, height: 20)
                    .overlay(Text("\(entry.rank)").font(.system(size: 11, weight: .black)).foregroundStyle(.black))
                    .offset(x: 20, y: -20)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.displayName)
                    .font(.headline)
                    .foregroundStyle(AppColors.text)
                Text("@\(entry.username)")
                    .font(.caption)
                    .foregroundStyle(AppColors.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(entry.points)")
                    .font(.system(size: 22, weight: .black, design: .rounded))
                    .foregroundStyle(theme.highlight)
                Text("PTS")
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(1.5)
                    .foregroundStyle(AppColors.textSecondary)
            }
        }
        .padding(12)
        .background(theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                .strokeBorder(theme.highlight.opacity(0.35), lineWidth: 1)
        )
    }

    private func standardRow(_ entry: LeaderboardEntry) -> some View {
        let isMe = entry.id == store.user?.id
        return HStack(spacing: 12) {
            Text("#\(entry.rank)")
                .font(.system(size: 13, weight: .black, design: .rounded))
                .foregroundStyle(AppColors.textSecondary)
                .frame(width: 36, alignment: .leading)
            Circle()
                .fill(theme.primary.opacity(0.12))
                .frame(width: 34, height: 34)
                .overlay(
                    Text(entry.displayName.prefix(1).uppercased())
                        .font(.system(size: 14, weight: .black, design: .rounded))
                        .foregroundStyle(theme.primaryLight)
                )
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(entry.displayName)
                        .font(.subheadline.weight(isMe ? .bold : .medium))
                        .foregroundStyle(AppColors.text)
                        .lineLimit(1)
                    if isMe {
                        Text("YOU")
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(theme.primary)
                            .clipShape(Capsule())
                    }
                }
                Text("@\(entry.username)")
                    .font(.caption2)
                    .foregroundStyle(AppColors.textMuted)
            }
            Spacer()
            Text("\(entry.points) pts")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(AppColors.text)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(isMe ? theme.primary.opacity(0.08) : .clear)
        .clipShape(RoundedRectangle(cornerRadius: theme.badgeRadius + 2))
    }

    @ViewBuilder
    private var globalBoard: some View {
        if store.leaderboard.isEmpty {
            VStack(spacing: 10) {
                ProgressView().tint(theme.primary)
                Text("Loading standings…")
                    .font(.footnote)
                    .foregroundStyle(AppColors.textSecondary)
            }
            .padding(.top, 60)
        } else {
            VStack(spacing: 10) {
                ForEach(store.leaderboard.prefix(3)) { entry in
                    podiumRow(entry)
                }
            }
            VStack(spacing: 0) {
                ForEach(Array(store.leaderboard.dropFirst(3).enumerated()), id: \.element.id) { index, entry in
                    standardRow(entry)
                    if index < store.leaderboard.count - 4 {
                        Divider().overlay(theme.border)
                    }
                }
            }
            .padding(.vertical, 6)
            .background(theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                    .strokeBorder(theme.border, lineWidth: 1)
            )
        }
    }

    @ViewBuilder
    private var leagueBoard: some View {
        let myLeagues = store.leagues
        if myLeagues.isEmpty {
            VStack(spacing: 10) {
                Image(systemName: "person.3")
                    .font(.system(size: 34))
                    .foregroundStyle(AppColors.textMuted)
                Text("Join a league to see standings here.")
                    .font(.subheadline)
                    .foregroundStyle(AppColors.textSecondary)
            }
            .padding(.top, 60)
        } else {
            Menu {
                ForEach(myLeagues) { league in
                    Button(league.name) { selectedLeagueId = league.id }
                }
            } label: {
                HStack {
                    let selected = myLeagues.first { $0.id == (selectedLeagueId ?? myLeagues.first?.id) }
                    Text(selected?.name ?? myLeagues[0].name)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(AppColors.text)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2)
                        .foregroundStyle(AppColors.textSecondary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(theme.surfaceElevated)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(theme.borderLight, lineWidth: 1))
            }

            let leagueId = selectedLeagueId ?? myLeagues[0].id
            let members = store.leagueMembers[leagueId] ?? []
            VStack(spacing: 0) {
                if members.isEmpty {
                    Text("No members yet.")
                        .font(.subheadline)
                        .foregroundStyle(AppColors.textSecondary)
                        .padding(20)
                }
                ForEach(Array(members.enumerated()), id: \.element.id) { index, member in
                    let entry = LeaderboardEntry(
                        id: member.userId, username: member.username, displayName: member.displayName,
                        points: member.points, isSeedUser: false, rank: index + 1
                    )
                    standardRow(entry)
                    if index < members.count - 1 {
                        Divider().overlay(theme.border)
                    }
                }
            }
            .padding(.vertical, 6)
            .background(theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: theme.cardRadius, style: theme.angular ? .rect : .continuous)
                    .strokeBorder(theme.border, lineWidth: 1)
            )
        }
    }
}

#Preview {
    RankingsView(store: .shared)
        .preferredColorScheme(.dark)
}
