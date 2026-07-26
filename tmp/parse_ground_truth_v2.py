#!/usr/bin/env python3
"""
Parse the Numbers spreadsheet — ground truth for picks.
Uses sequential position tracking to handle merged cells.
"""
import json
import re
import sys
from numbers_parser import Document

NUMBERS_FILE = sys.argv[1] if len(sys.argv) > 1 else "tmp/updated_predictions.numbers"
OUTPUT_FILE = sys.argv[2] if len(sys.argv) > 2 else "tmp/ground_truth_picks.json"

DRIVER_MAP = {
    "g. russell": "RUS", "g russell": "RUS", "russell": "RUS",
    "k. antonelli": "ANT", "k antonelli": "ANT", "antonelli": "ANT",
    "m. verstappen": "VER", "m verstappen": "VER", "verstappen": "VER",
    "c. leclerc": "LEC", "c leclerc": "LEC", "leclerc": "LEC",
    "l. hamilton": "HAM", "l hamilton": "HAM", "hamilton": "HAM",
    "l. norris": "NOR", "l norris": "NOR", "norris": "NOR",
    "o. piastri": "PIA", "o piastri": "PIA", "piastri": "PIA",
    "i. hadjar": "HAD", "i hadjar": "HAD", "hadjar": "HAD",
    "i. hadkar": "HAD", "i.hadjar": "HAD", "i hdjar": "HAD",
    "l. lawson": "LAW", "l lawson": "LAW", "lawson": "LAW",
    "p. gasly": "GAS", "p gasly": "GAS", "gasly": "GAS",
    "o. bearmen": "BEA", "o bearmen": "BEA", "o. bearman": "BEA", "bearman": "BEA",
    "a. lindblad": "LIN", "a linblad": "LIN", "a. linblad": "LIN",
    "lindblad": "LIN", "linblad": "LIN",
    "f. colapinto": "COL", "f colapinto": "COL", "colapinto": "COL",
    "g. bartoleto": "BOR", "g bortoleto": "BOR", "bortoleto": "BOR",
    "n. hulkenberg": "HUL", "n hulkenberg": "HUL", "hulkenberg": "HUL",
    "e. ocon": "OCO", "e ocon": "OCO", "ocon": "OCO",
    "a. albon": "ALB", "a albon": "ALB", "albon": "ALB",
    "f. alonso": "ALO", "f alonso": "ALO", "alonso": "ALO",
    "v. bottas": "BOT", "v bottas": "BOT", "bottas": "BOT",
    "l. stroll": "STR", "l stroll": "STR", "stroll": "STR",
    "s. perez": "PER", "s perez": "PER", "perez": "PER",
    "c. sainz": "SAI", "c sainz": "SAI", "sainz": "SAI",
}

def name_to_id(name):
    if not name or not name.strip():
        return None
    key = name.strip().lower()
    # Remove trailing spaces and dots
    key = re.sub(r'\s+', ' ', key).strip()
    return DRIVER_MAP.get(key)

USER_IDS = {
    "skye": "cb7536a7-ad8b-44d4-981b-4b24c19abcc4",
    "whitney": "652154af-dc27-47b5-aa79-25903b9c4a1b",
    "bryan": "f35417e9-4f0d-4def-9c2f-c81276863fc0",
    "carlos": "e11ea4f5-2ba4-4241-9791-b4b6a560534b",
}

# Spreadsheet round → app race_id mapping (Bahrain R4 & Saudi R5 = CANCELLED)
# R1=Australia(r01), R2=China(r02+sprint), R3=Japan(r03),
# R6=Miami(r04+sprint), R7=Canada(r05+sprint), R8=Monaco(r06),
# R9=Spain(r07), R10=Austria(r08), R11=British(r09+sprint), R12=Belgian(r10)
ROUND_TO_RACE = {
    1: "r01", 2: "r02", 3: "r03",
    6: "r04", 7: "r05", 8: "r06",
    9: "r07", 10: "r08", 11: "r09", 12: "r10",
}
CANCELLED_ROUNDS = {4, 5}


def get_cell(table, row, col):
    try:
        cell = table.cell(row, col)
        val = cell.value
        return str(val).strip() if val is not None else ""
    except:
        return ""


