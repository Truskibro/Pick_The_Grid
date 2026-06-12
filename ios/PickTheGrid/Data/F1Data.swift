//
//  F1Data.swift
//  PickTheGrid
//
//  2026 season teams, drivers, races and known race results.
//

import Foundation

enum F1Data {
    static let teams: [Team] = [
        Team(id: "mclaren", name: "McLaren", color: 0xFF8000, shortName: "MCL"),
        Team(id: "ferrari", name: "Scuderia Ferrari", color: 0xE8002D, shortName: "FER"),
        Team(id: "red-bull", name: "Red Bull Racing", color: 0x3671C6, shortName: "RBR"),
        Team(id: "mercedes", name: "Mercedes-AMG", color: 0x27F4D2, shortName: "MER"),
        Team(id: "aston-martin", name: "Aston Martin", color: 0x229971, shortName: "AMR"),
        Team(id: "alpine", name: "Alpine", color: 0xFF87BC, shortName: "ALP"),
        Team(id: "williams", name: "Williams", color: 0x64C4FF, shortName: "WIL"),
        Team(id: "racing-bulls", name: "Racing Bulls", color: 0x6692FF, shortName: "RCB"),
        Team(id: "audi", name: "Audi", color: 0xE0003C, shortName: "AUD"),
        Team(id: "haas", name: "Haas", color: 0xB6BABD, shortName: "HAA"),
        Team(id: "cadillac", name: "Cadillac", color: 0x1C1C1C, shortName: "CAD"),
    ]

    static let drivers: [Driver] = [
        Driver(id: "ANT", name: "Kimi Antonelli", shortName: "ANT", number: 12, teamId: "mercedes", championshipPoints: 161),
        Driver(id: "RUS", name: "George Russell", shortName: "RUS", number: 63, teamId: "mercedes", championshipPoints: 96),
        Driver(id: "HAM", name: "Lewis Hamilton", shortName: "HAM", number: 44, teamId: "ferrari", championshipPoints: 87),
        Driver(id: "LEC", name: "Charles Leclerc", shortName: "LEC", number: 16, teamId: "ferrari", championshipPoints: 87),
        Driver(id: "NOR", name: "Lando Norris", shortName: "NOR", number: 1, teamId: "mclaren", championshipPoints: 63),
        Driver(id: "VER", name: "Max Verstappen", shortName: "VER", number: 3, teamId: "red-bull", championshipPoints: 61),
        Driver(id: "PIA", name: "Oscar Piastri", shortName: "PIA", number: 81, teamId: "mclaren", championshipPoints: 54),
        Driver(id: "HAD", name: "Isack Hadjar", shortName: "HAD", number: 6, teamId: "red-bull", championshipPoints: 24),
        Driver(id: "GAS", name: "Pierre Gasly", shortName: "GAS", number: 10, teamId: "alpine", championshipPoints: 22),
        Driver(id: "BEA", name: "Oliver Bearman", shortName: "BEA", number: 87, teamId: "haas", championshipPoints: 18),
        Driver(id: "LAW", name: "Liam Lawson", shortName: "LAW", number: 30, teamId: "racing-bulls", championshipPoints: 17),
        Driver(id: "COL", name: "Franco Colapinto", shortName: "COL", number: 43, teamId: "alpine", championshipPoints: 15),
        Driver(id: "SAI", name: "Carlos Sainz", shortName: "SAI", number: 55, teamId: "williams", championshipPoints: 6),
        Driver(id: "LIN", name: "Arvid Lindblad", shortName: "LIN", number: 41, teamId: "racing-bulls", championshipPoints: 5),
        Driver(id: "BOR", name: "Gabriel Bortoleto", shortName: "BOR", number: 5, teamId: "audi", championshipPoints: 2),
        Driver(id: "ALB", name: "Alex Albon", shortName: "ALB", number: 23, teamId: "williams", championshipPoints: 1),
        Driver(id: "OCO", name: "Esteban Ocon", shortName: "OCO", number: 31, teamId: "haas", championshipPoints: 1),
        Driver(id: "ALO", name: "Fernando Alonso", shortName: "ALO", number: 14, teamId: "aston-martin", championshipPoints: 0),
        Driver(id: "STR", name: "Lance Stroll", shortName: "STR", number: 18, teamId: "aston-martin", championshipPoints: 0),
        Driver(id: "HUL", name: "Nico Hulkenberg", shortName: "HUL", number: 27, teamId: "audi", championshipPoints: 0),
        Driver(id: "PER", name: "Sergio Perez", shortName: "PER", number: 11, teamId: "cadillac", championshipPoints: 0),
        Driver(id: "BOT", name: "Valtteri Bottas", shortName: "BOT", number: 77, teamId: "cadillac", championshipPoints: 0),
    ]

