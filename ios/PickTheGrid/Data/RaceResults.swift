//
//  RaceResults.swift
//  PickTheGrid
//
//  Known 2026 season race results for completed races.
//

import Foundation

extension F1Data {
    static let allResults: [RaceResult] = [
        RaceResult(
            raceId: "r01",
            classification: ce([
                (1,"RUS","1:23:06.801","Leader",25,.finished),(2,"ANT","1:23:09.775","+2.974s",18,.finished),
                (3,"LEC","1:23:22.320","+15.519s",15,.finished),(4,"HAM","1:23:22.945","+16.144s",12,.finished),
                (5,"NOR","1:23:58.542","+51.741s",10,.finished),(6,"VER","1:24:01.418","+54.617s",8,.finished),
                (7,"BEA","1:23:11.394","+1 lap",6,.finished),(8,"LIN","1:23:18.617","+1 lap",4,.finished),
                (9,"BOR","1:23:19.576","+1 lap",2,.finished),(10,"GAS","1:23:35.828","+1 lap",1,.finished),
                (11,"OCO","1:23:36.651","+1 lap",0,.finished),(12,"ALB","1:24:02.876","+1 lap",0,.finished),
                (13,"LAW","1:24:03.974","+1 lap",0,.finished),(14,"COL","1:23:15.288","+2 laps",0,.finished),
                (15,"SAI","1:23:43.687","+2 laps",0,.finished),(16,"PER","1:23:--","+3 laps",0,.finished),
                (17,"STR","","DNF",0,.dnf),(18,"ALO","","DNF",0,.dnf),(19,"BOT","","DNF",0,.dnf),
                (20,"HAD","","DNF",0,.dnf),(21,"PIA","","DNS",0,.dns),(22,"HUL","","DNS",0,.dns),
            ]),
            fastestLapDriverId: "ANT", dnfDriverIds: ["STR","ALO","BOT","HAD"], dnsDriverIds: ["PIA","HUL"]
        ),
        RaceResult(
            raceId: "r02",
            classification: ce([
                (1,"ANT","1:33:15.607","Leader",25,.finished),(2,"RUS","1:33:21.122","+5.515s",18,.finished),
                (3,"HAM","1:33:40.874","+25.267s",15,.finished),(4,"LEC","1:33:44.501","+28.894s",12,.finished),
                (5,"BEA","1:34:12.875","+57.268s",10,.finished),(6,"GAS","1:34:15.254","+59.647s",8,.finished),
                (7,"LAW","1:34:36.195","+80.588s",6,.finished),(8,"HAD","1:34:42.854","+87.247s",4,.finished),
                (9,"SAI","1:33:27.280","+1 lap",2,.finished),(10,"COL","1:33:28.010","+1 lap",1,.finished),
                (11,"HUL","1:33:36.716","+1 lap",0,.finished),(12,"LIN","1:33:38.435","+1 lap",0,.finished),
                (13,"BOT","1:34:11.765","+1 lap",0,.finished),(14,"OCO","1:34:21.863","+1 lap",0,.finished),
                (15,"PER","1:34:30.248","+1 lap",0,.finished),(16,"VER","","DNF",0,.dnf),
                (17,"ALO","","DNF",0,.dnf),(18,"STR","","DNF",0,.dnf),(19,"PIA","","DNS",0,.dns),
                (20,"NOR","","DNS",0,.dns),(21,"BOR","","DNS",0,.dns),(22,"ALB","","DNS",0,.dns),
            ]),
            fastestLapDriverId: "ANT", dnfDriverIds: ["VER","ALO","STR"], dnsDriverIds: ["PIA","NOR","BOR","ALB"],
            sprintClassification: ce([
                (1,"RUS","33:38.998","Leader",8,.finished),(2,"LEC","33:39.672","+0.674s",7,.finished),
                (3,"HAM","33:41.552","+2.554s",6,.finished),(4,"NOR","33:43.431","+4.433s",5,.finished),
                (5,"ANT","33:44.686","+5.688s",4,.finished),(6,"PIA","33:45.807","+6.809s",3,.finished),
                (7,"LAW","33:49.898","+10.900s",2,.finished),(8,"BEA","33:50.269","+11.271s",1,.finished),
            ])
        ),
        RaceResult(
            raceId: "r03",
            classification: ce([
                (1,"ANT","1:28:03.403","Leader",25,.finished),(2,"PIA","1:28:17.125","+13.722s",18,.finished),
                (3,"LEC","1:28:18.673","+15.270s",15,.finished),(4,"RUS","1:28:19.157","+15.754s",12,.finished),
                (5,"NOR","1:28:26.882","+23.479s",10,.finished),(6,"HAM","1:28:28.440","+25.037s",8,.finished),
                (7,"GAS","1:28:35.743","+32.340s",6,.finished),(8,"VER","1:28:36.080","+32.677s",4,.finished),
                (9,"LAW","1:28:53.583","+50.180s",2,.finished),(10,"OCO","1:28:54.619","+51.216s",1,.finished),
                (11,"HUL","1:28:55.683","+52.280s",0,.finished),(12,"HAD","1:28:59.557","+56.154s",0,.finished),
                (13,"BOR","1:29:02.481","+59.078s",0,.finished),(14,"LIN","1:29:03.251","+59.848s",0,.finished),
                (15,"SAI","1:29:08.411","+65.008s",0,.finished),(16,"COL","1:29:09.176","+65.773s",0,.finished),
                (17,"PER","1:29:35.856","+92.453s",0,.finished),(18,"ALO","1:28:--","+1 lap",0,.finished),
                (19,"BOT","1:28:--","+1 lap",0,.finished),(20,"ALB","1:28:--","+2 laps",0,.finished),
                (21,"STR","","DNF",0,.dnf),(22,"BEA","","DNF",0,.dnf),
            ]),
            fastestLapDriverId: "ANT", dnfDriverIds: ["STR","BEA"]
        ),
        RaceResult(
            raceId: "r06",
            classification: ce([
                (1,"ANT","1:33:19.273","Leader",25,.finished),(2,"NOR","1:33:22.537","+3.264s",18,.finished),
                (3,"PIA","1:33:46.365","+27.092s",15,.finished),(4,"RUS","1:34:02.324","+43.051s",12,.finished),
                (5,"VER","1:34:03.222","+43.949s",10,.finished),(6,"HAM","1:34:13.026","+53.753s",8,.finished),
                (7,"COL","1:34:21.144","+61.871s",6,.finished),(8,"LEC","1:34:23.518","+64.245s",4,.finished),
                (9,"SAI","1:34:41.345","+82.072s",2,.finished),(10,"ALB","1:34:50.245","+90.972s",1,.finished),
                (11,"BEA","1:33:25.673","+1 lap",0,.finished),(12,"BOR","1:33:28.626","+1 lap",0,.finished),
                (13,"OCO","1:33:33.146","+1 lap",0,.finished),(14,"LIN","1:34:04.054","+1 lap",0,.finished),
                (15,"ALO","1:34:34.237","+1 lap",0,.finished),(16,"PER","1:34:--","+1 lap",0,.finished),
                (17,"STR","1:34:--","+1 lap",0,.finished),(18,"BOT","1:35:--","+2 laps",0,.finished),
                (19,"HUL","","DNF",0,.dnf),(20,"LAW","","DNF",0,.dnf),(21,"GAS","","DNF",0,.dnf),(22,"HAD","","DNF",0,.dnf),
            ]),
            fastestLapDriverId: "NOR", dnfDriverIds: ["HUL","LAW","GAS","HAD"],
            sprintClassification: ce([
                (1,"NOR","29:15.045","Leader",8,.finished),(2,"PIA","29:18.811","+3.766s",7,.finished),
                (3,"LEC","29:21.296","+6.251s",6,.finished),(4,"RUS","29:27.996","+12.951s",5,.finished),
                (5,"VER","29:28.684","+13.639s",4,.finished),(6,"ANT","29:28.822","+13.777s",3,.finished),
                (7,"HAM","29:36.710","+21.665s",2,.finished),(8,"GAS","29:45.570","+30.525s",1,.finished),
            ])
        ),
        RaceResult(
            raceId: "r07",
            classification: ce([
                (1,"ANT","1:28:15.758","Leader",25,.finished),(2,"HAM","1:28:26.526","+10.768s",18,.finished),
                (3,"VER","1:28:27.034","+11.276s",15,.finished),(4,"LEC","1:28:59.909","+44.151s",12,.finished),
                (5,"HAD","1:28:20.791","+1 lap",10,.finished),(6,"COL","1:28:35.268","+1 lap",8,.finished),
                (7,"LAW","1:28:49.993","+1 lap",6,.finished),(8,"GAS","1:28:50.330","+1 lap",4,.finished),
                (9,"SAI","1:29:13.772","+1 lap",2,.finished),(10,"BEA","1:29:14.807","+1 lap",1,.finished),
                (11,"PIA","1:28:28.457","+2 laps",0,.finished),(12,"HUL","1:28:29.940","+2 laps",0,.finished),
                (13,"BOR","1:28:36.914","+2 laps",0,.finished),(14,"OCO","1:29:24.393","+2 laps",0,.finished),
                (15,"STR","1:28:34.155","+4 laps",0,.finished),(16,"BOT","1:28:--","+4 laps",0,.finished),
                (17,"PER","","DNF",0,.dnf),(18,"NOR","","DNF",0,.dnf),(19,"RUS","","DNF",0,.dnf),
                (20,"ALO","","DNF",0,.dnf),(21,"ALB","","DNF",0,.dnf),(22,"LIN","","DNS",0,.dns),
            ]),
            fastestLapDriverId: "ANT", dnfDriverIds: ["PER","NOR","RUS","ALO","ALB"], dnsDriverIds: ["LIN"],
            sprintClassification: ce([
                (1,"RUS","28:50.951","Leader",8,.finished),(2,"NOR","28:52.223","+1.272s",7,.finished),
                (3,"ANT","28:52.794","+1.843s",6,.finished),(4,"PIA","29:00.748","+9.797s",5,.finished),
                (5,"LEC","29:00.880","+9.929s",4,.finished),(6,"HAM","29:01.496","+10.545s",3,.finished),
                (7,"VER","29:06.886","+15.935s",2,.finished),(8,"LIN","29:20.661","+29.710s",1,.finished),
            ])
        ),
        RaceResult(
            raceId: "r08",
            classification: ce([
                (1,"ANT","1:42:18.903","Leader",25,.finished),(2,"VER","1:42:25.174","+6.271s",18,.finished),
                (3,"HAM","1:42:42.497","+23.594s",15,.finished),(4,"LEC","1:42:43.364","+24.461s",12,.finished),
                (5,"HAD","1:42:45.656","+26.753s",10,.finished),(6,"RUS","1:42:46.113","+27.210s",8,.finished),
                (7,"PIA","1:42:47.472","+28.569s",6,.finished),(8,"NOR","1:42:50.516","+31.613s",4,.finished),
                (9,"GAS","1:42:54.243","+35.340s",2,.finished),(10,"LAW","1:42:56.256","+37.353s",1,.finished),
                (11,"ALB","1:42:59.002","+40.099s",0,.finished),(12,"SAI","1:42:59.851","+40.948s",0,.finished),
                (13,"HUL","1:43:00.456","+41.553s",0,.finished),(14,"COL","1:43:01.205","+42.302s",0,.finished),
                (15,"LIN","1:43:06.067","+47.164s",0,.finished),(16,"BOR","1:43:07.891","+48.988s",0,.finished),
                (17,"OCO","1:43:09.234","+50.331s",0,.finished),(18,"PER","1:43:10.567","+51.664s",0,.finished),
                (19,"BEA","1:43:14.123","+55.220s",0,.finished),(20,"BOT","1:43:18.456","+59.553s",0,.finished),
                (21,"ALO","","DNF",0,.dnf),(22,"STR","","DNF",0,.dnf),
            ]),
            fastestLapDriverId: "ANT", dnfDriverIds: ["ALO","STR"]
        ),
    ]

    static func result(_ raceId: String) -> RaceResult? {
        allResults.first { $0.raceId == raceId }
    }

    private static func ce(_ rows: [(Int, String, String, String, Int, ClassificationStatus)]) -> [ClassificationEntry] {
        rows.map { ClassificationEntry(position: $0.0, driverId: $0.1, time: $0.2, gap: $0.3, points: $0.4, status: $0.5) }
    }
}
