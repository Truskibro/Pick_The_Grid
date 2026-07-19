from numbers_parser import Document
import json

doc = Document('tmp/updated_predictions.numbers')
sheet = doc.sheets['2026']
table = sheet.tables['Table 1']

# Dump all non-empty rows compactly
out = []
for r in range(table.num_rows):
    row = []
    has_val = False
    for c in range(table.num_cols):
        try:
            cell = table.cell(r, c)
            val = cell.value if cell else None
        except Exception:
            val = None
        if val is not None and str(val).strip() != '':
            has_val = True
        row.append(val)
    if has_val:
        out.append({'r': r, 'cells': row})

with open('tmp/numbers_rows.json', 'w') as f:
    json.dump(out, f, indent=1, default=str)
print(f"Wrote {len(out)} non-empty rows")