    static let races: [Race] = [
        Race(id: "r01", round: 1, name: "Australian Grand Prix", location: "Melbourne", country: "Australia", raceDate: "2026-03-08", raceTime: "05:00", status: .completed, hasSprint: false, winner: "RUS", totalLaps: 58),
        Race(id: "r02", round: 2, name: "Chinese Grand Prix", location: "Shanghai", country: "China", raceDate: "2026-03-15", raceTime: "07:00", status: .completed, hasSprint: true, winner: "ANT", totalLaps: 56),
        Race(id: "r03", round: 3, name: "Japanese Grand Prix", location: "Suzuka", country: "Japan", raceDate: "2026-03-29", raceTime: "06:00", status: .completed, hasSprint: false, winner: "ANT", totalLaps: 53),
        Race(id: "r04", round: 4, name: "Bahrain Grand Prix", location: "Sakhir", country: "Bahrain", raceDate: "2026-04-12", raceTime: "16:00", status: .cancelled, hasSprint: false, totalLaps: 57),
        Race(id: "r05", round: 5, name: "Saudi Arabian Grand Prix", location: "Jeddah", country: "Saudi Arabia", raceDate: "2026-04-19", raceTime: "18:00", status: .cancelled, hasSprint: false, totalLaps: 50),
        Race(id: "r06", round: 6, name: "Miami Grand Prix", location: "Miami", country: "USA", raceDate: "2026-05-03", raceTime: "20:00", status: .completed, hasSprint: true, winner: "ANT", totalLaps: 57),
        Race(id: "r07", round: 7, name: "Canadian Grand Prix", location: "Montreal", country: "Canada", raceDate: "2026-05-24", raceTime: "18:00", status: .completed, hasSprint: true, winner: "ANT", totalLaps: 70),
        Race(id: "r08", round: 8, name: "Monaco Grand Prix", location: "Monte Carlo", country: "Monaco", raceDate: "2026-06-07", raceTime: "13:00", status: .completed, hasSprint: false, winner: "ANT", totalLaps: 78),
        Race(id: "r09", round: 9, name: "Spanish Grand Prix", location: "Barcelona", country: "Spain", raceDate: "2026-06-14", raceTime: "13:00", status: .upcoming, hasSprint: false, totalLaps: 66),
        Race(id: "r10", round: 10, name: "Austrian Grand Prix", location: "Spielberg", country: "Austria", raceDate: "2026-06-28", raceTime: "13:00", status: .upcoming, hasSprint: false, totalLaps: 71),
        Race(id: "r11", round: 11, name: "British Grand Prix", location: "Silverstone", country: "United Kingdom", raceDate: "2026-07-05", raceTime: "14:00", status: .upcoming, hasSprint: true, totalLaps: 52),
        Race(id: "r12", round: 12, name: "Belgian Grand Prix", location: "Spa-Francorchamps", country: "Belgium", raceDate: "2026-07-19", raceTime: "13:00", status: .upcoming, hasSprint: false, totalLaps: 44),
        Race(id: "r13", round: 13, name: "Hungarian Grand Prix", location: "Budapest", country: "Hungary", raceDate: "2026-07-26", raceTime: "13:00", status: .upcoming, hasSprint: false, totalLaps: 70),
        Race(id: "r14", round: 14, name: "Dutch Grand Prix", location: "Zandvoort", country: "Netherlands", raceDate: "2026-08-23", raceTime: "13:00", status: .upcoming, hasSprint: true, totalLaps: 72),
        Race(id: "r15", round: 15, name: "Italian Grand Prix", location: "Monza", country: "Italy", raceDate: "2026-09-06", raceTime: "13:00", status: .upcoming, hasSprint: false, totalLaps: 53),
        Race(id: "r16", round: 16, name: "Madrid Grand Prix", location: "Madrid", country: "Spain", raceDate: "2026-09-13", raceTime: "13:00", status: .upcoming, hasSprint: false, totalLaps: 55),
        Race(id: "r17", round: 17, name: "Azerbaijan Grand Prix", location: "Baku", country: "Azerbaijan", raceDate: "2026-09-27", raceTime: "12:00", status: .upcoming, hasSprint: false, totalLaps: 51),
        Race(id: "r18", round: 18, name: "Singapore Grand Prix", location: "Marina Bay", country: "Singapore", raceDate: "2026-10-11", raceTime: "12:00", status: .upcoming, hasSprint: true, totalLaps: 62),
        Race(id: "r19", round: 19, name: "United States Grand Prix", location: "Austin", country: "USA", raceDate: "2026-10-25", raceTime: "19:00", status: .upcoming, hasSprint: false, totalLaps: 56),
        Race(id: "r20", round: 20, name: "Mexico City Grand Prix", location: "Mexico City", country: "Mexico", raceDate: "2026-11-01", raceTime: "20:00", status: .upcoming, hasSprint: false, totalLaps: 71),
        Race(id: "r21", round: 21, name: "São Paulo Grand Prix", location: "Interlagos", country: "Brazil", raceDate: "2026-11-08", raceTime: "17:00", status: .upcoming, hasSprint: false, totalLaps: 71),
        Race(id: "r22", round: 22, name: "Las Vegas Grand Prix", location: "Las Vegas", country: "USA", raceDate: "2026-11-21", raceTime: "06:00", status: .upcoming, hasSprint: false, totalLaps: 50),
        Race(id: "r23", round: 23, name: "Qatar Grand Prix", location: "Lusail", country: "Qatar", raceDate: "2026-11-29", raceTime: "17:00", status: .upcoming, hasSprint: false, totalLaps: 57),
        Race(id: "r24", round: 24, name: "Abu Dhabi Grand Prix", location: "Yas Marina", country: "UAE", raceDate: "2026-12-06", raceTime: "14:00", status: .upcoming, hasSprint: false, totalLaps: 58),
    ]

    static func team(_ id: String) -> Team? { teams.first { $0.id == id } }
    static func driver(_ id: String) -> Driver? { drivers.first { $0.id == id } }
    static func race(_ id: String) -> Race? { races.first { $0.id == id } }

    static func teamForDriver(_ driverId: String) -> Team? {
        guard let d = driver(driverId) else { return nil }
        return team(d.teamId)
    }

    static var nextRace: Race? {
        races
            .filter { $0.status == .upcoming }
            .sorted { $0.dateTime < $1.dateTime }
            .first
    }

    /// Country flag emoji by race country name.
    static func flag(forCountry country: String) -> String {
        Countries.all.first { $0.name == country }?.flag
            ?? countryFlagFallback[country]
            ?? "🏁"
    }

    private static let countryFlagFallback: [String: String] = [
        "USA": "🇺🇸",
        "UAE": "🇦🇪",
        "United Kingdom": "🇬🇧",
    ]
}
