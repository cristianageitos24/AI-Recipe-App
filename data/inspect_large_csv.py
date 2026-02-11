"""
View full_dataset.csv (no Supabase, no import). Schema, first 30 rows, row count.
Run from repo root: python data/inspect_large_csv.py
Or from data/:  python inspect_large_csv.py
"""
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "full_dataset.csv")

if not os.path.isfile(CSV_PATH):
    print(f"File not found: {CSV_PATH}")
    sys.exit(1)

try:
    import polars as pl  # type: ignore[import-untyped]
except ImportError:
    print("Polars not installed. Run: pip install -r data/requirements.txt")
    sys.exit(1)

print("Scanning CSV (lazy, no full load)...")
lf = pl.scan_csv(CSV_PATH)

print("\n--- Schema (column names and types) ---")
print(lf.collect_schema())

print("\n--- First 30 rows ---")
first = lf.head(30).collect()
preview_path = os.path.join(SCRIPT_DIR, "inspect_preview.txt")
first.write_csv(preview_path)
print(f"Written to {preview_path}")
try:
    print(first)
except UnicodeEncodeError:
    print("(Preview contains non-ASCII characters; see inspect_preview.txt)")

print("\n--- Row count (streaming, may take a minute for 2M+ rows) ---")
n = lf.select(pl.len()).collect().item()
print(f"Total rows: {n:,}")

# Keep window open when run by double-click (e.g. on Windows); skip when not interactive
if sys.platform == "win32" and sys.stdin.isatty():
    input("\nPress Enter to close...")