def extract_picks(doc):
    sheet = doc.sheets[0]
    table = sheet.tables[0]

    # Column layout (0-indexed):
    # 1: round header / "Driver Finish" / "Fastest Lap" / "DNF" / "Current Round Points" / "Total Points"
    # 2: position number (actual result, sometimes merged/empty)
    # 3: actual driver name
    # 4: actual points
    # 5: Skye driver, 6: Skye points
    # 7: Whitney driver, 8: Whitney points
    # 9: Bryan driver, 10: Bryan points
    # 11: Carlos driver, 12: Carlos points

    USER_COLS = [
        ("skye", 5),
        ("whitney", 7),
        ("bryan", 9),
        ("carlos", 11),
    ]

    results = {}  # race_id → { user_name → { top, fl, dnf, sprint_top } }

    current_race_id = None
    current_round_num = None
    is_sprint = False
    is_cancelled = False
    position_counter = 0  # sequential position within a round block

    def ensure_user(race_id, user_name):
        if race_id not in results:
            results[race_id] = {}
        if user_name not in results[race_id]:
            results[race_id][user_name] = {
                "top": [], "fl": None, "dnf": None, "sprint_top": []
            }

    for row_idx in range(table.num_rows):
        col1 = get_cell(table, row_idx, 1)
        col2 = get_cell(table, row_idx, 2)
        col3 = get_cell(table, row_idx, 3)

        # Check for round header
        if col1.lower().startswith("round "):
            m = re.match(r'round\s+(\d+)', col1.lower())
            if m:
                rn = int(m.group(1))
                is_sprint = "sprint" in col1.lower()
                if rn in CANCELLED_ROUNDS:
                    current_race_id = None
                    is_cancelled = True
                elif rn in ROUND_TO_RACE:
                    current_race_id = ROUND_TO_RACE[rn]
                    is_cancelled = False
                else:
                    # Future round (13+) — no picks
                    current_race_id = None
                    is_cancelled = False
                position_counter = 0
            continue

        # Skip non-data rows
        col1_lower = col1.lower()
        if col1_lower.startswith("driver finish"):
            position_counter = 0
            continue
        if any(n in col1_lower for n in ["skye leach", "whitney trujillo", "bryan leach", "carlos trujillo"]):
            continue
        if col1_lower in ("current round points", "total points"):
            continue

        if current_race_id is None or is_cancelled:
            continue

        # Fastest Lap row
        if col1_lower == "fastest lap" or col2.lower() == "fastest lap":
            for user_name, col_idx in USER_COLS:
                ensure_user(current_race_id, user_name)
                drv = get_cell(table, row_idx, col_idx)
                did = name_to_id(drv)
                if did:
                    results[current_race_id][user_name]["fl"] = did
            continue

        # DNF row
        if col1_lower == "dnf" or col2.lower() == "dnf":
            for user_name, col_idx in USER_COLS:
                ensure_user(current_race_id, user_name)
                drv = get_cell(table, row_idx, col_idx)
                did = name_to_id(drv)
                if did:
                    results[current_race_id][user_name]["dnf"] = did
            continue

        # Position row — detect by explicit position number OR by having driver names
        pos_match = re.match(r'^(\d+)\.0$', col2)
        has_driver = any(get_cell(table, row_idx, c) for _, c in USER_COLS)

        if pos_match:
            position_counter = int(pos_match.group(1))
        elif has_driver:
            # Merged cell — next position after the last explicit one
            position_counter += 1
        else:
            continue

        max_pos = 8 if is_sprint else 10
        if position_counter > max_pos:
            continue

        for user_name, col_idx in USER_COLS:
            ensure_user(current_race_id, user_name)
            drv = get_cell(table, row_idx, col_idx)
            did = name_to_id(drv)
            if did:
                if is_sprint:
                    if len(results[current_race_id][user_name]["sprint_top"]) < max_pos:
                        results[current_race_id][user_name]["sprint_top"].append(did)
                else:
                    if len(results[current_race_id][user_name]["top"]) < max_pos:
                        results[current_race_id][user_name]["top"].append(did)

    return results


def main():
    doc = Document(NUMBERS_FILE)
    picks = extract_picks(doc)

    # Convert user names to user IDs
    output = {}
    for race_id, user_picks in picks.items():
        output[race_id] = {}
        for user_name, data in user_picks.items():
            uid = USER_IDS.get(user_name)
            if uid:
                output[race_id][uid] = data

    # Print summary
    print("=== EXTRACTED GROUND TRUTH PICKS ===")
    for race_id in sorted(output.keys()):
        print(f"\n{race_id}:")
        for uid, data in output[race_id].items():
            name = [k for k, v in USER_IDS.items() if v == uid][0]
            top_str = ",".join(data["top"]) if data["top"] else "(empty)"
            sprint_str = ",".join(data["sprint_top"]) if data["sprint_top"] else "(none)"
            top_n = len(data["top"])
            sprint_n = len(data["sprint_top"])
            print(f"  {name:10} top10({top_n})=[{top_str}] fl={data['fl']} dnf={data['dnf']} sprint({sprint_n})=[{sprint_str}]")

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nWritten to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
