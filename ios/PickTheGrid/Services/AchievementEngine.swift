//
//  AchievementEngine.swift
//  PickTheGrid
//
//  Computes achievement progress from the user's scored predictions.
//

import Foundation

enum AchievementEngine {
    /// Returns progress for each achievement id, given the user's predictions.
    static func evaluate(predictions: [Prediction], totalPoints: Int) -> [String: AchievementProgress] {
        var progress: [String: AchievementProgress] = [:]
        let results = F1Data.allResults

        var bestSingleRace = 0
        var correctWinners = 0
        var maxExactPositions = 0
        var bestWeekend = 0
        var maxChaos = 0
        var bestPerfect = 0
        var maxPodiumAccuracy = 0
        var raceWeekRivalBest = 99
        var heroToZero = false
        var almostHadIt = false
        var goldenGoose = false
        var chaosMerchant = false

        for pred in predictions {
            guard let result = results.first(where: { $0.raceId == pred.raceId }),
                  !result.classification.isEmpty, !pred.top10.isEmpty else { continue }

            let breakdown = Scoring.calculate(pred, result)
            var weekend = breakdown.totalPoints
            if !pred.sprintTop8.isEmpty, let sprint = result.sprintClassification {
                weekend += Scoring.calculateSprint(pred.sprintTop8, sprint).totalPoints
            }
            bestSingleRace = max(bestSingleRace, breakdown.totalPoints)
            bestWeekend = max(bestWeekend, weekend)

            // Winner
            let actualWinner = result.classification.first(where: { $0.position == 1 })?.driverId
            let predictedWinnerCorrect = pred.top10.first?.uppercased() == actualWinner?.uppercased()
            if predictedWinnerCorrect { correctWinners += 1 }

            // Exact positions
            maxExactPositions = max(maxExactPositions, breakdown.correctPositions.count)

            // Podium accuracy
            let actualPodium = Set(result.classification.filter { $0.position <= 3 }.map { $0.driverId.uppercased() })
            let predPodium = pred.top10.prefix(3).map { $0.uppercased() }
            let podiumMatches = predPodium.filter { actualPodium.contains($0) }.count
            var exactPodium = 0
            for i in 0..<min(3, pred.top10.count) {
                if pred.top10[i].uppercased() == result.classification.first(where: { $0.position == i + 1 })?.driverId.uppercased() {
                    exactPodium += 1
                }
            }
            let podiumScore = exactPodium == 3 ? 4 : podiumMatches
            maxPodiumAccuracy = max(maxPodiumAccuracy, podiumScore)
            if podiumMatches == 3 && exactPodium < 3 { almostHadIt = true }

            // Chaos: fastest lap + dnf
            let flCorrect = pred.fastestLap?.uppercased() == result.fastestLapDriverId?.uppercased() && pred.fastestLap != nil
            let dnfCorrect = breakdown.dnfPoints > 0
            var chaos = 0
            if flCorrect || dnfCorrect { chaos = 1 }
            if flCorrect && dnfCorrect { chaos = 3; chaosMerchant = true }
            if flCorrect && dnfCorrect && predictedWinnerCorrect { chaos = 4 }
            maxChaos = max(maxChaos, chaos)

            // Perfect weekend
            var perfect = 0
            if predictedWinnerCorrect && breakdown.totalPoints >= 50 { perfect = 1 }
            if predictedWinnerCorrect && podiumMatches == 3 { perfect = 2 }
            if predictedWinnerCorrect && exactPodium == 3 { perfect = 3 }
            if predictedWinnerCorrect && exactPodium == 3 && (flCorrect || dnfCorrect) { perfect = 4 }
            bestPerfect = max(bestPerfect, perfect)

            // Hidden
            let dnfDrivers = Scoring.trueDnfDriverIds(result)
            if let predWinner = pred.top10.first?.uppercased(), dnfDrivers.contains(predWinner) { heroToZero = true }
            if pred.top10.count >= 10 && breakdown.totalPoints == 0 { goldenGoose = true }
        }

        func set(_ id: String, _ value: Int) {
            let def = Achievements.all.first { $0.id == id }
            let tiers = def?.tiers ?? []
            let unlocked = tiers.filter { value >= $0.value }.map { $0.tier }
            progress[id] = AchievementProgress(achievementId: id, unlockedTiers: unlocked, currentValue: value)
        }
        func setHidden(_ id: String, _ unlocked: Bool, value: Int = 1) {
            progress[id] = AchievementProgress(achievementId: id, unlockedTiers: unlocked ? [.bronze] : [], currentValue: unlocked ? value : 0)
        }

        set("points-finish", bestSingleRace)
        set("season-campaign", totalPoints)
        set("podium-prophet", maxPodiumAccuracy)
        set("race-winner", correctWinners)
        set("grid-master", maxExactPositions)
        set("weekend-warrior", bestWeekend)
        set("chaos-caller", maxChaos)
        set("perfect-weekend", bestPerfect)
        set("comeback-drive", 0)
        set("race-week-rival", raceWeekRivalBest == 99 ? 0 : raceWeekRivalBest)
        set("season-champion", 0)

        setHidden("box-box-box", false)
        setHidden("no-take-backs", false)
        setHidden("golden-goose-egg", goldenGoose)
        setHidden("hero-to-zero", heroToZero)
        setHidden("almost-had-it", almostHadIt)
        setHidden("ferrari-strategy-dept", false)
        setHidden("chaos-merchant", chaosMerchant)

        return progress
    }
}
