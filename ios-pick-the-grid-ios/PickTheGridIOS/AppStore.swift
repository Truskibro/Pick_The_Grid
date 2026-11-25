//
//  AppStore.swift
//  PickTheGridIOS
//
//  Central observable store. Mirrors the Expo providers (UserProvider,
//  F1DataProvider, MotoGPDataProvider, GameProvider, ChallengeProvider).
//

import Foundation
import SwiftUI

struct SessionUser {
    let id: String
    let email: String
}

@Observable
@MainActor
final class AppStore {
    static let shared = AppStore()

    let supabase = SupabaseService.shared

    enum AuthState { case loading, signedOut, signedIn }

    var authState: AuthState = .loading
    var user: SessionUser?
    var profile: ProfileRow?

    var seriesId: String {
        didSet { UserDefaults.standard.set(seriesId, forKey: "selectedSeries") }
    }
    var series: SeriesConfig { SeriesConfig.config(for: seriesId) }

    // Series data
    var races: [Race] = []
    var drivers: [Driver] = []
    var teams: [Team] = []
    var resultsByRace: [String: RaceResult] = [:]

    // My predictions (raceId -> scored row)
    var myPredictions: [String: PredictionRow] = [:]

    // Leaderboard
    var leaderboard: [LeaderboardEntry] = []
    var totalPoints: Int { leaderboard.first(where: { $0.id == user?.id })?.points ?? 0 }
    var globalRank: Int { leaderboard.first(where: { $0.id == user?.id })?.rank ?? 0 }

    // Leagues
    var leagues: [LeagueRow] = []
    var leagueMembers: [String: [LeagueMember]] = [:]
    var totalPointsByUser: [String: Int] = [:]

    // Challenges
    var challenges: [Challenge] = []

    var loadingData = false
    var dataError: String?

    var nextRace: Race? {
        races
            .filter { $0.raceStatus == .upcoming || $0.raceStatus == .live }
            .min { $0.raceDate < $1.raceDate }
    }

    var lastCompletedRace: Race? {
        races.filter { $0.raceStatus == .completed }.max { $0.raceDate < $1.raceDate }
    }

    private init() {
        seriesId = UserDefaults.standard.string(forKey: "selectedSeries") ?? ""
    }

    var hasSelectedSeries: Bool { !seriesId.isEmpty }

    func selectSeries(_ id: String) {
        seriesId = id
        Task { await loadSeriesData(force: true) }
    }

    // MARK: - Bootstrap

    func bootstrap() async {
        if let session = supabase.session {
            user = SessionUser(id: session.userId, email: session.email)
            authState = .signedIn
            async let _profile: Void = loadProfile()
            async let _data: Void = loadSeriesData(force: false)
            _ = await (_profile, _data)
        } else {
            authState = .signedOut
        }
    }

    // MARK: - Auth

    func signUp(email: String, password: String, firstName: String, lastName: String, country: String, username: String) async throws {
        let normalizedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        let generatedUsername = username.isEmpty
            ? Self.autoUsername(firstName: firstName, lastName: lastName)
            : username
        try await supabase.signUp(
            email: normalizedEmail,
            password: password,
            data: [
                "username": generatedUsername,
                "display_name": "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces),
                "first_name": firstName,
                "last_name": lastName,
                "country": country,
            ]
        )
    }

    func signIn(email: String, password: String) async throws {
        let normalizedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()
        let authUser = try await supabase.signIn(email: normalizedEmail, password: password)
        user = SessionUser(id: authUser.id, email: authUser.email ?? normalizedEmail)
        authState = .signedIn
        await loadProfile()
        await loadSeriesData(force: true)
    }

    func signOut() async {
        await supabase.signOut()
        user = nil
        profile = nil
        myPredictions = [:]
        leaderboard = []
        leagues = []
        leagueMembers = [:]
        challenges = []
        authState = .signedOut
    }

    private static func autoUsername(firstName: String, lastName: String) -> String {
        let base = (firstName.lowercased() + lastName.prefix(1).lowercased())
            .filter { $0.isLetter || $0.isNumber }
        return base.isEmpty ? "racer\(Int.random(in: 1000...9999))" : base + String(Int.random(in: 10...99))
    }

    // MARK: - Profile

