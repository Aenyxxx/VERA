"""How many validation/test entities also appear verbatim in train?"""
from collections import Counter

from app.extractors.ner_data import load_split
from training.scoring import get_entities


def entities(split: str) -> list[tuple[str, str]]:
    found = []
    for ex in load_split(split):
        for label, start, end in get_entities(ex["ner_tags"]):
            found.append((label, " ".join(ex["tokens"][start:end])))
    return found


train = set(entities("train"))
for split in ("validation", "test"):
    ents = entities(split)
    seen = [e for e in ents if e in train]
    print(f"{split}: {len(seen)}/{len(ents)} entities ({len(seen) / len(ents):.0%}) appear verbatim in train")
    totals, hits = Counter(l for l, _ in ents), Counter(l for l, _ in seen)
    for label in totals:
        print(f"  {label:<10} {hits[label]}/{totals[label]}")