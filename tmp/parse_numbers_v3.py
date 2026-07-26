#!/usr/bin/env python3
"""Re-parse the Numbers spreadsheet from scratch — ground truth for picks.

Dumps every cell of every table so we can see the exact layout, then
extract picks per user per round.
"""
import json
import sys
from numbers_parser import Document

NUMBERS_FILE = sys.argv[1] if len(sys.argv) > 1 else "tmp/updated_predictions.numbers"

doc = Document(NUMBERS_FILE)
sheets = doc.sheets
print(f"=== Document: {NUMBERS_FILE} ===")
print(f"Sheets: {len(sheets)}")
for sheet in sheets:
    print(f"\n--- Sheet: {sheet.name} ---")
    tables = sheet.tables
    print(f"Tables: {len(tables)}")
    for table in tables:
        print(f"\n  Table: {table.name}  rows={table.num_rows} cols={table.num_cols}")
        # Dump every cell
        for row_idx in range(table.num_rows):
            row_cells = []
            for col_idx in range(table.num_cols):
                try:
                    cell = table.cell(row_idx, col_idx)
                    val = cell.value
                    if val is None:
                        row_cells.append("")
                    else:
                        row_cells.append(str(val))
                except Exception as e:
                    row_cells.append(f"<err:{e}>")
            # Only print non-empty rows
            if any(c.strip() for c in row_cells):
                print(f"  R{row_idx:02d}: {row_cells}")
