#!/usr/bin/env python3
"""
Parse the Numbers spreadsheet from scratch — ground truth for picks.
Extracts every user's picks per round, maps driver names to IDs, and
outputs a JSON file ready to push to Supabase.
"""
import json
import re
import sys
from numbers_parser import Document

NUMBERS_FILE = sys.argv[1] if len(sys.argv) > 1 else "tmp/updated_predictions.numbers"
OUTPUT_FILE = sys.argv[2] if len(sys.argv) > 2 else "tmp/ground_truth_picks.json"

# Driver name → ID mapping (handle typos and variations)
DRIVER_MAP = {
    "g. russell": "RUS", "g russell": "RUS", "russell": "RUS",
    "k. antonelli": "ANT", "k antonelli": "ANT", "antonelli": "ANT",
    "m. verstappen": "VER", "m verstappen": "VER", "verstappen": "VER",
    "c. leclerc": "LEC", "c leclerc": "LEC", "leclerc": "LEC",
    "l. hamilton": "HAM", "l hamilton": "HAM", "hamilton": "HAM",
    "l. norris": "NOR", "l norris": "NOR", "norris": "NOR",
    "o. piastri": "PIA", "o piastri": "PIA", "piastri": "PIA", "o. piastri ": "PIA",
    "i. hadjar": "HAD", "i hadjar": "HAD", "hadjar": "HAD", "i. hadkar": "HAD", "i.hadjar": "HAD",
    "l. lawson": "LAW", "l lawson": "LAW", "lawson": "LAW",
    "p. gasly": "GAS", "p gasly": "GAS", "gasly": "GAS",
    "o. bearmen": "BEA", "o bearmen": "BEA", "bearman": "BEA", "o. bearman": "BEA",
    "a. lindblad": "LIN", "a linblad": "LIN", "a. linblad": "LIN", "lindblad": "LIN", "linblad": "LIN",
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
    "d. ricciardo": "RIC", "ricciardo": "RIC",
    "o. piastri ": "PIA",  # trailing space variant
}

def name_to_id(name):
    if not name or not name.strip():
        return None
    key = name.strip().lower()
    return DRIVER_MAP.get(key)

# User IDs
USER_IDS = {
    "skye": "cb7536a7-ad8b-44d4-981b-4b24c19abcc4",
    "whitney": "652154af-dc27-47b5-aa79-25903b9c4a1b",
    "bryan": "f35417e9-4f0d-4def-9c2f-c81276863fc0",
    "carlos": "e11ea4f5-2ba4-4241-9791-b4b6a560534b",
}

# Spreadsheet round → app race_id mapping
# Spreadsheet uses pre-cancellation round numbers (R4 Bahrain, R5 Saudi = cancelled)
ROUND_MAP = {
    "round 1": "r01",          # Australian GP
    "round 2 - sprint": "r02_sprint",  # China sprint
    "round 2": "r02",          # China GP
    "round 3": "r03",          # Japanese GP
    # Round 4 (Bahrain) = CANCELLED
    # Round 5 (Saudi) = CANCELLED
    "round 6 - sprint": "r04_sprint",  # Miami sprint
    "round 6": "r04",          # Miami GP
    "round 7 - sprint": "r05_sprint",  # Canada sprint
    "round 7": "r05",          # Canada GP
    "round 8": "r06",          # Monaco
    "round 9": "r07",          # Spanish
    "round 10": "r08",         # Austrian
    "round 11 - sprint": "r09_sprint",  # British sprint
    "round 11": "r09",         # British GP
    "round 12": "r10",         # Belgian
    # Round 13+ = upcoming (no picks to extract)
}

def parse_round_label(label):
    """Match a round label like 'Round 1 - Australian Grand Prix 2026' to a race_id."""
    if not label:
        return None
    label_lower = label.lower().strip()

    # Check for sprint
    is_sprint = "sprint" in label_lower

    # Extract round number
    m = re.match(r'round\s+(\d+)', label_lower)
    if not m:
        return None, None
    round_num = int(m.group(1))

    # Build key for lookup
    if is_sprint:
        key = f"round {round_num} - sprint"
    else:
        key = f"round {round_num}"

    race_id = ROUND_MAP.get(key)
    if not race_id:
        # Check if it's a cancelled round
        if round_num in (4, 5):
            return None, "cancelled"
        return None, None

    return race_id, "sprint" if is_sprint else "race"


