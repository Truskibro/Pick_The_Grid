//
//  Achievements.swift
//  PickTheGrid
//
//  Achievement / Grid Badge definitions and tier colors.
//

import SwiftUI

enum AchievementTier: String, CaseIterable {
    case bronze, silver, gold, platinum

    var label: String { rawValue.capitalized }

    var color: Color {
        switch self {
        case .bronze: return Color(hex: 0xCD7F32)
        case .silver: return Color(hex: 0xC0C0C0)
        case .gold: return Color(hex: 0xFFD700)
        case .platinum: return Color(hex: 0x76E4FF)
        }
    }
}

enum AchievementCategory: String {
    case race, season, league
}

struct AchievementTierDef: Hashable {
    let tier: AchievementTier
    let requirement: String
    let value: Int
}

struct AchievementDef: Identifiable, Hashable {
    let id: String
    let name: String
    let description: String
    let category: AchievementCategory
    let isHidden: Bool
    /// SF Symbol name.
    let icon: String
    let tiers: [AchievementTierDef]?
    let unlockHint: String?

    init(id: String, name: String, description: String, category: AchievementCategory,
         isHidden: Bool, icon: String, tiers: [AchievementTierDef]?, unlockHint: String? = nil) {
        self.id = id
        self.name = name
        self.description = description
        self.category = category
        self.isHidden = isHidden
        self.icon = icon
        self.tiers = tiers
        self.unlockHint = unlockHint
    }
}

/// Per-achievement progress.
struct AchievementProgress: Hashable {
    let achievementId: String
    var unlockedTiers: [AchievementTier]
    var currentValue: Int
}

enum Achievements {
    static let visible: [AchievementDef] = [
        AchievementDef(id: "points-finish", name: "Points Finish", description: "Score a strong amount of points in a single race.", category: .race, isHidden: false, icon: "star.fill", tiers: [
            .init(tier: .bronze, requirement: "Score 25+ points in one race", value: 25),
            .init(tier: .silver, requirement: "Score 50+ points in one race", value: 50),
            .init(tier: .gold, requirement: "Score 75+ points in one race", value: 75),
            .init(tier: .platinum, requirement: "Score 100+ points in one race", value: 100),
        ]),
        AchievementDef(id: "season-campaign", name: "Season Campaign", description: "Earn total points across the season.", category: .season, isHidden: false, icon: "calendar", tiers: [
            .init(tier: .bronze, requirement: "Earn 500 season points", value: 500),
            .init(tier: .silver, requirement: "Earn 750 season points", value: 750),
            .init(tier: .gold, requirement: "Earn 1,000 season points", value: 1000),
            .init(tier: .platinum, requirement: "Earn 1,250 season points", value: 1250),
        ]),
        AchievementDef(id: "podium-prophet", name: "Podium Prophet", description: "Correctly predict podium drivers.", category: .race, isHidden: false, icon: "trophy.fill", tiers: [
            .init(tier: .bronze, requirement: "Predict 1 podium driver in the correct podium position", value: 1),
            .init(tier: .silver, requirement: "Predict 2 podium drivers in the correct podium positions", value: 2),
            .init(tier: .gold, requirement: "Predict all 3 podium drivers in any order", value: 3),
            .init(tier: .platinum, requirement: "Predict P1, P2, and P3 exactly", value: 4),
        ]),
        AchievementDef(id: "race-winner", name: "Race Winner", description: "Correctly predict race winners across the season.", category: .season, isHidden: false, icon: "flag.checkered", tiers: [
            .init(tier: .bronze, requirement: "Correctly predict 1 race winner", value: 1),
            .init(tier: .silver, requirement: "Correctly predict 3 race winners", value: 3),
            .init(tier: .gold, requirement: "Correctly predict 5 race winners", value: 5),
            .init(tier: .platinum, requirement: "Correctly predict 8 race winners", value: 8),
        ]),
        AchievementDef(id: "grid-master", name: "Grid Master", description: "Correctly predict exact finishing positions.", category: .race, isHidden: false, icon: "square.grid.3x3.fill", tiers: [
            .init(tier: .bronze, requirement: "Correctly predict 3 exact finishing positions in one race", value: 3),
            .init(tier: .silver, requirement: "Correctly predict 4 exact finishing positions in one race", value: 4),
            .init(tier: .gold, requirement: "Correctly predict 5 exact finishing positions in one race", value: 5),
            .init(tier: .platinum, requirement: "Correctly predict 6 exact finishing positions in one race", value: 6),
        ]),
        AchievementDef(id: "weekend-warrior", name: "Weekend Warrior", description: "Score strong total points across a race weekend.", category: .race, isHidden: false, icon: "bolt.fill", tiers: [
            .init(tier: .bronze, requirement: "Score 50+ total points across a race weekend", value: 50),
            .init(tier: .silver, requirement: "Score 75+ total points across a race weekend", value: 75),
            .init(tier: .gold, requirement: "Score 100+ total points across a race weekend", value: 100),
            .init(tier: .platinum, requirement: "Score 125+ total points across a race weekend", value: 125),
        ]),
        AchievementDef(id: "chaos-caller", name: "Chaos Caller", description: "Correctly predict volatile race events like fastest lap and DNF.", category: .race, isHidden: false, icon: "shuffle", tiers: [
            .init(tier: .bronze, requirement: "Correctly predict either fastest lap or DNF once", value: 1),
            .init(tier: .silver, requirement: "Correctly predict fastest lap and DNF at least once in a season", value: 2),
            .init(tier: .gold, requirement: "Correctly predict fastest lap and DNF in the same race", value: 3),
            .init(tier: .platinum, requirement: "Correctly predict winner, fastest lap, and DNF in the same race", value: 4),
        ]),
        AchievementDef(id: "perfect-weekend", name: "Perfect Weekend", description: "Deliver a complete elite prediction weekend.", category: .race, isHidden: false, icon: "crown.fill", tiers: [
            .init(tier: .bronze, requirement: "Correctly predict race winner and score 50+ points", value: 1),
            .init(tier: .silver, requirement: "Correctly predict race winner and podium drivers in any order", value: 2),
            .init(tier: .gold, requirement: "Correctly predict race winner and exact podium", value: 3),
            .init(tier: .platinum, requirement: "Predict winner, exact podium, and fastest lap or DNF", value: 4),
        ]),
        AchievementDef(id: "comeback-drive", name: "Comeback Drive", description: "Improve dramatically after a previous race.", category: .race, isHidden: false, icon: "chart.line.uptrend.xyaxis", tiers: [
            .init(tier: .bronze, requirement: "Improve your race score by 25+ points", value: 25),
            .init(tier: .silver, requirement: "Improve your race score by 50+ points", value: 50),
            .init(tier: .gold, requirement: "Improve your race score by 75+ points", value: 75),
            .init(tier: .platinum, requirement: "Bottom half to top 3 after one race", value: 100),
        ]),
        AchievementDef(id: "race-week-rival", name: "Race Week Rival", description: "Perform well inside a league during a single race week.", category: .league, isHidden: false, icon: "flame.fill", tiers: [
            .init(tier: .bronze, requirement: "Finish top 5 in a league race week", value: 5),
            .init(tier: .silver, requirement: "Finish top 3 in a league race week", value: 3),
            .init(tier: .gold, requirement: "Finish 2nd in a league race week", value: 2),
            .init(tier: .platinum, requirement: "Finish 1st in a league race week", value: 1),
        ]),
        AchievementDef(id: "season-champion", name: "Season Champion", description: "Perform well inside a league across a full season.", category: .league, isHidden: false, icon: "rosette", tiers: [
            .init(tier: .bronze, requirement: "Finish top 10 in a league season", value: 10),
            .init(tier: .silver, requirement: "Finish top 5 in a league season", value: 5),
            .init(tier: .gold, requirement: "Finish top 3 in a league season", value: 3),
            .init(tier: .platinum, requirement: "Finish 1st in a league season", value: 1),
        ]),
    ]

