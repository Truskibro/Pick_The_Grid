//
//  AppModel.swift
//  PickTheGrid
//
//  Central observable app state: auth, profile, predictions, leagues, sync.
//

import SwiftUI
import Observation

@MainActor
@Observable
final class AppModel {
    // Auth
    var profile: UserProfile = .guest
    var isGuest: Bool = true
    var isLoading: Bool = true
    var authError: String?

    // Game data
    var predictions: [Prediction] = []
    var leagues: [League] = []
    var leagueMembers: [String: [LeagueMember]] = [:]
    var notifications = NotificationSettings()

    // Session (private)
    private var session: SupabaseSession?
    private var editCounts: [String: Int] = [:]

    private let service = SupabaseService.shared
    private let defaults = UserDefaults.standard

    private enum Keys {
        static let session = "ptg_session"
        static let profile = "ptg_profile"
        static let predictions = "ptg_predictions"
        static let leagues = "ptg_leagues"
        static let leagueMembers = "ptg_league_members"
        static let notifications = "ptg_notifications"
        static let editCounts = "ptg_edit_counts"
    }

    var isAuthenticated: Bool { !isGuest && session != nil }
    var userId: String? { session?.userId }

    var results: [RaceResult] { F1Data.allResults }

    init() {
        loadLocal()
    }

    // MARK: - Bootstrap

    func bootstrap() async {
        isLoading = true
        if let stored = restoreSession() {
            do {
                let refreshed = try await service.refresh(refreshToken: stored.refreshToken)
                applySession(refreshed)
                await loadProfile()
                await loadRemoteData()
            } catch {
                // Keep cached local data; stay signed in optimistically only if profile cached.
                if profile.id == "guest" {
                    clearSessionState()
                }
            }
        }
        rescoreLocalPredictions()
        isLoading = false
    }

    // MARK: - Auth flows

    func signUp(email: String, password: String, firstName: String, lastName: String, country: String) async -> Bool {
        authError = nil
        let normalizedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        let first = String(firstName.trimmingCharacters(in: .whitespaces).prefix(32))
        let last = String(lastName.trimmingCharacters(in: .whitespaces).prefix(32))

        guard isValidEmail(normalizedEmail) else {
            authError = "Please enter a valid email address."; return false
        }
        guard !first.isEmpty, !last.isEmpty else {
            authError = "Please enter your first and last name."; return false
        }
        guard password.count >= 8, password.contains(where: \.isLetter), password.contains(where: \.isNumber) else {
            authError = "Password must be at least 8 characters and include a letter and a number."; return false
        }

        let base = (first + "_" + last).lowercased()
            .replacingOccurrences(of: "[^a-z0-9_]", with: "_", options: .regularExpression)
        let username = base.count >= 3 ? String(base.prefix(20)) : "user"
        let displayName = (first + " " + last).trimmingCharacters(in: .whitespaces)

        do {
            _ = try await service.signUp(email: normalizedEmail, password: password, metadata: [
                "username": username, "display_name": displayName,
                "first_name": first, "last_name": last, "country": country.trimmingCharacters(in: .whitespaces),
            ])
            return true
        } catch {
            authError = (error as? SupabaseError)?.message ?? "Sign up failed."
            return false
        }
    }

    func signIn(email: String, password: String) async -> Bool {
        authError = nil
        do {
            let newSession = try await service.signIn(
                email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                password: password
            )
            applySession(newSession)
            await loadProfile()
            await loadRemoteData()
            rescoreLocalPredictions()
            return true
        } catch {
            authError = (error as? SupabaseError)?.message ?? "Invalid email or password."
            return false
        }
    }

    func signOut() async {
        if let token = session?.accessToken {
            await service.signOut(token: token)
        }
        clearSessionState()
        predictions = []
        leagues = []
        leagueMembers = [:]
        persistLocal()
    }

    private func applySession(_ s: SupabaseSession) {
        session = s
        isGuest = false
        if let data = try? JSONEncoder().encode(s) {
            defaults.set(data, forKey: Keys.session)
        }
    }

    private func restoreSession() -> SupabaseSession? {
        guard let data = defaults.data(forKey: Keys.session),
              let s = try? JSONDecoder().decode(SupabaseSession.self, from: data) else { return nil }
        session = s
        return s
    }

    private func clearSessionState() {
        session = nil
        isGuest = true
        profile = .guest
        defaults.removeObject(forKey: Keys.session)
        defaults.removeObject(forKey: Keys.profile)
    }

    // MARK: - Profile

