//
//  SeedData.swift
//  PickTheGrid
//
//  Seeded mock predictions and members for leaderboard population.
//

import Foundation

struct SeedUser {
    let userId: String
    let username: String
    let displayName: String
}

struct RawPrediction {
    let raceId: String
    let top10: [String]
    let fastestLap: String?
    let dnf: String?
    let sprintTop8: [String]
}

enum SeedData {
    static let completedRaceIds = ["r01", "r02", "r03", "r06", "r07", "r08"]

    static let users: [SeedUser] = [
        SeedUser(userId: "cb7536a7-ad8b-44d4-981b-4b24c19abcc4", username: "skyeleach", displayName: "Skye Leach"),
        SeedUser(userId: "652154af-dc27-47b5-aa79-25903b9c4a1b", username: "whitney", displayName: "Whitney Trujillo"),
        SeedUser(userId: "f35417e9-4f0d-4def-9c2f-c81276863fc0", username: "bryanleach", displayName: "Bryan Leach"),
        SeedUser(userId: "e11ea4f5-2ba4-4241-9791-b4b6a560534b", username: "sainz4ever55", displayName: "Carlos Trujillo"),
    ]

    static let predictions: [String: [String: RawPrediction]] = [
        "cb7536a7-ad8b-44d4-981b-4b24c19abcc4": [
            "r01": RawPrediction(raceId: "r01", top10: ["VER","RUS","ANT","PIA","LEC","NOR","HAM","HAD","LAW","SAI"], fastestLap: "VER", dnf: "STR", sprintTop8: []),
            "r02": RawPrediction(raceId: "r02", top10: ["RUS","ANT","LEC","HAM","VER","PIA","NOR","HAD","BEA","GAS"], fastestLap: "RUS", dnf: "ALO", sprintTop8: ["RUS","ANT","HAM","NOR","LEC","PIA","VER","HAD"]),
            "r03": RawPrediction(raceId: "r03", top10: ["ANT","RUS","LEC","PIA","HAM","NOR","VER","HAD","GAS","LIN"], fastestLap: "ANT", dnf: "BOT", sprintTop8: []),
            "r06": RawPrediction(raceId: "r06", top10: ["VER","ANT","NOR","LEC","RUS","HAM","PIA","HAD","GAS","BEA"], fastestLap: "VER", dnf: "COL", sprintTop8: ["ANT","NOR","PIA","RUS","LEC","VER","HAM","HAD"]),
            "r07": RawPrediction(raceId: "r07", top10: ["RUS","ANT","PIA","NOR","HAM","LEC","VER","HAD","LIN","LAW"], fastestLap: "ANT", dnf: "COL", sprintTop8: ["ANT","RUS","NOR","PIA","LEC","VER","HAM","HAD"]),
            "r08": RawPrediction(raceId: "r08", top10: ["ANT","HAM","PIA","HAD","LAW","LIN","LEC","GAS","ALB","OCO"], fastestLap: "ANT", dnf: "STR", sprintTop8: []),
        ],
        "652154af-dc27-47b5-aa79-25903b9c4a1b": [
            "r01": RawPrediction(raceId: "r01", top10: ["ANT","RUS","LEC","PIA","HAD","VER","NOR","HAM","LAW","HUL"], fastestLap: "VER", dnf: "STR", sprintTop8: []),
            "r02": RawPrediction(raceId: "r02", top10: ["RUS","ANT","LEC","HAM","PIA","VER","NOR","HAD","HUL","BEA"], fastestLap: "RUS", dnf: "STR", sprintTop8: ["ANT","RUS","NOR","HAM","VER","PIA","LEC","HAD"]),
            "r03": RawPrediction(raceId: "r03", top10: ["ANT","RUS","LEC","PIA","NOR","VER","HAM","GAS","HAD","HUL"], fastestLap: "PIA", dnf: "PER", sprintTop8: []),
            "r06": RawPrediction(raceId: "r06", top10: ["PIA","VER","NOR","ANT","LEC","RUS","HAM","COL","SAI","GAS"], fastestLap: nil, dnf: "STR", sprintTop8: ["NOR","LEC","ANT","PIA","VER","RUS","HAM","COL"]),
            "r07": RawPrediction(raceId: "r07", top10: ["RUS","ANT","NOR","PIA","VER","LEC","HAM","HAD","LIN","COL"], fastestLap: "ANT", dnf: "STR", sprintTop8: ["ANT","RUS","PIA","NOR","VER","LEC","HAM","HAD"]),
            "r08": RawPrediction(raceId: "r08", top10: ["ANT","HAM","HAD","PIA","LEC","LIN","LAW","GAS","ALB","PER"], fastestLap: "ANT", dnf: "VER", sprintTop8: []),
        ],
        "f35417e9-4f0d-4def-9c2f-c81276863fc0": [
            "r01": RawPrediction(raceId: "r01", top10: ["RUS","ANT","PIA","LEC","NOR","HAM","HAD","VER","LAW","LIN"], fastestLap: "RUS", dnf: "ALO", sprintTop8: []),
            "r02": RawPrediction(raceId: "r02", top10: ["RUS","ANT","LEC","HAM","PIA","NOR","VER","HAD","BEA","GAS"], fastestLap: "RUS", dnf: "PER", sprintTop8: ["RUS","ANT","HAM","LEC","LEC","VER","NOR","HAD"]),
            "r03": RawPrediction(raceId: "r03", top10: ["RUS","ANT","LEC","HAM","VER","PIA","NOR","HAD","GAS","LIN"], fastestLap: "RUS", dnf: "STR", sprintTop8: []),
            "r06": RawPrediction(raceId: "r06", top10: ["VER","ANT","NOR","LEC","RUS","PIA","HAM","GAS","HAD","COL"], fastestLap: "ANT", dnf: "ALO", sprintTop8: ["ANT","NOR","PIA","LEC","RUS","VER","HAM","HAD"]),
            "r07": RawPrediction(raceId: "r07", top10: ["RUS","ANT","NOR","PIA","HAM","LEC","VER","HAD","LIN","LAW"], fastestLap: "NOR", dnf: "BOT", sprintTop8: ["RUS","ANT","NOR","PIA","HAM","LEC","VER","HAD"]),
            "r08": RawPrediction(raceId: "r08", top10: ["ANT","HAM","PIA","HAD","LAW","LIN","GAS","ALB","OCO","PER"], fastestLap: "HAM", dnf: "NOR", sprintTop8: []),
        ],
        "e11ea4f5-2ba4-4241-9791-b4b6a560534b": [
            "r01": RawPrediction(raceId: "r01", top10: ["RUS","ANT","LEC","PIA","HAD","HAM","NOR","VER","LAW","HUL"], fastestLap: "RUS", dnf: "ALO", sprintTop8: []),
            "r02": RawPrediction(raceId: "r02", top10: ["RUS","ANT","HAM","LEC","NOR","PIA","VER","HAD","GAS","HUL"], fastestLap: "RUS", dnf: "ALB", sprintTop8: ["RUS","ANT","HAM","NOR","LEC","VER","PIA","GAS"]),
            "r03": RawPrediction(raceId: "r03", top10: ["ANT","RUS","LEC","HAM","PIA","NOR","HAD","VER","GAS","LIN"], fastestLap: "RUS", dnf: "STR", sprintTop8: []),
            "r06": RawPrediction(raceId: "r06", top10: ["VER","ANT","NOR","LEC","RUS","LEC","PIA","HAM","GAS","HUL"], fastestLap: "VER", dnf: nil, sprintTop8: ["NOR","ANT","PIA","LEC","RUS","VER","HAM","HAD"]),
            "r07": RawPrediction(raceId: "r07", top10: ["ANT","RUS","NOR","PIA","VER","LEC","HAM","HAD","LIN","COL"], fastestLap: "ANT", dnf: "ALO", sprintTop8: ["ANT","RUS","PIA","NOR","VER","LEC","HAM","HAD"]),
            "r08": RawPrediction(raceId: "r08", top10: ["LEC","ANT","PIA","HAM","NOR","HAD","LAW","LIN","GAS","ALB"], fastestLap: "LEC", dnf: "SAI", sprintTop8: []),
        ],
    ]

    static func scorePredictions(userId: String, results: [RaceResult]) -> Int {
        guard let userPreds = predictions[userId.lowercased()] else { return 0 }
        var total = 0
        for raceId in completedRaceIds {
            guard let raw = userPreds[raceId],
                  let result = results.first(where: { $0.raceId == raceId }) else { continue }
            let pred = Prediction(
                id: "seed-\(userId)-\(raceId)", raceId: raceId, top10: raw.top10,
                fastestLap: raw.fastestLap, dnf: raw.dnf, pointsEarned: 0,
                sprintTop8: raw.sprintTop8, sprintPointsEarned: 0,
                updatedAt: "2026-01-01T00:00:00Z", username: nil
            )
            if !raw.top10.isEmpty && !result.classification.isEmpty {
                total += Scoring.calculate(pred, result).totalPoints
            }
            if !raw.sprintTop8.isEmpty, let sprint = result.sprintClassification, !sprint.isEmpty {
                total += Scoring.calculateSprint(raw.sprintTop8, sprint).totalPoints
            }
        }
        return total
    }
}