    func loadProfile() async {
        guard let userId = user?.id else { return }
        do {
            let rows: [ProfileRow] = try await supabase.select("profiles", query: ["id": "eq.\(userId)"])
            profile = rows.first
        } catch {
            // Profile is optional for browsing; the trigger creates it server-side.
        }
    }

    var displayUsername: String {
        if let username = profile?.username { return username }
        if let email = user?.email {
            return email.components(separatedBy: "@").first ?? "racer"
        }
        return "racer"
    }

    var displayName: String {
        profile?.displayName ?? displayUsername
    }

    // MARK: - Series data

    func loadSeriesData(force: Bool) async {
        guard hasSelectedSeries else { return }
        loadingData = true
        dataError = nil
        defer { loadingData = false }

        if seriesId == "motogp" {
            loadMotogpData()
        } else {
            await loadF1Data()
        }
        await loadMyPredictions()
        await loadLeaderboard()
        await loadLeaguesAndPoints()
        await loadChallenges()
    }

    private func loadMotogpData() {
        teams = MOTOGP_TEAMS_DATA
        drivers = MOTOGP_RIDERS_DATA
        races = MOTOGP_RACES_DATA.map { race in
            // Live status, same as Expo's updateRaceStatuses.
            var race = race
            if race.raceStatus == .upcoming, let date = Self.parseDate(race.raceDate, race.raceTime), date < Date() {
                race = Race(
                    id: race.id, round: race.round, name: race.name, location: race.location,
                    country: race.country, countryFlag: race.countryFlag, raceDate: race.raceDate,
                    raceTime: race.raceTime, status: "completed", hasSprint: race.hasSprint,
                    sprintDate: race.sprintDate, sprintTime: race.sprintTime, winner: race.winner,
                    currentLap: race.currentLap, totalLaps: race.totalLaps, seriesId: race.seriesId
                )
            }
            return race
        }
        var results: [String: RaceResult] = [:]
        for result in MOTOGP_RACE_RESULTS_DATA { results[result.raceId] = result }
        resultsByRace = results
    }

    private func loadF1Data() async {
        // Supabase is the primary source (same as the Expo app), with the
        // bundled 2026 constants as fallback when it is unreachable or empty.
        var loadedTeams: [Team] = F1_FALLBACK_TEAMS
        var loadedDrivers: [Driver] = F1_FALLBACK_DRIVERS
        var loadedRaces: [Race] = F1_FALLBACK_RACES
        var loadedResults: [String: RaceResult] = [:]

        do {
            let t: [Team] = try await supabase.select("teams", query: ["order": "name"])
            let d: [Driver] = try await supabase.select("drivers", query: ["order": "championship_points.desc"])
            let r: [Race] = try await supabase.select("races", query: ["order": "race_date"])
            let res: [RaceResult] = try await supabase.select("race_results", query: [String: String]())

            if !t.isEmpty { loadedTeams = t }
            if !d.isEmpty { loadedDrivers = d }
            if !r.isEmpty {
                // Prefer DB rows; fill missing sprint schedule from the bundled calendar.
                let fallback = Dictionary(uniqueKeysWithValues: F1_FALLBACK_RACES.map { ($0.id, $0) })
                loadedRaces = r.map { race in
                    guard let fb = fallback[race.id] else { return race }
                    return Race(
                        id: race.id, round: race.round, name: race.name, location: race.location,
                        country: race.country, countryFlag: race.countryFlag, raceDate: race.raceDate,
                        raceTime: race.raceTime, status: race.status, hasSprint: race.hasSprint,
                        sprintDate: race.sprintDate ?? fb.sprintDate, sprintTime: race.sprintTime ?? fb.sprintTime,
                        winner: race.winner, currentLap: race.currentLap, totalLaps: race.totalLaps,
                        seriesId: race.seriesId ?? "f1"
                    )
                }
            }
            for result in res { loadedResults[result.raceId] = result }
        } catch {
            // Offline / unreachable: fall through to the bundled constants.
        }

        // Live status for bundled fallback rows (matching updateRaceStatuses).
        loadedRaces = loadedRaces.map { race in
            var race = race
            if race.raceStatus == .upcoming, let date = Self.parseDate(race.raceDate, race.raceTime), date < Date() {
                race = Self.withStatus(race, "completed")
            }
            return race
        }

        teams = loadedTeams
        drivers = loadedDrivers
        races = loadedRaces
        resultsByRace = loadedResults
    }