    private func loadProfile() async {
        guard let s = session else { return }
        do {
            let rows = try await service.select("profiles", query: "id=eq.\(s.userId)&select=*", token: s.accessToken)
            if let row = rows.first {
                profile = profileFromRow(row)
            } else {
                // Create profile if missing.
                profile = UserProfile(
                    id: s.userId, username: "user_" + String(s.userId.prefix(8)),
                    displayName: "New Player", firstName: "", lastName: "", country: "",
                    totalPoints: 0, rank: 0, leaguesJoined: 0
                )
                try? await service.upsert("profiles", rows: [[
                    "id": s.userId, "username": profile.username, "display_name": profile.displayName,
                    "total_points": 0,
                ]], onConflict: "id", token: s.accessToken)
            }
            persistProfile()
        } catch {
            // keep cached
        }
    }

    func updateProfile(displayName: String, username: String, country: String) async {
        profile.displayName = displayName
        profile.username = username
        profile.country = country
        persistProfile()
        guard let s = session else { return }
        try? await service.upsert("profiles", rows: [[
            "id": s.userId, "username": username, "display_name": displayName,
            "first_name": profile.firstName, "last_name": profile.lastName,
            "country": country, "total_points": profile.totalPoints,
        ]], onConflict: "id", token: s.accessToken)
    }

    private func profileFromRow(_ row: [String: Any]) -> UserProfile {
        UserProfile(
            id: row["id"] as? String ?? "",
            username: row["username"] as? String ?? "player",
            displayName: row["display_name"] as? String ?? "Player",
            firstName: row["first_name"] as? String ?? "",
            lastName: row["last_name"] as? String ?? "",
            country: row["country"] as? String ?? "",
            totalPoints: row["total_points"] as? Int ?? 0,
            rank: 0, leaguesJoined: 0
        )
    }

    // MARK: - Predictions

    func prediction(for raceId: String) -> Prediction? {
        predictions.first { $0.raceId == raceId }
    }

    func editCount(for raceId: String) -> Int { editCounts[raceId] ?? 0 }

    @discardableResult
    func savePrediction(raceId: String, top10: [String], fastestLap: String?, dnf: String?, sprintTop8: [String]) async -> Bool {
        let now = ISO8601DateFormatter().string(from: Date())
        let existing = prediction(for: raceId)
        editCounts[raceId] = (editCounts[raceId] ?? 0) + 1

        var saved = Prediction(
            id: existing?.id ?? UUID().uuidString,
            raceId: raceId, top10: top10, fastestLap: fastestLap, dnf: dnf,
            pointsEarned: existing?.pointsEarned ?? 0,
            sprintTop8: sprintTop8,
            sprintPointsEarned: existing?.sprintPointsEarned ?? 0,
            updatedAt: now,
            username: existing?.username ?? (profile.id != "guest" ? profile.username : nil)
        )

        // Re-score immediately if results exist.
        if let result = results.first(where: { $0.raceId == raceId }), !result.classification.isEmpty {
            saved.pointsEarned = Scoring.calculate(saved, result).totalPoints
            if !sprintTop8.isEmpty, let sprint = result.sprintClassification {
                saved.sprintPointsEarned = Scoring.calculateSprint(sprintTop8, sprint).totalPoints
            }
        }

        predictions.removeAll { $0.raceId == raceId }
        predictions.append(saved)
        persistLocal()
        updateTotalPoints()

        guard let s = session else { return false }
        do {
            try await service.upsert("user_predictions", rows: [[
                "user_id": s.userId, "race_id": raceId,
                "predicted_top10": top10,
                "predicted_fastest_lap": fastestLap as Any,
                "predicted_dnf": dnf as Any,
                "predicted_sprint_top8": sprintTop8,
                "points_earned": saved.pointsEarned,
                "sprint_points_earned": saved.sprintPointsEarned,
                "username": profile.username,
                "updated_at": now,
            ].compactMapValues { $0 }], onConflict: "user_id,race_id", token: s.accessToken)
            return true
        } catch {
            return false
        }
    }

    private func loadRemoteData() async {
        guard let s = session else { return }
        // Predictions
        if let rows = try? await service.select("user_predictions", query: "user_id=eq.\(s.userId)&select=*", token: s.accessToken) {
            var remote: [Prediction] = rows.map { row in
                Prediction(
                    id: row["id"] as? String ?? UUID().uuidString,
                    raceId: row["race_id"] as? String ?? "",
                    top10: row["predicted_top10"] as? [String] ?? [],
                    fastestLap: row["predicted_fastest_lap"] as? String,
                    dnf: row["predicted_dnf"] as? String,
                    pointsEarned: row["points_earned"] as? Int ?? 0,
                    sprintTop8: row["predicted_sprint_top8"] as? [String] ?? [],
                    sprintPointsEarned: row["sprint_points_earned"] as? Int ?? 0,
                    updatedAt: row["updated_at"] as? String ?? "",
                    username: row["username"] as? String ?? profile.username
                )
            }
            // Merge: prefer local where newer.
            for local in predictions {
                if let idx = remote.firstIndex(where: { $0.raceId == local.raceId }) {
                    if local.updatedAt > remote[idx].updatedAt { remote[idx] = local }
                } else {
                    remote.append(local)
                }
            }
            predictions = remote
        }
        persistLocal()
        updateTotalPoints()
        await loadLeagues()
    }

