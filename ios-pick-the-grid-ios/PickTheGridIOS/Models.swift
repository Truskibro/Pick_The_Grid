//
//  Models.swift
//  PickTheGridIOS
//
//  Data model ported from expo/types/index.ts. PostgREST rows decode with
//  .convertFromSnakeCase; classification jsonb stores camelCase keys as-is.
//

import Foundation

struct Team: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let color: String
    let shortName: String
}

struct Driver: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let shortName: String
    let number: Int
    let teamId: String
    let championshipPoints: Int
}

enum RaceStatus: String {
    case upcoming, live, completed, cancelled
}

struct Race: Codable, Identifiable, Hashable {
    let id: String
    let round: Int
    let name: String
    let location: String
    let country: String
    let countryFlag: String
    let raceDate: String
    let raceTime: String
    let status: String
    let hasSprint: Bool
    let sprintDate: String?
    let sprintTime: String?
    let winner: String?
    let currentLap: Int?
    let totalLaps: Int?
    let seriesId: String?

    var raceStatus: RaceStatus { RaceStatus(rawValue: status) ?? .upcoming }
}

struct ClassificationEntry: Codable, Hashable {
    let position: Int
    let driverId: String
    let time: String
    let gap: String
    let points: Int
    let status: String
}

struct RaceResult: Codable, Hashable {
    let raceId: String
    let classification: [ClassificationEntry]
    let fastestLapDriverId: String?
    let dnfDriverIds: [String]
    let dnsDriverIds: [String]
    let sprintClassification: [ClassificationEntry]?
}

/// A row of the `user_predictions` table.
struct PredictionRow: Codable, Identifiable {
    let id: String
    let userId: String
    let raceId: String
    let seriesId: String?
    let predictedTop10: [String]
    let predictedFastestLap: String?
    let predictedDnf: String?
    let pointsEarned: Int
    let predictedSprintTop8: [String]
    let sprintPointsEarned: Int
    let username: String?
    let displayName: String?
    let updatedAt: String?
}

/// A row of the `profiles` table.
struct ProfileRow: Codable, Identifiable {
    let id: String
    let username: String?
    let displayName: String?
    let firstName: String?
    let lastName: String?
    let country: String?
    let totalPoints: Int?
    let motogpTotalPoints: Int?
}

/// A row of the `leagues` table.
struct LeagueRow: Codable, Identifiable {
    let id: String
    let ownerId: String
    let name: String
    let description: String?
    let visibility: String
    let joinCode: String
    let memberCount: Int
    let createdAt: String?
    let seriesId: String?
}

/// league_members row with an embedded profile
/// (`profiles!league_members_user_id_fkey(username, display_name)`).
struct LeagueMemberRow: Codable {
    let userId: String
    let role: String
    let joinedAt: String?
    let profiles: EmbeddedProfile?
}

struct EmbeddedProfile: Codable {
    let username: String?
    let displayName: String?
}

/// challenges row with both profile embeds.
struct ChallengeRow: Codable, Identifiable {
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

// MARK: - UI-facing models

struct LeaderboardEntry: Identifiable {
    let id: String
    let username: String
    let displayName: String
    let points: Int
    let isSeedUser: Bool
    var rank: Int = 0
}

struct LeagueMember: Identifiable {
    var id: String { userId }
    let userId: String
    let username: String
    let displayName: String
    let role: String
    let points: Int
}

struct Challenge: Identifiable {
    let id: String
    let challengerId: String
    let challengedId: String
    let leagueId: String
    let seriesId: String
    let status: String
    let createdAt: String?
    let challengerName: String
    let challengedName: String

    var opponentName: String  // filled relative to the signed-in user
}

// MARK: - Auth payloads

struct SupabaseSession: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let user: SupabaseUser?
}

struct SupabaseUser: Codable {
    let id: String
    let email: String?
    let emailConfirmedAt: String?
    let userMetadata: [String: AnyCodableValue]?
}

enum AnyCodableValue: Codable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode(Bool.self) { self = .bool(v) }
        else if let v = try? container.decode(Double.self) { self = .number(v) }
        else if let v = try? container.decode(String.self) { self = .string(v) }
        else { self = .null }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let v): try container.encode(v)
        case .number(let v): try container.encode(v)
        case .bool(let v): try container.encode(v)
        case .null: try container.encodeNil()
        }
    }

    var stringValue: String? {
        if case .string(let v) = self { return v }
        return nil
    }
}