    static func withStatus(_ race: Race, _ status: String) -> Race {
        Race(
            id: race.id, round: race.round, name: race.name, location: race.location,
            country: race.country, countryFlag: race.countryFlag, raceDate: race.raceDate,
            raceTime: race.raceTime, status: status, hasSprint: race.hasSprint,
            sprintDate: race.sprintDate, sprintTime: race.sprintTime, winner: race.winner,
            currentLap: race.currentLap, totalLaps: race.totalLaps, seriesId: race.seriesId
        )
    }

    static func parseDate(_ date: String, _ time: String?) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.date(from: "\(date) \(time ?? "14:00")")
    }

    func driver(_ id: String?) -> Driver? {
        guard let id else { return nil }
        return drivers.first { $0.id == id }
    }

    func team(_ id: String?) -> Team? {
        guard let id else { return nil }
        return teams.first { $0.id == id }
    }

    func teamColor(forDriverId id: String?) -> Color {
        let team = self.team(driver(id)?.teamId)
        return Color(hex: team?.color ?? "#666666")
    }

    func result(for raceId: String) -> RaceResult? { resultsByRace[raceId] }

    // MARK: - Predictions

    func loadMyPredictions() async {
        guard let userId = user?.id, hasSelectedSeries else { return }
        do {
            let rows: [PredictionRow] = try await supabase.select(
                "user_predictions",
                query: [
                    "user_id": "eq.\(userId)",
                    "series_id": "eq.\(seriesId)",
                ]
            )
            var map: [String: PredictionRow] = [:]
            for row in rows { map[row.raceId] = row }
            myPredictions = map
        } catch {
            // Keep whatever we had; predictions are still viewable from cache.
        }
    }

    func savePrediction(race: Race, top10: [String], fastestLap: String?, dnf: String?, sprintTop8: [String]) async throws {
        guard let userId = user?.id else { throw SupabaseError.notSignedIn }
        let username = displayUsername
        let displayName = profile?.displayName ?? username

        // Mirror ensureSupabaseProfileForPrediction: keep the profile row present.
        try? await supabase.upsert(
            "profiles",
            body: ["id": userId, "username": username, "display_name": displayName],
            onConflict: "id"
        )

        var payload: [String: Any] = [
            "p_race_id": race.id,
            "p_predicted_top10": top10,
            "p_predicted_fastest_lap": fastestLap ?? NSNull(),
            "p_predicted_dnf": dnf ?? NSNull(),
            "p_points_earned": 0,
            "p_predicted_sprint_top8": sprintTop8,
            "p_sprint_points_earned": 0,
            "p_username": username,
            "p_display_name": displayName,
            "p_series_id": seriesId,
        ]
        do {
            try await supabase.rpc("save_user_prediction", body: payload)
        } catch let error as SupabaseError {
            // Older DB without the multiseries RPC: retry without p_series_id.
            if case .http(let code, let message) = error,
               code == 404 || message.contains("p_series_id") || message.contains("schema cache") || message.contains("42883") {
                payload.removeValue(forKey: "p_series_id")
                try await supabase.rpc("save_user_prediction", body: payload)
            } else {
                throw error
            }
        }
        await loadMyPredictions()
    }

    // MARK: - Leaderboard

    func loadLeaderboard() async {
        guard hasSelectedSeries else { return }
        do {
            let profiles: [ProfileRow] = try await supabase.select("profiles", query: ["select": "id,username,display_name"])
            let preds: [PredictionRow] = try await supabase.select(
                "user_predictions",
                query: ["select": "user_id,points_earned,sprint_points_earned", "series_id": "eq.\(seriesId)"]
            )

            var points: [String: Int] = [:]
            for pred in preds {
                points[pred.userId, default: 0] += pred.pointsEarned + pred.sprintPointsEarned
            }

            var entries = profiles.map { profile in
                LeaderboardEntry(
                    id: profile.id,
                    username: profile.username ?? "racer",
                    displayName: profile.displayName ?? profile.username ?? "Racer",
                    points: points[profile.id] ?? 0,
                    isSeedUser: false
                )
            }

            // Seed users appear on the F1 board, mirroring buildSeedLeaderboard.
            if seriesId == "f1" {
                let presentIds = Set(entries.map(\.id))
                let f1Results = resultsByRace.values.filter { $0.raceId.hasPrefix("r") }
                for seed in SEED_USERS_DATA where !presentIds.contains(seed.userId) {
                    let seedPoints = scoreSeededPredictions(userId: seed.userId, results: f1Results, series: .f1)
                    entries.append(LeaderboardEntry(
                        id: seed.userId,
                        username: seed.username,
                        displayName: seed.displayName,
                        points: seedPoints,
                        isSeedUser: true
                    ))
                }
            }

            entries.sort { $0.points > $1.points }
            for index in entries.indices { entries[index].rank = index + 1 }
            leaderboard = entries
        } catch {
            // Supabase unreachable: seed leaderboard for F1, empty for others.
            if seriesId == "f1" {
                let f1Results = resultsByRace.values.filter { $0.raceId.hasPrefix("r") }
                leaderboard = SEED_USERS_DATA.map { seed in
                    LeaderboardEntry(
                        id: seed.userId,
                        username: seed.username,
                        displayName: seed.displayName,
                        points: scoreSeededPredictions(userId: seed.userId, results: f1Results, series: .f1),
                        isSeedUser: true
                    )
                }.sorted { $0.points > $1.points }
                .enumerated().map { (index, entry) in
                    var entry = entry
                    entry.rank = index + 1
                    return entry
                }
            } else {
                leaderboard = []
            }
        }
        totalPointsByUser = Dictionary(uniqueKeysWithValues: leaderboard.map { ($0.id, $0.points) })
    }

    // MARK: - Leagues

    func loadLeaguesAndPoints() async {
        guard hasSelectedSeries else { return }
        do {
            var memberLeagueIds: [String] = []
            if let userId = user?.id {
                struct IdRow: Codable { let leagueId: String }
                let idRows: [IdRow] = try await supabase.select(
                    "league_members",
                    query: ["select": "league_id", "user_id": "eq.\(userId)"]
                )
                memberLeagueIds = idRows.map(\.leagueId)
            }

            let idList = memberLeagueIds.map { "\"\($0)\"" }.joined(separator: ",")
            let orFilter = idList.isEmpty ? "visibility.eq.public" : "or(id.in.(\(idList)),visibility.eq.public)"
            let rows: [LeagueRow] = try await supabase.select(
                "leagues",
                query: [
                    "or": orFilter,
                    "series_id": "eq.\(seriesId)",
                    "order": "created_at.desc",
                ]
            )
            leagues = rows
            await loadLeagueMembers()
        } catch {
            // Keep cache on failure.
        }
    }

    func loadLeagueMembers() async {
        guard !leagues.isEmpty else { return }
        let ids = leagues.map(\.id).map { "\"\($0)\"" }.joined(separator: ",")
        struct Row: Codable {
            let leagueId: String
            let userId: String
            let role: String
            let joinedAt: String?
            let profiles: EmbeddedProfile?
        }
        do {
            let rows: [Row] = try await supabase.select(
                "league_members",
                query: [
                    "select": "league_id,user_id,role,joined_at,profiles!league_members_user_id_fkey(username,display_name)",
                    "league_id": "in.(\(ids))",
                ]
            )
            var map: [String: [LeagueMember]] = [:]
            for row in rows {
                let name = row.profiles?.displayName ?? row.profiles?.username ?? "Racer"
                let member = LeagueMember(
                    userId: row.userId,
                    username: row.profiles?.username ?? "racer",
                    displayName: name,
                    role: row.role,
                    points: totalPointsByUser[row.userId] ?? 0
                )
                map[row.leagueId, default: []].append(member)
            }
            for key in map.keys { map[key]?.sort { $0.points > $1.points } }
            leagueMembers = map
        } catch {
            // Keep cache.
        }
    }

    func createLeague(name: String, description: String, isPrivate: Bool) async throws {
        guard let userId = user?.id else { throw SupabaseError.notSignedIn }
        let code = String(format: "%06d", Int.random(in: 0...999_999))
        struct CreatedLeague: Codable { let id: String }
        let created: [CreatedLeague] = try await supabase.insert(
            "leagues",
            body: [
                "owner_id": userId,
                "name": name,
                "description": description,
                "visibility": isPrivate ? "private" : "public",
                "join_code": code,
                "member_count": 1,
                "series_id": seriesId,
            ]
        )
        if let leagueId = created.first?.id {
            try? await supabase.insertRaw(
                "league_members",
                body: ["league_id": leagueId, "user_id": userId, "role": "owner"]
            )
        }
        await loadLeaguesAndPoints()
    }

    func joinLeague(code: String) async throws {
        guard let userId = user?.id else { throw SupabaseError.notSignedIn }
        struct CodeRow: Codable { let id: String }
        let matches: [CodeRow] = try await supabase.select(
            "leagues",
            query: ["select": "id", "join_code": "eq.\(code.trimmingCharacters(in: .whitespaces).uppercased())"]
        )
        guard let leagueId = matches.first?.id else {
            throw SupabaseError.http(404, "No league found with that code")
        }
        try await supabase.insertRaw("league_members", body: ["league_id": leagueId, "user_id": userId, "role": "member"])
        await loadLeaguesAndPoints()
    }

    // MARK: - Challenges

    func loadChallenges() async {
        guard let userId = user?.id, hasSelectedSeries else { return }
        struct RawChallenge: Codable {
            let id: String
            let challengerId: String
            let challengedId: String
            let leagueId: String
            let seriesId: String?
            let status: String
            let createdAt: String?
            let challenger: EmbeddedProfile?
            let challenged: EmbeddedProfile?
        }
        do {
            let rows: [RawChallenge] = try await supabase.select(
                "challenges",
                query: [
                    "select": "id,challenger_id,challenged_id,league_id,series_id,status,created_at,challenger:profiles!challenges_challenger_id_fkey(username,display_name),challenged:profiles!challenges_challenged_id_fkey(username,display_name)",
                    "or": "(challenger_id.eq.\(userId),challenged_id.eq.\(userId))",
                    "order": "created_at.desc",
                ]
            )
            challenges = rows.map { row in
                var challenge = Challenge(
                    id: row.id,
                    challengerId: row.challengerId,
                    challengedId: row.challengedId,
                    leagueId: row.leagueId,
                    seriesId: row.seriesId ?? "f1",
                    status: row.status,
                    createdAt: row.createdAt,
                    challengerName: row.challenger?.displayName ?? row.challenger?.username ?? "Racer",
                    challengedName: row.challenged?.displayName ?? row.challenged?.username ?? "Racer",
                    opponentName: ""
                )
                challenge.opponentName = row.challengerId == userId ? challenge.challengedName : challenge.challengerName
                return challenge
            }
        } catch {
            // Keep cache.
        }
    }

    func searchProfiles(_ query: String) async -> [ProfileRow] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else { return [] }
        struct Hit: Codable { let id: String; let username: String?; let displayName: String? }
        do {
            let rows: [Hit] = try await supabase.select(
                "profiles",
                query: [
                    "select": "id,username,display_name",
                    "or": "(username.ilike.*\(trimmed)*,display_name.ilike.*\(trimmed)*)",
                    "limit": "10",
                ]
            )
            return rows.map { ProfileRow(id: $0.id, username: $0.username, displayName: $0.displayName, firstName: nil, lastName: nil, country: nil, totalPoints: nil, motogpTotalPoints: nil) }
        } catch {
            return []
        }
    }

    func sendChallenge(to userId: String, in leagueId: String) async throws {
        guard let me = user?.id else { throw SupabaseError.notSignedIn }
        guard userId != me else { throw SupabaseError.http(400, "You cannot challenge yourself") }
        try await supabase.insertRaw(
            "challenges",
            body: [
                "challenger_id": me,
                "challenged_id": userId,
                "league_id": leagueId,
                "series_id": seriesId,
                "status": "pending",
            ]
        )
        await loadChallenges()
    }

    func respondToChallenge(_ challenge: Challenge, accept: Bool) async throws {
        try await supabase.update(
            "challenges",
            query: ["id": "eq.\(challenge.id)"],
            body: ["status": accept ? "accepted" : "declined"]
        )
        await loadChallenges()
    }
}