    private func rescoreLocalPredictions() {
        for i in predictions.indices {
            guard let result = results.first(where: { $0.raceId == predictions[i].raceId }),
                  !result.classification.isEmpty,
                  !predictions[i].top10.isEmpty else { continue }
            predictions[i].pointsEarned = Scoring.calculate(predictions[i], result).totalPoints
            if !predictions[i].sprintTop8.isEmpty, let sprint = result.sprintClassification {
                predictions[i].sprintPointsEarned = Scoring.calculateSprint(predictions[i].sprintTop8, sprint).totalPoints
            }
        }
        persistLocal()
        updateTotalPoints()
    }

    private func updateTotalPoints() {
        let total = predictions.reduce(0) { $0 + $1.pointsEarned + $1.sprintPointsEarned }
        if total != profile.totalPoints {
            profile.totalPoints = total
            persistProfile()
            if let s = session {
                Task { try? await service.update("profiles", query: "id=eq.\(s.userId)", values: ["total_points": total], token: s.accessToken) }
            }
        }
    }

    // MARK: - Leagues

    func loadLeagues() async {
        guard let s = session else { return }
        // Memberships
        var leagueIds: [String] = []
        if let membership = try? await service.select("league_members", query: "user_id=eq.\(s.userId)&select=league_id", token: s.accessToken) {
            leagueIds = membership.compactMap { $0["league_id"] as? String }
        }
        var allRows: [[String: Any]] = []
        if !leagueIds.isEmpty {
            let inList = leagueIds.joined(separator: ",")
            if let rows = try? await service.select("leagues", query: "id=in.(\(inList))&select=*", token: s.accessToken) {
                allRows = rows
            }
        }
        if let owned = try? await service.select("leagues", query: "owner_id=eq.\(s.userId)&select=*", token: s.accessToken) {
            for o in owned where !allRows.contains(where: { ($0["id"] as? String) == (o["id"] as? String) }) {
                allRows.append(o)
            }
        }
        var mapped = allRows.map { leagueFromRow($0) }

        // Members for each league
        var membersMap: [String: [LeagueMember]] = [:]
        for league in mapped {
            if let rows = try? await service.select("league_members", query: "league_id=eq.\(league.id)&select=user_id,role,joined_at,profiles(username,display_name,total_points)", token: s.accessToken) {
                membersMap[league.id] = rows.map { mapMemberRow($0) }
            }
        }
        for i in mapped.indices {
            mapped[i].memberCount = membersMap[mapped[i].id]?.count ?? 1
        }
        leagues = mapped
        leagueMembers = membersMap
        profile.leaguesJoined = mapped.count
        persistLocal()
    }

    func discoverPublicLeagues() async -> [League] {
        guard let s = session else { return [] }
        guard let rows = try? await service.select("leagues", query: "visibility=eq.public&select=*&limit=25", token: s.accessToken) else { return [] }
        let mine = Set(leagues.map { $0.id })
        return rows.map { leagueFromRow($0) }.filter { !mine.contains($0.id) }
    }

    func createLeague(name: String, description: String, visibility: LeagueVisibility) async -> League? {
        guard let s = session else { return nil }
        let joinCode = String((0..<6).map { _ in "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".randomElement()! })
        let id = UUID().uuidString.lowercased()
        do {
            _ = try await service.insert("leagues", row: [
                "id": id, "owner_id": s.userId, "name": name,
                "description": description, "visibility": visibility.rawValue, "join_code": joinCode,
            ], token: s.accessToken)
            try? await service.insert("league_members", row: [
                "league_id": id, "user_id": s.userId, "role": "owner",
            ], token: s.accessToken, returning: false)
            await loadLeagues()
            return leagues.first { $0.id == id }
        } catch {
            return nil
        }
    }

    func findLeague(code: String) async -> League? {
        guard let s = session else { return nil }
        guard let rows = try? await service.select("leagues", query: "join_code=eq.\(code.uppercased())&select=*", token: s.accessToken),
              let row = rows.first else { return nil }
        return leagueFromRow(row)
    }

    @discardableResult
    func joinLeague(_ league: League) async -> Bool {
        guard let s = session else { return false }
        do {
            try? await service.insert("league_members", row: [
                "league_id": league.id, "user_id": s.userId, "role": "member",
            ], token: s.accessToken, returning: false)
            await loadLeagues()
            return true
        }
    }

