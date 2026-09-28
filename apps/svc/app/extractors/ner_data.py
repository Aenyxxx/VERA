"""Load, validate and convert span-annotated resume data to word-level BIO."""
from __future__ import annotations

import json
import re
from pathlib import Path

from app.extractors.labels import ENTITY_TYPES, LABEL2ID

VALID_LABELS = set(ENTITY_TYPES)
DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "ner"

# Keeps "node.js", "O'Brien", "3.5" whole; other punctuation is one token.
TOKEN_RE = re.compile(r"\w+(?:[-'’.]\w+)*|[^\w\s]", re.UNICODE)


def load_annotations(file_path: str) -> list[dict]:
    """Load annotated resume examples from a JSON file."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Annotation file not found: {file_path}")
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, list):
        raise ValueError("Annotation data must be a list.")
    return data


def validate_annotations(data: list[dict]) -> None:
    """Validate span annotations. Raises ValueError on the first problem."""
    for i, example in enumerate(data):
        if "text" not in example:
            raise ValueError(f"Example {i}: missing 'text'.")
        if "entities" not in example:
            raise ValueError(f"Example {i}: missing 'entities'.")

        text, entities = example["text"], example["entities"]
        if not isinstance(text, str):
            raise ValueError(f"Example {i}: 'text' must be a string.")
        if not isinstance(entities, list):
            raise ValueError(f"Example {i}: 'entities' must be a list.")

        for j, entity in enumerate(entities):
            where = f"Example {i}, entity {j}"
            if not all(key in entity for key in ("start", "end", "label")):
                raise ValueError(f"{where}: must contain start, end, and label.")

            start, end, label = entity["start"], entity["end"], entity["label"]
            if label not in VALID_LABELS:
                raise ValueError(f"{where}: invalid label '{label}'.")
            if not isinstance(start, int) or not isinstance(end, int):
                raise ValueError(f"{where}: start and end must be integers.")
            if start < 0 or end > len(text):
                raise ValueError(f"{where}: entity span is outside the text.")
            if start >= end:
                raise ValueError(f"{where}: start must be smaller than end.")

            span_text = text[start:end]
            if span_text != span_text.strip():
                raise ValueError(f"{where}: span has leading/trailing whitespace: '{span_text}'")

        ordered = sorted(entities, key=lambda e: e["start"])
        for a, b in zip(ordered, ordered[1:]):
            if b["start"] < a["end"]:
                raise ValueError(f"Example {i}: overlapping entities at {a['start']}-{b['end']}.")


def tokenize_with_spans(text: str) -> list[tuple[str, int, int]]:
    """Split text into tokens, keeping each token's character start and end."""
    return [(m.group(), m.start(), m.end()) for m in TOKEN_RE.finditer(text)]


def annotations_to_bio(text: str, entities: list[dict]) -> list[tuple[str, str]]:
    """Convert character-span annotations into (token, BIO label) pairs."""
    tokens = tokenize_with_spans(text)
    tags = ["O"] * len(tokens)

    for entity in sorted(entities, key=lambda e: e["start"]):
        inside = False
        for i, (_, start, end) in enumerate(tokens):
            if end <= entity["start"] or start >= entity["end"]:
                continue                      # token does not overlap this span
            tags[i] = ("I-" if inside else "B-") + entity["label"]
            inside = True

    return [(word, tag) for (word, _, _), tag in zip(tokens, tags)]


def to_example(example_id: str, text: str, entities: list[dict]) -> dict:
    """Build the {'id', 'tokens', 'ner_tags'} record used for training."""
    pairs = annotations_to_bio(text, entities)
    return {
        "id": example_id,
        "tokens": [word for word, _ in pairs],
        "ner_tags": [tag for _, tag in pairs],
    }


def validate_example(example: dict) -> None:
    if len(example["tokens"]) != len(example["ner_tags"]):
        raise ValueError(f"{example.get('id')}: tokens and ner_tags differ in length")
    unknown = set(example["ner_tags"]) - set(LABEL2ID)
    if unknown:
        raise ValueError(f"{example.get('id')}: unknown labels {unknown}")


def load_split(name: str) -> list[dict]:
    """name is 'train', 'validation' or 'test' (flat JSON files in data/ner/)."""
    examples = json.loads((DATA_DIR / f"{name}.json").read_text(encoding="utf-8"))
    for example in examples:
        validate_example(example)
    return examples