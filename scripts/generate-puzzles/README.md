# Regenerating `assets/puzzles.json`

Source: the free [Lichess puzzle database](https://database.lichess.org) (CC0). ~5M puzzles as of
writing; these scripts filter it down to a curated, offline, beginner-focused subset.

## Requirements

- Python 3.11+ with the `zstandard` package: `pip install zstandard`
- Node (already required by the project)

## Steps

```bash
# 1. Download the compressed CSV (~300MB).
curl -L -o puzzles.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst

# 2. Stream-decompress + filter to beginner themes/ratings, bucketed by difficulty stage
#    (bounded-memory: keeps only the top N most-popular puzzles per stage/theme as it scans).
python filter-puzzles.py puzzles.csv.zst curated.json

# 3. Apply each puzzle's setup move via chess.js, validate the full solution replays legally,
#    and write the final sorted/validated JSON.
node convert-puzzles.mjs curated.json puzzles-final.json

# 4. Copy the result into the app.
cp puzzles-final.json ../../src/renderer/assets/puzzles.json
```

Adjust `BEGINNER_THEMES`, `STAGE_BOUNDS`, or `PER_BUCKET` in `filter-puzzles.py` to change which
themes/difficulty range/how many puzzles per stage end up in the final set.
