import json, re

with open('tmp/numbers_rows.json') as f:
    rows = json.load(f)

# Build a dense grid: row -> col -> value
grid = {}
for row in rows:
    r = row['r']
    grid[r] = {}
    for c, v in enumerate(row['cells']):
        if v is not None and str(v).strip() != '':
            grid[r][c] = v

# Find round header rows in order
round_headers = []  # (row, label)
for r in sorted(grid.keys()):
    if 1 in grid[r] and isinstance(grid[r][1], str) and 'Round' in grid[r][1] and 'Grand Prix' in grid[r][1]:
        round_headers.append((r, grid[r][1]))

# Map spreadsheet round labels to app race_ids
# Australia R1->r01, China R2->r02, Japan R3->r03, Miami R6->r04, Canada R7->r05,
# Monaco R8->r06, Spain R9->r07, Austria R10->r08, British R11->r09, Belgian R12->r10
def label_to_race_id(label):
    m = re.match(r'Round (\d+)', label)
    if not m: return None, None
    rn = int(m.group(1))
    is_sprint = 'Sprint' in label
    # R4 (Bahrain) & R5 (Saudi) cancelled
    mapping = {1:'r01',2:'r02',3:'r03',6:'r04',7:'r05',8:'r06',9:'r07',10:'r08',11:'r09',12:'r10'}
    race_id = mapping.get(rn)
    return race_id, is_sprint

# User columns: Skye 5,6; Whitney 7,8; Bryan 9,10; Carlos 11,12
USERS = [
    ('cb7536a7-ad8b-44d4-981b-4b24c19abcc4', 'Skye Leach', 5),
    ('652154af-dc27-47b5-aa79-25903b9c4a1b', 'Whitney Trujillo', 7),
    ('f35417e9-4f0d-4def-9c2f-c81276863fc0', 'Bryan Leach', 9),
    ('e11ea4f5-2ba4-4241-9791-b4b6a560534b', 'Carlos Trujillo', 11),
]

# Driver name -> code mapping (from f1-data.ts)
NAME_TO_CODE = {
    'G. Russell':'RUS','George Russell':'RUS','Russell':'RUS',
    'K. Antonelli':'ANT','Antonelli':'ANT',
    'C. Leclerc':'LEC','Leclerc':'LEC',
    'L. Hamilton':'HAM','Hamilton':'HAM','L. Hamillton':'HAM',
    'L. Norris':'NOR','Norris':'NOR',
    'M. Verstappen':'VER','Verstappen':'VER',
    'O. Piastri':'PIA','Piastri':'PIA',
    'I. Hadjar':'HAD','I. Hadkar':'HAD','Hadjar':'HAD',
    'L. Lawson':'LAW','Lawson':'LAW',
    'C. Sainz':'SAI','Sainz':'SAI',
    'N. Hulkenberg':'HUL','Hulkenberg':'HUL','N. Hülkenberg':'HUL',
    'P. Gasly':'GAS','Gasly':'GAS',
    'O. Bearman':'BEA','Bearman':'BEA',
    'A. Lindbald':'LIN','Lindbald':'LIN','A. Lindblad':'LIN',
    'G. Bartoleto':'BOR','Bartoleto':'BOR','G. Bortoleto':'BOR','Bortoleto':'BOR',
    'F. Alonso':'ALO','Alonso':'ALO',
    'V. Bottas':'BOT','Bottas':'BOT',
    'L. Stroll':'STR','Stroll':'STR',
    'E. Ocon':'OCO','Ocon':'OCO',
    'P. Doornbos':'DOO',
    'N. Mazepin':'MAZ',
    'F. Colapinto':'COL','Colapinto':'COL',
    'Y. Tsunoda':'TSU','Tsunoda':'TSU',
    'A. Albon':'ALB','Albon':'ALB',
    'Z. Zhou':'ZHO','Zhou':'ZHO',
    'K. Magnussen':'MAG',
    'L. Sargeant':'SAR',
    'J. Doohan':'DOO',
    'J. Crawford':'CRA',
    'R. Hadjar':'HAD',
}

def name_to_code(name):
    if not name: return None
    name = str(name).strip()
    if name in NAME_TO_CODE: return NAME_TO_CODE[name]
    # try last name match
    for k,v in NAME_TO_CODE.items():
        if k.split('.')[-1].strip().lower() == name.split('.')[-1].strip().lower():
            return v
    return None

# Parse each round block
results = {}  # {race_id: {sprint: bool, users: {uid: {top, fl, dnf}}}}

for i, (hdr_row, label) in enumerate(round_headers):
    race_id, is_sprint = label_to_race_id(label)
    if not race_id:
        continue
    # Determine block end = next round header row (or far enough)
    block_end = round_headers[i+1][0] if i+1 < len(round_headers) else hdr_row + 40
    
    # Find user picks in this block
    # Positions 1-10 (or 1-8 for sprint): col 2 = pos number, col 3 = actual driver
    # User driver cols: Skye=5, Whitney=7, Bryan=9, Carlos=11
    picks = {uid: {'top': [], 'fl': None, 'dnf': None} for uid,_,_ in USERS}
    
    for r in range(hdr_row+1, block_end):
        if r not in grid: continue
        row = grid[r]
        # Position rows: col 2 is a number
        pos = row.get(2)
        if isinstance(pos, (int, float)) and 1 <= pos <= 15:
            for uid, uname, dcol in USERS:
                drv = row.get(dcol)
                if drv:
                    code = name_to_code(drv)
                    if code:
                        picks[uid]['top'].append((int(pos), code))
        # Fastest Lap row
        if 2 in row and isinstance(row[2], str) and 'Fastest' in row[2]:
            for uid, uname, dcol in USERS:
                drv = row.get(dcol)
                if drv:
                    picks[uid]['fl'] = name_to_code(drv)
        # DNF row
        if 2 in row and isinstance(row[2], str) and row[2] == 'DNF':
            for uid, uname, dcol in USERS:
                drv = row.get(dcol)
                if drv:
                    # DNF could be a single name or comma-separated list
                    dname = str(drv).strip()
                    if dname.lower() in ('none','null','-',''):
                        picks[uid]['dnf'] = None
                    else:
                        # take first name if list
                        first = dname.split(',')[0].strip()
                        code = name_to_code(first)
                        picks[uid]['dnf'] = code or dname
    
    # Sort picks by position
    for uid in picks:
        picks[uid]['top'].sort(key=lambda x: x[0])
        picks[uid]['top'] = [c for _,c in picks[uid]['top']]
    
    key = (race_id, is_sprint)
    results[key] = {'label': label, 'picks': picks}

# Print summary
print("=== EXTRACTED PICKS ===")
for (race_id, is_sprint), data in sorted(results.items()):
    kind = 'SPRINT' if is_sprint else 'RACE'
    print(f"\n{race_id} {kind} ({data['label']})")
    for uid, uname, _ in USERS:
        p = data['picks'][uid]
        print(f"  {uname}: top={p['top']} fl={p['fl']} dnf={p['dnf']}")

# Save to file
out = {}
for (race_id, is_sprint), data in results.items():
    key = f"{race_id}{'_sprint' if is_sprint else ''}"
    out[key] = data['picks']
with open('tmp/extracted_picks.json','w') as f:
    json.dump(out, f, indent=2)
print("\nSaved to tmp/extracted_picks.json")
