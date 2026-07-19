import json, re

with open('tmp/numbers_rows.json') as f:
    rows = json.load(f)
grid = {row['r']: {i:v for i,v in enumerate(row['cells']) if v is not None and str(v).strip()!=''} for row in rows}

# Find ALL section headers (round + sprint), in order
sections = []  # (row, label, is_sprint)
for r in sorted(grid.keys()):
    if 1 in grid[r] and isinstance(grid[r][1], str):
        label = grid[r][1]
        if re.match(r'Round \d+', label) and ('Grand Prix' in label or 'GP' in label):
            is_sprint = 'Sprint' in label
            sections.append((r, label, is_sprint))

# Spreadsheet round -> app race_id
def label_to_race_id(label):
    m = re.match(r'Round (\d+)', label)
    if not m: return None
    rn = int(m.group(1))
    # R4 (Bahrain) & R5 (Saudi) cancelled; app uses r01-r10 for the 10 active rounds
    mapping = {1:'r01',2:'r02',3:'r03',6:'r04',7:'r05',8:'r06',9:'r07',10:'r08',11:'r09',12:'r10'}
    return mapping.get(rn)

USERS = [
    ('cb7536a7-ad8b-44d4-981b-4b24c19abcc4', 'Skye Leach', 5),
    ('652154af-dc27-47b5-aa79-25903b9c4a1b', 'Whitney Trujillo', 7),
    ('f35417e9-4f0d-4def-9c2f-c81276863fc0', 'Bryan Leach', 9),
    ('e11ea4f5-2ba4-4241-9791-b4b6a560534b', 'Carlos Trujillo', 11),
]

NAME_TO_CODE = {
    'G. Russell':'RUS','K. Antonelli':'ANT','C. Leclerc':'LEC','L. Hamilton':'HAM','L. Hamillton':'HAM',
    'L. Norris':'NOR','M. Verstappen':'VER','O. Piastri':'PIA','I. Hadjar':'HAD','I. Hadkar':'HAD','I.Hadjar':'HAD',
    'L. Lawson':'LAW','C. Sainz':'SAI','N. Hulkenberg':'HUL','N. Hülkenberg':'HUL','P. Gasly':'GAS',
    'O. Bearman':'BEA','A. Lindbald':'LIN','A. Lindblad':'LIN','G. Bartoleto':'BOR','G. Bortoleto':'BOR',
    'F. Alonso':'ALO','V. Bottas':'BOT','L. Stroll':'STR','F. Colapinto':'COL','Y. Tsunoda':'TSU',
    'A. Albon':'ALB','E. Ocon':'OCO','S. Perez':'PER','P. Doornbos':'DOO','J. Doohan':'DOO',
    'Z. Zhou':'ZHO','N. Mazepin':'MAZ','K. Magnussen':'MAG','L. Sargeant':'SAR','J. Crawford':'CRA',
}

def name_to_code(name):
    if not name: return None
    name = str(name).strip()
    if name in NAME_TO_CODE: return NAME_TO_CODE[name]
    # try last-name match
    last = name.split('.')[-1].strip().lower()
    for k,v in NAME_TO_CODE.items():
        if k.split('.')[-1].strip().lower() == last:
            return v
    return None

results = {}

for i, (hdr_row, label, is_sprint) in enumerate(sections):
    race_id = label_to_race_id(label)
    if not race_id: continue
    block_end = sections[i+1][0] if i+1 < len(sections) else hdr_row + 40

    picks = {uid: {'top': [], 'fl': None, 'dnf': None} for uid,_,_ in USERS}
    # find "Driver Finish" header row in this block
    driver_header_row = None
    for r in range(hdr_row+1, min(hdr_row+5, block_end)):
        if r in grid and 1 in grid[r] and grid[r][1] == 'Driver Finish':
            driver_header_row = r
            break
    if not driver_header_row:
        continue

    # Scan from driver_header_row+1 until we hit "Fastest Lap" or end of block
    for r in range(driver_header_row+1, block_end):
        if r not in grid: continue
        row = grid[r]
        # stop at Fastest Lap
        if 2 in row and isinstance(row[2], str) and 'Fastest' in row[2]:
            for uid, uname, dcol in USERS:
                drv = row.get(dcol)
                if drv:
                    picks[uid]['fl'] = name_to_code(drv)
            # continue to DNF row
            continue
        if 2 in row and isinstance(row[2], str) and row[2] == 'DNF':
            for uid, uname, dcol in USERS:
                drv = row.get(dcol)
                if drv:
                    dname = str(drv).strip()
                    if dname.lower() in ('none','null','-',''):
                        picks[uid]['dnf'] = None
                    else:
                        first = dname.split(',')[0].strip()
                        code = name_to_code(first)
                        picks[uid]['dnf'] = code or dname
            continue
        # position row: collect driver picks in order
        any_driver = False
        for uid, uname, dcol in USERS:
            drv = row.get(dcol)
            if drv and isinstance(drv, str):
                code = name_to_code(drv)
                if code:
                    picks[uid]['top'].append(code)
                    any_driver = True
        # stop if we've passed into totals (no drivers and not FL/DNF)
        if not any_driver and not any(isinstance(row.get(c), (int,float)) for c in [4,6,8,10,12]):
            # check if this is a totals/empty row past the picks
            if any(isinstance(row.get(c), str) and 'Point' in str(row.get(c)) for c in [1,3]):
                break

    # truncate to 10 (race) or 8 (sprint)
    maxlen = 8 if is_sprint else 10
    for uid in picks:
        picks[uid]['top'] = picks[uid]['top'][:maxlen]

    key = f"{race_id}{'_sprint' if is_sprint else ''}"
    results[key] = {'label': label, 'picks': picks}

# Print
for key in sorted(results.keys()):
    data = results[key]
    print(f"\n{key} ({data['label']})")
    for uid, uname, _ in USERS:
        p = data['picks'][uid]
        print(f"  {uname}: top={p['top']} ({len(p['top'])}) fl={p['fl']} dnf={p['dnf']}")

with open('tmp/extracted_picks_v2.json','w') as f:
    json.dump({k: v['picks'] for k,v in results.items()}, f, indent=2)
print("\nSaved to tmp/extracted_picks_v2.json")
