import csv
import heapq
import io
import json
import sys

import zstandard as zstd

SRC = sys.argv[1]
OUT = sys.argv[2]

BEGINNER_THEMES = [
    "mateIn1", "hangingPiece", "fork", "pin", "skewer",
    "discoveredAttack", "trappedPiece", "backRankMate", "mateIn2",
]
# 8 rating stages from easiest to hardest.
STAGE_BOUNDS = [400, 525, 650, 775, 900, 1025, 1150, 1275, 1400]
PER_BUCKET = 12  # per (stage, theme) — themes overlap, so final count after de-duping is smaller

def stage_of(rating):
    for i in range(len(STAGE_BOUNDS) - 1):
        if STAGE_BOUNDS[i] <= rating < STAGE_BOUNDS[i + 1]:
            return i
    return None

# One min-heap per (stage, theme), ordered by popularity so the top PER_BUCKET survive a single pass.
buckets = {}

with open(SRC, "rb") as fh:
    dctx = zstd.ZstdDecompressor()
    with dctx.stream_reader(fh) as reader:
        text_stream = io.TextIOWrapper(reader, encoding="utf-8", newline="")
        rows = csv.DictReader(text_stream)
        for row in rows:
            rating = int(row["Rating"])
            stage = stage_of(rating)
            if stage is None:
                continue
            themes = set(row["Themes"].split())
            matched = themes & set(BEGINNER_THEMES)
            if not matched:
                continue
            moves = row["Moves"].split()
            if len(moves) < 2:
                continue
            popularity = int(row["Popularity"])
            entry = {
                "id": row["PuzzleId"],
                "fen": row["FEN"],
                "moves": moves,
                "rating": rating,
                "themes": sorted(matched),
                "popularity": popularity,
            }
            # Only the puzzle's *primary* theme (first alphabetically among our whitelist) decides its
            # bucket, so a puzzle isn't duplicated across every tag it happens to carry.
            primary = sorted(matched)[0]
            key = (stage, primary)
            heap = buckets.setdefault(key, [])
            heapq.heappush(heap, (popularity, row["PuzzleId"], entry))
            if len(heap) > PER_BUCKET:
                heapq.heappop(heap)

seen_ids = set()
kept = []
for (stage, theme), heap in sorted(buckets.items()):
    for popularity, puzzle_id, entry in sorted(heap, key=lambda t: -t[0]):
        if puzzle_id in seen_ids:
            continue
        seen_ids.add(puzzle_id)
        entry["stage"] = stage
        kept.append(entry)

print(f"kept {len(kept)} puzzles across {len(buckets)} (stage, theme) buckets", file=sys.stderr)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(kept, f)
