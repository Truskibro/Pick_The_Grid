//
//  Scoring.swift
//  PickTheGrid
//
//  Prediction scoring engine — mirrors the Expo app's scoring logic.
//

import Foundation

struct ScoringBreakdown {
    var positionPoints: Int = 0
    var fastestLapPoints: Int = 0
    var dnfPoints: Int = 0
    var totalPoints: Int = 0
    var correctPositions: [Int] = []
}

struct SprintScoringBreakdown {
    var positionPoints: Int = 0
    var totalPoints: Int = 0
    var correctPositions: [Int] = []
}

enum Scoring {
    private static func norm(_ id: String?) -> String? {
        guard let id, !id.isEmpty else { return nil }
        return id.trimmingCharacters(in: .whitespaces).uppercased()
    }

    private static func dnsDriverIds(_ result: RaceResult) -> Set<String> {
        var ids = Set<String>()
        for d in result.dnsDriverIds { if let n = norm(d) { ids.insert(n) } }
        for entry in result.classification where entry.status == .dns {
            if let n = norm(entry.driverId) { ids.insert(n) }
        }
        return ids
    }

    static func trueDnfDriverIds(_ result: RaceResult) -> Set<String> {
        var ids = Set<String>()
        let dns = dnsDriverIds(result)
        for entry in result.classification {
            guard let n = norm(entry.driverId), !dns.contains(n) else { continue }
            if entry.status == .dnf || entry.status == .retired {
                ids.insert(n)
            }
        }
        for d in result.dnfDriverIds {
            guard let n = norm(d), !dns.contains(n) else { continue }
            ids.insert(n)
        }
        return ids
    }

    static func calculate(_ prediction: Prediction, _ result: RaceResult) -> ScoringBreakdown {
        var b = ScoringBreakdown()
        var scored = Set<String>()

        let resultTop10 = result.classification
            .filter { $0.position <= 10 }
            .sorted { $0.position < $1.position }
            .map { norm($0.driverId) }

        for i in 0..<min(prediction.top10.count, 10) {
            guard let predicted = norm(prediction.top10[i]) else { continue }
            if scored.contains(predicted) { continue }
            scored.insert(predicted)
            let actual = i < resultTop10.count ? resultTop10[i] : nil
            if predicted == actual {
                b.positionPoints += ScoringConstants.f1Points[i]
                b.correctPositions.append(i)
            }
        }

        if let predFL = norm(prediction.fastestLap), predFL == norm(result.fastestLapDriverId) {
            b.fastestLapPoints = ScoringConstants.fastestLapBonus
        }

        if let predDnf = norm(prediction.dnf) {
            let dns = dnsDriverIds(result)
            let dnf = trueDnfDriverIds(result)
            if !dns.contains(predDnf) && dnf.contains(predDnf) {
                b.dnfPoints = ScoringConstants.dnfBonus
            }
        }

        b.totalPoints = b.positionPoints + b.fastestLapPoints + b.dnfPoints
        return b
    }

    static func calculateSprint(_ sprintTop8: [String], _ sprintResult: [ClassificationEntry]) -> SprintScoringBreakdown {
        var b = SprintScoringBreakdown()
        var scored = Set<String>()

        let resultTop8 = sprintResult
            .filter { $0.position <= 8 }
            .sorted { $0.position < $1.position }
            .map { norm($0.driverId) }

        for i in 0..<min(sprintTop8.count, 8) {
            guard let predicted = norm(sprintTop8[i]) else { continue }
            if scored.contains(predicted) { continue }
            scored.insert(predicted)
            let actual = i < resultTop8.count ? resultTop8[i] : nil
            if predicted == actual {
                b.positionPoints += ScoringConstants.sprintPoints[i]
                b.correctPositions.append(i)
            }
        }

        b.totalPoints = b.positionPoints
        return b
    }

    /// Potential points if the prediction was perfect (best-case ceiling).
    static func potentialPoints(top10Count: Int, hasFastestLap: Bool, hasDnf: Bool, sprintCount: Int) -> Int {
        var total = 0
        for i in 0..<min(top10Count, 10) { total += ScoringConstants.f1Points[i] }
        if hasFastestLap { total += ScoringConstants.fastestLapBonus }
        if hasDnf { total += ScoringConstants.dnfBonus }
        for i in 0..<min(sprintCount, 8) { total += ScoringConstants.sprintPoints[i] }
        return total
    }
}
