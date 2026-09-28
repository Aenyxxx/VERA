"""Convert a Label Studio JSON export into flat BIO train/validation/test splits.

Reuses validate_annotations / to_example from ner_data.py, so BIO logic
lives in one place. Splits by resume (never by chunk) so the same resume
never appears in two splits.

Run from inside svc/:
    python -m training.labelstudio_to_bio data/ner/raw/labelstudio_export.json
"""
import argparse
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

from app.extractors.ner_data import DATA_DIR, load_split, to_example, validate_annotations

SEED = 42
VAL_FRACTION = 0.10
TEST_FRACTION = 0.10

# Separators and whitespace are never part of an entity. A trailing '.' is
# deliberately NOT trimmed, so abbreviations like "Inc." or "B.S." stay intact.
EDGE_CHARS = " \t\r\n,;:|-–—"


def trim_span(text: str, start: int, end: int) -> tuple[int, int]:
    """Shrink a span so it does not begin or end with whitespace/separators."""
    while start < end and text[start] in EDGE_CHARS:
        start += 1
    while end > start and text[end - 1] in EDGE_CHARS:
        end -= 1
    return start, end


def task_to_entities(task: dict) -> tuple[str, list[dict]] | None:
    """Return (text, entities) from a task's submitted annotation, or None
    if the task has no usable annotation (missing or cancelled)."""
    annotations = [a for a in task.get("annotations", []) if not a.get("was_cancelled")]
    if not annotations:
        return None
    annotation = max(annotations, key=lambda a: a.get("updated_at") or "")

    text = task["data"]["text"]
    entities = []
    for result in annotation["result"]:
        if result.get("type") != "labels":
            continue
        value = result["value"]
        start, end = trim_span(text, value["start"], value["end"])
        if start >= end:
            continue
        entities.append({"start": start, "end": end, "label": value["labels"][0]})
    return text, entities


def split_resume_ids(
    ids: list[str],
    seed: int = SEED,
    val_fraction: float = VAL_FRACTION,
    test_fraction: float = TEST_FRACTION,
) -> dict[str, list[str]]:
    """Deterministically split resume ids into train/validation/test."""
    ids = sorted(set(ids))
    random.Random(seed).shuffle(ids)
    n = len(ids)
    n_val = max(1, round(n * val_fraction)) if n >= 3 else 0
    n_test = max(1, round(n * test_fraction)) if n >= 3 else 0
    return {
        "validation": ids[:n_val],
        "test": ids[n_val:n_val + n_test],
        "train": ids[n_val + n_test:],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("export", type=Path, help="Label Studio JSON export")
    args = parser.parse_args()

    tasks = json.loads(args.export.read_text(encoding="utf-8"))

    by_resume: dict[str, list[dict]] = defaultdict(list)
    skipped = 0
    problems: list[str] = []
    for task in tasks:
        parsed = task_to_entities(task)
        if parsed is None:
            skipped += 1
            continue
        text, entities = parsed
        resume_id = task["data"]["resume_id"]
        section = task["data"]["section"]
        try:
            validate_annotations([{"text": text, "entities": entities}])
        except ValueError as error:
            problems.append(f"{resume_id} / {section}: {error}")
            continue
        by_resume[resume_id].append(to_example(f"{resume_id}:{section}", text, entities))

        if problems:
            print(f"{len(problems)} task(s) failed validation. Fix in Label Studio, then re-export:")
            for problem in problems:
                print("  -", problem)
            raise SystemExit(1)

    print(f"{len(tasks)} tasks read, {skipped} skipped (no annotation), "
          f"{len(by_resume)} resumes")

    splits = split_resume_ids(list(by_resume))
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    for name in ("train", "validation", "test"):
        examples = [ex for rid in sorted(splits[name]) for ex in by_resume[rid]]
        path = DATA_DIR / f"{name}.json"
        path.write_text(json.dumps(examples, ensure_ascii=False, indent=2), encoding="utf-8")
        load_split(name)  # re-reads the file and validates every example

        labels = Counter(
            tag[2:] for ex in examples for tag in ex["ner_tags"] if tag.startswith("B-")
        )
        print(f"\n{name}: {len(splits[name])} resumes, {len(examples)} examples -> {path}")
        print("  entities:", dict(sorted(labels.items())))

    # Eyeball check: show the tagged tokens of one training example.
    sample = next(iter(by_resume[splits["train"][0]]))
    print(f"\nSample {sample['id']} (non-O tokens only):")
    for token, tag in zip(sample["tokens"], sample["ner_tags"]):
        if tag != "O":
            print(f"  {tag:<12} {token}")


if __name__ == "__main__":
    main()