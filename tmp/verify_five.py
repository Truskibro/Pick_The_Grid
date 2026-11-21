import json, urllib.request, time, re

SB = "https://fxwgbpassouaddakgyus.supabase.co/rest/v1"
src = open("expo/lib/supabase.ts").read()
KEY = re.search(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", src).group(0)

def sb(path):
    req = urllib.request.Request(f"{SB}/{path}", headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    return json.load(urllib.request.urlopen(req))

races = {r["id"]: r for r in sb("races?select=id,round,name&series_id=eq.f1")}
results = sb("race_results?select=race_id,classification,fastest_lap_driver_id,dnf_driver_ids,dns_driver_ids")
by_race = {r["race_id"]: r for r in results}

def api_round(round_no):
    url = f"https://api.jolpi.ca/ergast/f1/2026/{round_no}/results.json?limit=60"
    d = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"verify/1.0"})))
    rs = d["MRData"]["RaceTable"]["Races"]
    return rs[0]["Results"] if rs else None

ok_all = True
for rid in ["r01","r06","r09","r15","r15b"]:
    rnd = races[rid]["round"]
    api = api_round(rnd); time.sleep(1.5)
    row = by_race.get(rid)
    api_order = [x["Driver"].get("code") for x in api]
    api_fl = next((x["Driver"].get("code") for x in api if x.get("FastestLap",{}).get("rank")=="1"), None)
    api_dnf = [x["Driver"].get("code") for x in api if x.get("positionText")=="R"]
    api_dns = [x["Driver"].get("code") for x in api if x.get("positionText")=="W"]
    cls = row["classification"] or []
    db_order = [c["driverId"] for c in sorted(cls, key=lambda c: int(c["position"]))]
    db_fl = row.get("fastest_lap_driver_id")
    db_dnf = row.get("dnf_driver_ids") or []
    db_dns = row.get("dns_driver_ids") or []
    match = (db_order == api_order and db_fl == api_fl and set(db_dnf)==set(api_dnf) and set(db_dns)==set(api_dns))
    ok_all &= match
    print(rid, races[rid]["name"][:30].ljust(30), "OK" if match else "DIFF", f"({len(db_order)} classified, dnf={len(db_dnf)}, dns={len(db_dns)})")
    if not match:
        if db_order != api_order: print("  order db:", db_order, "\n       api:", api_order)
        if db_fl != api_fl: print("  fastest db:", db_fl, "api:", api_fl)
        if set(db_dnf)!=set(api_dnf): print("  dnf db:", sorted(db_dnf), "api:", sorted(api_dnf))
        if set(db_dns)!=set(api_dns): print("  dns db:", sorted(db_dns), "api:", sorted(api_dns))
print("ALL MATCH" if ok_all else "MISMATCHES FOUND")