def extract_picks(doc):
    """Extract all picks from the Numbers document."""
    sheet = doc.sheets[0]  # "2026" sheet
    table = sheet.tables[0]

    # Column layout (0-indexed):
    # 0: empty
    # 1: section label (round header) or empty
    # 2: position number (actual result)
    # 3: actual driver
    # 4: actual points
    # 5: Skye driver, 6: Skye points
    # 7: Whitney driver, 8: Whitney points
    # 9: Bryan driver, 10: Bryan points
    # 11: Carlos driver, 12: Carlos points

    results = {}  # race_id → { user_id → { top: [], fl: None, dnf: None, sprint_top: [] } }

    current_race_id = None
    current_type = None  # "race" or "sprint"
    is_cancelled = False

    USER_COLS = {
        "skye": 5,
        "whitney": 7,
        "bryan": 9,
        "carlos": 11,
    }

    for row_idx in range(table.num_rows):
        row = []
        for col_idx in range(min(table.num_cols, 13)):
            try:
                cell = table.cell(row_idx, col_idx)
                val = cell.value
                row.append(str(val) if val is not None else "")
            except:
                row.append("")

        # Check for round header in col 1
        col1 = row[1].strip() if len(row) > 1 else ""
        if col1.lower().startswith("round "):
            race_id, status = parse_round_label(col1)
            if status == "cancelled":
                current_race_id = None
                is_cancelled = True
                continue
            if race_id:
                current_race_id = race_id
                current_type = "sprint" if "_sprint" in race_id else "race"
                # Remove _sprint suffix for storage
                base_race_id = race_id.replace("_sprint", "")
                if base_race_id not in results:
                    results[base_race_id] = {}
                is_cancelled = False
            else:
                current_race_id = None
                is_cancelled = False
            continue

        # Check for "Driver Finish" header row — skip
        if col1.lower().startswith("driver finish"):
            continue

        # Check for name row — skip
        if any(name in " ".join(row).lower() for name in ["skye leach", "whitney trujillo", "bryan leach", "carlos trujillo"]):
            continue

        if current_race_id is None or is_cancelled:
            continue

        base_race_id = current_race_id.replace("_sprint", "")
        is_sprint = "_sprint" in current_race_id

        # Check for position rows (col 2 has a number like "1.0", "2.0", etc.)
        col2 = row[2].strip() if len(row) > 2 else ""
        pos_match = re.match(r'^(\d+)\.0$', col2)

        if pos_match:
            pos = int(pos_match.group(1))
            max_pos = 8 if is_sprint else 10
            if pos > max_pos:
                continue

            for user_name, col_idx in USER_COLS.items():
                if user_name not in results[base_race_id]:
                    results[base_race_id][user_name] = {
                        "top": [], "fl": None, "dnf": None, "sprint_top": []
                    }

                driver_name = row[col_idx].strip() if len(row) > col_idx else ""
                driver_id = name_to_id(driver_name)

                if driver_id:
                    if is_sprint:
                        results[base_race_id][user_name]["sprint_top"].append(driver_id)
                    else:
                        results[base_race_id][user_name]["top"].append(driver_id)
            continue

        # Check for Fastest Lap
        if col1.lower() == "fastest lap" or (len(row) > 2 and row[2].strip().lower() == "fastest lap"):
            for user_name, col_idx in USER_COLS.items():
                if user_name not in results[base_race_id]:
                    results[base_race_id][user_name] = {
                        "top": [], "fl": None, "dnf": None, "sprint_top": []
                    }
                driver_name = row[col_idx].strip() if len(row) > col_idx else ""
                driver_id = name_to_id(driver_name)
                if driver_id:
                    results[base_race_id][user_name]["fl"] = driver_id
            continue

        # Check for DNF
        if col1.lower() == "dnf" or (len(row) > 2 and row[2].strip().lower() == "dnf"):
            for user_name, col_idx in USER_COLS.items():
                if user_name not in results[base_race_id]:
                    results[base_race_id][user_name] = {
                        "top": [], "fl": None, "dnf": None, "sprint_top": []
                    }
                driver_name = row[col_idx].strip() if len(row) > col_idx else ""
                driver_id = name_to_id(driver_name)
                if driver_id:
                    results[base_race_id][user_name]["dnf"] = driver_id
            continue

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
    print("=== EXTRACTED PICKS ===")
    for race_id in sorted(output.keys()):
        print(f"\n{race_id}:")
        for uid, data in output[race_id].items():
            name = [k for k, v in USER_IDS.items() if v == uid][0]
            top_str = ",".join(data["top"]) if data["top"] else "(empty)"
            sprint_str = ",".join(data["sprint_top"]) if data["sprint_top"] else "(none)"
            print(f"  {name:10} top10=[{top_str}] fl={data['fl']} dnf={data['dnf']} sprint=[{sprint_str}]")

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nWritten to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
