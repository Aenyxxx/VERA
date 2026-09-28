import json
from pathlib import Path

from app.extractors.sections import split_sections

BATCHES_DIR = Path("data/ner/raw/synthetic_batches")
RESUMES_DIR = Path("data/ner/raw/resumes")
OUTPUT_FILE = Path("data/ner/raw/tasks_with_predictions.json")

SECTIONS_TO_LABEL = ("experience", "education", "skills")


def find_entity_spans(section_text: str, entities: list[dict]) -> list[dict]:
    """Locate each entity's exact character offsets inside section_text.
    Tracks a cursor per distinct entity text so repeated values
    (e.g. 'Quezon City' twice) each match a different occurrence."""
    cursors: dict[str, int] = {}
    results = []
    for ent in entities:
        text, label = ent["text"], ent["label"]
        start_from = cursors.get(text, 0)
        idx = section_text.find(text, start_from)
        if idx == -1:
            print(f"    WARNING: could not find {label} text {text!r} in section — skipped")
            continue
        end = idx + len(text)
        cursors[text] = end
        results.append(
            {
                "value": {"start": idx, "end": end, "text": text, "labels": [label]},
                "from_name": "label",
                "to_name": "text",
                "type": "labels",
            }
        )
    return results


def load_all_samples() -> list[dict]:
    samples = []
    batch_files = sorted(BATCHES_DIR.glob("*.json"))
    if not batch_files:
        raise SystemExit(f"No batch files found in {BATCHES_DIR}")
    for path in batch_files:
        with open(path, encoding="utf-8") as f:
            batch = json.load(f)
        print(f"Loaded {len(batch)} sample(s) from {path.name}")
        samples.extend(batch)
    return samples


def main() -> None:
    samples = load_all_samples()
    RESUMES_DIR.mkdir(parents=True, exist_ok=True)
    tasks = []

    print()
    for sample in samples:
        resume_id = sample["resume_id"]
        text = sample["standardized_text"]

        with open(RESUMES_DIR / f"{resume_id}.json", "w", encoding="utf-8") as f:
            json.dump({"standardized_text": text}, f, ensure_ascii=False, indent=2)

        sections = split_sections(text)
        print(f"{resume_id}:")
        for section_name in SECTIONS_TO_LABEL:
            body = sections.get(section_name, "").strip()
            entities = sample.get("entities", {}).get(section_name, [])
            if not body:
                continue
            result = find_entity_spans(body, entities)
            print(f"  {section_name}: {len(result)}/{len(entities)} entities matched")
            tasks.append(
                {
                    "data": {"text": body, "resume_id": resume_id, "section": section_name},
                    "predictions": [
                        {"model_version": "llm-prelabel-v1", "score": 0.95, "result": result}
                    ],
                }
            )

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(tasks, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {len(tasks)} tasks with predictions to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()