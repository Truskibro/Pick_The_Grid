//
//  Models.swift
//  PickTheGrid
//
//  Core data models for the F1 prediction app.
//

import Foundation

struct Team: Identifiable, Hashable {
    let id: String
    let name: String
    let color: UInt
    let shortName: String
}

struct Driver: Identifiable, Hashable {
    let id: String
    let name: String
    let shortName: String
    let number: Int
    let teamId: String
    let championshipPoints: Int
}

enum RaceStatus: String, Codable {
    case upcoming
    case live
    case completed
    case cancelled
}

struct Race: Identifiable, Hashable {
    let id: String
    let round: Int
    let name: String
    let location: String
    let country: String
    let raceDate: String
    let raceTime: String
    let status: RaceStatus
    let hasSprint: Bool
    var winner: String?
    var totalLaps: Int?

    /// Combined UTC date for sorting / countdowns.
    var dateTime: Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: "\(raceDate)T\(raceTime):00Z") ?? Date.distantFuture
    }

    /// Predictions lock 1 hour before the race start.
    var lockDate: Date {
        dateTime.addingTimeInterval(-3600)
    }

    var isLocked: Bool {
        Date() >= lockDate
    }
}

enum ClassificationStatus: String, Codable {
    case finished
    case retired
    case dnf
    case dns
}

struct ClassificationEntry: Identifiable, Hashable {
    var id: String { "\(position)-\(driverId)" }
    let position: Int
    let driverId: String
    let time: String
    let gap: String
    let points: Int
    let status: ClassificationStatus
}

struct RaceResult: Hashable {
    let raceId: String
    let classification: [ClassificationEntry]
    let fastestLapDriverId: String?
    let dnfDriverIds: [String]
    let dnsDriverIds: [String]
    let sprintClassification: [ClassificationEntry]?

    init(
        raceId: String,
        classification: [ClassificationEntry],
        fastestLapDriverId: String?,
        dnfDriverIds: [String],
        dnsDriverIds: [String] = [],
        sprintClassification: [ClassificationEntry]? = nil
    ) {
        self.raceId = raceId
        self.classification = classification
        self.fastestLapDriverId = fastestLapDriverId
        self.dnfDriverIds = dnfDriverIds
        self.dnsDriverIds = dnsDriverIds
        self.sprintClassification = sprintClassification
    }
}

struct Prediction: Identifiable, Hashable, Codable {
    var id: String
    var raceId: String
    var top10: [String]
    var fastestLap: String?
    var dnf: String?
    var pointsEarned: Int
    var sprintTop8: [String]
    var sprintPointsEarned: Int
    var updatedAt: String
    var username: String?
}

enum LeagueVisibility: String, Codable {
    case `public`
    case `private`
}

struct League: Identifiable, Hashable {
    let id: String
    var name: String
    var description: String
    var visibility: LeagueVisibility
    var joinCode: String
    var ownerId: String
    var memberCount: Int
    var createdAt: String
}

enum LeagueRole: String, Codable {
    case owner
    case member
}

struct LeagueMember: Identifiable, Hashable {
    var id: String { userId }
    let userId: String
    var username: String
    var displayName: String
    var role: LeagueRole
    var points: Int
    var joinedAt: String
}

struct UserProfile: Codable, Hashable {
    var id: String
    var username: String
    var displayName: String
    var firstName: String
    var lastName: String
    var country: String
    var totalPoints: Int
    var rank: Int
    var leaguesJoined: Int

    static let guest = UserProfile(
        id: "guest",
        username: "guest",
        displayName: "Guest Player",
        firstName: "",
        lastName: "",
        country: "",
        totalPoints: 0,
        rank: 0,
        leaguesJoined: 0
    )

    var initials: String {
        let source = displayName.isEmpty ? username : displayName
        let parts = source.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(source.prefix(2)).uppercased()
    }
}

struct LeaderboardEntry: Identifiable, Hashable {
    var id: String { userId }
    let rank: Int
    let userId: String
    let username: String
    let displayName: String
    let totalPoints: Int
    var previousRank: Int?
}

struct NotificationSettings: Codable, Hashable {
    var lockReminder: Bool = true
    var raceStartReminder: Bool = true
    var resultsPosted: Bool = true
}

// Scoring constants
enum ScoringConstants {
    static let f1Points = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    static let sprintPoints = [8, 7, 6, 5, 4, 3, 2, 1]
    static let fastestLapBonus = 1
    static let dnfBonus = 10
}

struct Country: Identifiable, Hashable {
    var id: String { code }
    let name: String
    let code: String

    /// Emoji flag from ISO country code.
    var flag: String {
        code.unicodeScalars.reduce("") { result, scalar in
            guard let v = UnicodeScalar(127397 + scalar.value) else { return result }
            return result + String(v)
        }
    }
}
