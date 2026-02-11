# Large CSV data and import

- **full_dataset.csv** – 2.2M recipe rows (title, ingredients, directions, link, source, NER). Not in Git (ignored).
- **inspect_large_csv.py** – Inspect schema and first rows without loading the whole file.
- **import_full_dataset.py** – Map CSV to `recipes` and insert into Supabase in batches.

## Mapping (CSV → recipes)

| CSV column | recipes column | Notes |
|------------|----------------|--------|
| (first column index) | `recipe_id` | `fd-0`, `fd-1`, … (unique) |
| title | `recipe_label` | |
| ingredients | `ingredient_lines` | JSON array → joined with `***` |
| directions | `steps` | JSON array → joined with `***` |
| link | `website_url` | `https://` added if missing |
| — | calories | `0` (not in CSV) |
| — | cuisine_type, meal_type, image_url | `null` |
| — | time_in_minutes | `0` |

## Install (view data)

Use the **same Python** that Cursor uses to run the script (e.g. Python 3.13 or 3.14 in "Select Interpreter"). From repo root:

```bash
pip install -r data/requirements.txt
```

This installs only **polars** so `inspect_large_csv.py` runs. If Cursor still says "Polars not installed", select the interpreter where you ran `pip install` (e.g. **Python 3.14** if that's where polars is installed).

## Run import (when ready)

Install import deps (can fail on Windows without Microsoft C++ Build Tools, because of supabase → pyiceberg/pyroaring):

```bash
pip install -r data/requirements-import.txt
```

Ensure **NEXT_PUBLIC_SUPABASE_URL** and **SUPABASE_SECRET_KEY** are set (e.g. in `HomeRecipe/next-app/.env.local`). Then:

```bash
# Append: add CSV recipes; existing recipes stay (duplicates by recipe_id are skipped)
python data/import_full_dataset.py

# Replace: delete all recipes (and folder/favorite refs), then import CSV
python data/import_full_dataset.py --replace

# Test: only first 1000 rows, no insert
python data/import_full_dataset.py --dry-run --limit 1000
```

Replace runs for 2.2M rows can take a long time (batch size 500; Supabase rate limits may apply).
