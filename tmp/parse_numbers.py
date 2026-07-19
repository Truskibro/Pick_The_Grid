from numbers_parser import Document
import json, sys

doc = Document('tmp/updated_predictions.numbers')
sheets = list(doc.sheets)
print("Sheet names:", [str(s) for s in sheets], file=sys.stderr)

for sheet in doc.sheets:
    sname = sheet.name
    print(f"\n=== Sheet: {sname} ===", file=sys.stderr)
    for table in sheet.tables:
        tname = table.name
        print(f"--- Table: {tname} (rows={table.num_rows}, cols={table.num_cols}) ---", file=sys.stderr)
        rows_out = []
        for r in range(table.num_rows):
            row = []
            for c in range(table.num_cols):
                try:
                    cell = table.cell(r, c)
                    val = cell.value if cell else None
                except Exception as e:
                    val = None
                row.append(val)
            rows_out.append(row)
        print(json.dumps({"table": tname, "num_rows": table.num_rows, "num_cols": table.num_cols, "rows": rows_out}))