    static let hidden: [AchievementDef] = [
        AchievementDef(id: "box-box-box", name: "Box Box Box", description: "Edit prediction within a minute of lock.", category: .race, isHidden: true, icon: "timer", tiers: nil, unlockHint: "Edit your prediction within 60 seconds of the lock deadline"),
        AchievementDef(id: "no-take-backs", name: "No Take Backs", description: "Submit a full grid and never edit it before lock.", category: .race, isHidden: true, icon: "lock.fill", tiers: nil, unlockHint: "Submit a complete prediction and never change it before the deadline"),
        AchievementDef(id: "golden-goose-egg", name: "Golden Goose Egg", description: "Submit full grid and score 0.", category: .race, isHidden: true, icon: "exclamationmark.triangle.fill", tiers: nil, unlockHint: "Submit all 10 positions and score exactly 0 points"),
        AchievementDef(id: "hero-to-zero", name: "Hero to Zero", description: "Predicted winner DNFs.", category: .race, isHidden: true, icon: "face.dashed", tiers: nil, unlockHint: "Your predicted race winner fails to finish the race"),
        AchievementDef(id: "almost-had-it", name: "Almost Had It", description: "Correct podium drivers but wrong order.", category: .race, isHidden: true, icon: "arrow.triangle.2.circlepath", tiers: nil, unlockHint: "Get all 3 podium drivers right but in the wrong positions"),
        AchievementDef(id: "ferrari-strategy-dept", name: "Ferrari Strategy Dept.", description: "Change prediction 5+ times before lock.", category: .race, isHidden: true, icon: "pencil.and.outline", tiers: nil, unlockHint: "Edit your prediction 5+ times for a single race before lock"),
        AchievementDef(id: "chaos-merchant", name: "Chaos Merchant", description: "Correctly predict fastest lap and DNF in the same race.", category: .race, isHidden: true, icon: "flame", tiers: nil, unlockHint: "Correctly predict both fastest lap and a DNF in the same race"),
    ]

    static let all: [AchievementDef] = visible + hidden
}