    func deleteLeague(_ league: League) async {
        guard let s = session, league.ownerId == s.userId else { return }
        try? await service.delete("league_members", query: "league_id=eq.\(league.id)", token: s.accessToken)
        try? await service.delete("leagues", query: "id=eq.\(league.id)", token: s.accessToken)
        await loadLeagues()
    }

    private func leagueFromRow(_ row: [String: Any]) -> League {
        League(
            id: row["id"] as? String ?? "",
            name: row["name"] as? String ?? "League",
            description: row["description"] as? String ?? "",
            visibility: LeagueVisibility(rawValue: row["visibility"] as? String ?? "public") ?? .public,
            joinCode: row["join_code"] as? String ?? "",
            ownerId: row["owner_id"] as? String ?? "",
            memberCount: row["member_count"] as? Int ?? 1,
            createdAt: row["created_at"] as? String ?? ""
        )
    }

    private func mapMemberRow(_ row: [String: Any]) -> LeagueMember {
        let memberId = row["user_id"] as? String ?? ""
        let profileObj = (row["profiles"] as? [String: Any]) ?? ((row["profiles"] as? [[String: Any]])?.first ?? [:])
        let isCurrent = memberId == session?.userId
        let username = isCurrent ? profile.username : (profileObj["username"] as? String ?? "player")
        let displayName = isCurrent ? profile.displayName : (profileObj["display_name"] as? String ?? "Player")

        var points = 0
        if SeedData.users.contains(where: { $0.userId.lowercased() == memberId.lowercased() }) {
            points = SeedData.scorePredictions(userId: memberId, results: results)
        } else if isCurrent {
            points = profile.totalPoints
        } else {
            points = profileObj["total_points"] as? Int ?? 0
        }

        return LeagueMember(
            userId: memberId, username: username, displayName: displayName,
            role: LeagueRole(rawValue: row["role"] as? String ?? "member") ?? .member,
            points: points, joinedAt: row["joined_at"] as? String ?? ""
        )
    }

    // MARK: - Leaderboard

    func globalLeaderboard() -> [LeaderboardEntry] {
        var entries: [LeaderboardEntry] = SeedData.users.map { user in
            LeaderboardEntry(
                rank: 0, userId: user.userId, username: user.username,
                displayName: user.displayName,
                totalPoints: SeedData.scorePredictions(userId: user.userId, results: results)
            )
        }
        if profile.id != "guest", !entries.contains(where: { $0.userId == profile.id }) {
            entries.append(LeaderboardEntry(rank: 0, userId: profile.id, username: profile.username, displayName: profile.displayName, totalPoints: profile.totalPoints))
        }
        entries.sort { $0.totalPoints > $1.totalPoints }
        return entries.enumerated().map { idx, e in
            var copy = e; return LeaderboardEntry(rank: idx + 1, userId: copy.userId, username: copy.username, displayName: copy.displayName, totalPoints: copy.totalPoints, previousRank: nil)
        }
    }

    // MARK: - Notifications

    func updateNotifications(_ updated: NotificationSettings) {
        notifications = updated
        if let data = try? JSONEncoder().encode(updated) {
            defaults.set(data, forKey: Keys.notifications)
        }
    }

    // MARK: - Persistence

    private func loadLocal() {
        if let data = defaults.data(forKey: Keys.profile),
           let p = try? JSONDecoder().decode(UserProfile.self, from: data), p.id != "guest" {
            profile = p
            isGuest = false
        }
        if let data = defaults.data(forKey: Keys.predictions),
           let p = try? JSONDecoder().decode([Prediction].self, from: data) {
            predictions = p
        }
        if let data = defaults.data(forKey: Keys.notifications),
           let n = try? JSONDecoder().decode(NotificationSettings.self, from: data) {
            notifications = n
        }
        if let data = defaults.data(forKey: Keys.editCounts),
           let e = try? JSONDecoder().decode([String: Int].self, from: data) {
            editCounts = e
        }
    }

    private func persistLocal() {
        if let data = try? JSONEncoder().encode(predictions) {
            defaults.set(data, forKey: Keys.predictions)
        }
        if let data = try? JSONEncoder().encode(editCounts) {
            defaults.set(data, forKey: Keys.editCounts)
        }
    }

    private func persistProfile() {
        if let data = try? JSONEncoder().encode(profile) {
            defaults.set(data, forKey: Keys.profile)
        }
    }

    private func isValidEmail(_ email: String) -> Bool {
        let regex = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$"
        return email.range(of: regex, options: .regularExpression) != nil
    }
}
