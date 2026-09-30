"""Turn anonymized resume JSONs into Label Studio tasks.

Run from inside svc/:  python -m training.make_tasks
"""
import json
from pathlib import Path

from app.extractors.sections import split_sections

RESUMES_DIR = Path("data/ner/raw/resumes")
OUTPUT_FILE = Path("data/ner/raw/tasks.json")

# Only these sections are ever labeled or sent to the model.
SECTIONS_TO_LABEL = ("experience", "education", "skills")


def build_tasks(resume_id: str, standardized_text: str) -> list[dict]:
    """One Label Studio task per non-empty experience/education/skills section."""
    sections = split_sections(standardized_text)
    tasks = []
    for name in SECTIONS_TO_LABEL:
        body = sections.get(name, "").strip()
        if not body:
            continue
        tasks.append(
            {"data": {"text": body, "resume_id": resume_id, "section": name}}
        )
    return tasks


def main() -> None:
    files = sorted(RESUMES_DIR.glob("*.json"))
    if not files:
        raise SystemExit(f"No resume JSON files found in {RESUMES_DIR}")

    all_tasks = []
    for path in files:
        with open(path, encoding="utf-8") as f:
            text = json.load(f)["standardized_text"]
        tasks = build_tasks(path.stem, text)
        all_tasks.extend(tasks)
        print(f"{path.name}: {len(tasks)} tasks ({', '.join(t['data']['section'] for t in tasks)})")

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_tasks, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {len(all_tasks)} tasks to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()