//
//  Scoring.swift
//  PickTheGridIOS
//
//  Display-only scoring port, mirroring expo/lib/scoring.ts exactly.
//  The server trigger on race_results remains the source of truth for
//  stored points; this is used for the results breakdown and the
//  potential-points preview and for scoring the bundled seed users.
//

import Foundation

struct ScoringBreakdown {
    var positionPoints = 0
    var fastestLapPoints = 0
    var dnfPoints = 0
    var totalPoints = 0
    var correctPositions: [Int] = []
}

struct SprintScoringBreakdown {
    var positionPoints = 0
    var totalPoints = 0
    var correctPositions: [Int] = []
}

private func normalizeDriverId(_ id: String?) -> String? {
    guard let id, !id.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
    return id.trimmingCharacters(in: .whitespaces).uppercased()
}

private func normalizeStatus(_ status: String?) -> String {
    (status ?? "").trimmingCharacters(in: .whitespaces).lowercased()
}

private func isDnsStatus(_ status: String) -> Bool {
    status == "dns" || status == "did not start" || status == "did_not_start"
}

private func isTrueDnfStatus(_ status: String) -> Bool {
    status == "dnf" || status == "retired" || status == "ret"
        || status == "did not finish" || status == "did_not_finish"
}

/// DNS = Did Not Start. DNS is separate from DNF and never awards DNF points.
func getDnsDriverIds(_ result: RaceResult) -> Set<String> {
    var dnsIds = Set<String>()
    for driverId in result.dnsDriverIds {
        if let normalized = normalizeDriverId(driverId) { dnsIds.insert(normalized) }
    }
    for entry in result.classification {
        guard let normalized = normalizeDriverId(entry.driverId) else { continue }
        if isDnsStatus(normalizeStatus(entry.status)) { dnsIds.insert(normalized) }
    }
    return dnsIds
}

/// Only true DNF/retired drivers. DNS drivers are excluded.
func getTrueDnfDriverIds(_ result: RaceResult) -> Set<String> {
    var trueDnfIds = Set<String>()
    let dnsIds = getDnsDriverIds(result)
    for entry in result.classification {
        guard let normalized = normalizeDriverId(entry.driverId) else { continue }
        if dnsIds.contains(normalized) { continue }
        if isTrueDnfStatus(normalizeStatus(entry.status)) { trueDnfIds.insert(normalized) }
    }
    for driverId in result.dnfDriverIds {
        guard let normalized = normalizeDriverId(driverId) else { continue }
        if dnsIds.contains(normalized) { continue }
        trueDnfIds.insert(normalized)
    }
    return trueDnfIds
}

func calculatePoints(top10: [String], fastestLap: String?, dnf: String?, result: RaceResult, series: SeriesConfig) -> ScoringBreakdown {
    var breakdown = ScoringBreakdown()
    let racePoints = series.racePoints
    let raceTopN = series.raceTopN

    let resultTopN = result.classification
        .filter { $0.position <= raceTopN }
        .sorted { $0.position < $1.position }
        .compactMap { normalizeDriverId($0.driverId) }

    var alreadyScoredDrivers = Set<String>()
    for i in 0..<min(top10.count, raceTopN) {
        guard let predicted = normalizeDriverId(top10[i]) else { continue }
        if alreadyScoredDrivers.contains(predicted) { continue }  // duplicate pick ignored
        alreadyScoredDrivers.insert(predicted)
        if i < resultTopN.count && predicted == resultTopN[i] {
            breakdown.positionPoints += i < racePoints.count ? racePoints[i] : 0
            breakdown.correctPositions.append(i)
        }
    }

    if let predictedFL = normalizeDriverId(fastestLap),
       predictedFL == normalizeDriverId(result.fastestLapDriverId) {
        breakdown.fastestLapPoints = series.fastestLapBonus
    }

    let predictedDnf = normalizeDriverId(dnf)
    let dnsIds = getDnsDriverIds(result)
    let trueDnfIds = getTrueDnfDriverIds(result)
    if predictedDnf == nil && trueDnfIds.isEmpty {
        breakdown.dnfPoints = series.dnfBonus  // no DNF predicted and none retired
    } else if let predictedDnf, !dnsIds.contains(predictedDnf), trueDnfIds.contains(predictedDnf) {
        breakdown.dnfPoints = series.dnfBonus
    }

    breakdown.totalPoints = breakdown.positionPoints + breakdown.fastestLapPoints + breakdown.dnfPoints
    return breakdown
}

func calculateSprintPoints(_ sprintTop8: [String], _ sprintResult: [ClassificationEntry], series: SeriesConfig) -> SprintScoringBreakdown {
    var breakdown = SprintScoringBreakdown()
    let sprintPoints = series.sprintPoints
    let sprintTopN = series.sprintTopN

    let resultTopN = sprintResult
        .filter { $0.position <= sprintTopN }
        .sorted { $0.position < $1.position }
        .compactMap { normalizeDriverId($0.driverId) }

    var alreadyScoredDrivers = Set<String>()
    for i in 0..<min(sprintTop8.count, sprintTopN) {
        guard let predicted = normalizeDriverId(sprintTop8[i]) else { continue }
        if alreadyScoredDrivers.contains(predicted) { continue }
        alreadyScoredDrivers.insert(predicted)
        if i < resultTopN.count && predicted == resultTopN[i] {
            breakdown.positionPoints += i < sprintPoints.count ? sprintPoints[i] : 0
            breakdown.correctPositions.append(i)
        }
    }
    breakdown.totalPoints = breakdown.positionPoints
    return breakdown
}

/// Maximum achievable points for a complete prediction on the predict
/// screen (potential-points preview), mirroring the Expo predict UI.
func maxPossiblePoints(series: SeriesConfig, includeSprint: Bool) -> Int {
    var total = series.racePoints.reduce(0, +)
        + series.fastestLapBonus
        + series.dnfBonus
    if includeSprint { total += series.sprintPoints.reduce(0, +) }
    return total
}

// MARK: - Seed users (leaderboard fallback, F1 only)

/// Sums a seed user's bundled predictions against the loaded F1 results,
/// mirroring scoreSeededPredictions in expo/constants/seed-predictions.ts.
func scoreSeededPredictions(userId: String, results: [RaceResult], series: SeriesConfig) -> Int {
    let preds = SEED_PREDICTIONS_DATA[userId.lowercased()] ?? [:]
    guard !preds.isEmpty else { return 0 }

    let completedIds = Set(results.map(\.raceId))
    var total = 0
    for raceId in completedIds {
        guard let pred = preds[raceId],
              let result = results.first(where: { $0.raceId == raceId }) else { continue }

        if !pred.top10.isEmpty && !result.classification.isEmpty {
            total += calculatePoints(
                top10: pred.top10, fastestLap: pred.fastestLap, dnf: pred.dnf,
                result: result, series: series
            ).totalPoints
        }
        if let sprint = result.sprintClassification, !pred.sprintTop8.isEmpty, !sprint.isEmpty {
            total += calculateSprintPoints(pred.sprintTop8, sprint, series: series).totalPoints
        }
    }
    return total
}
