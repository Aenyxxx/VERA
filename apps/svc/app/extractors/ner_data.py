import json
from pathlib import Path
import re


VALID_LABELS = {
    "NAME",
    "COMPANY",
    "JOB_TITLE",
    "SKILL",
    "EDUCATION",
}


def load_annotations(file_path: str) -> list[dict]:
    """
    Load annotated resume examples from a JSON file.
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Annotation file not found: {file_path}")

    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, list):
        raise ValueError("Annotation data must be a list.")

    return data


def validate_annotations(data: list[dict]) -> None:
    """
    Validate resume entity annotations.
    """

    for example_index, example in enumerate(data):
        if "text" not in example:
            raise ValueError(
                f"Example {example_index}: missing 'text'."
            )

        if "entities" not in example:
            raise ValueError(
                f"Example {example_index}: missing 'entities'."
            )

        text = example["text"]
        entities = example["entities"]

        if not isinstance(text, str):
            raise ValueError(
                f"Example {example_index}: 'text' must be a string."
            )

        if not isinstance(entities, list):
            raise ValueError(
                f"Example {example_index}: 'entities' must be a list."
            )

        for entity_index, entity in enumerate(entities):

            if not all(
                key in entity
                for key in ("start", "end", "label")
            ):
                raise ValueError(
                    f"Example {example_index}, entity {entity_index}: "
                    "must contain start, end, and label."
                )

            start = entity["start"]
            end = entity["end"]
            label = entity["label"]

            if label not in VALID_LABELS:
                raise ValueError(
                    f"Example {example_index}, entity {entity_index}: "
                    f"invalid label '{label}'."
                )

            if not isinstance(start, int) or not isinstance(end, int):
                raise ValueError(
                    f"Example {example_index}, entity {entity_index}: "
                    "start and end must be integers."
                )

            if start < 0 or end > len(text):
                raise ValueError(
                    f"Example {example_index}, entity {entity_index}: "
                    "entity span is outside the text."
                )

            if start >= end:
                raise ValueError(
                    f"Example {example_index}, entity {entity_index}: "
                    "start must be smaller than end."
                )

            entity_text = text[start:end]

            if entity_text != entity_text.strip():
                raise ValueError(
                    f"Example {example_index}, entity {entity_index}: "
                    f"entity span contains leading or trailing whitespace: "
                    f"'{entity_text}'"
                )

            if not entity_text.strip():
                raise ValueError(
                    f"Example {example_index}, entity {entity_index}: "
                    "entity span contains no meaningful text."
                )

            print(
                f"✓ {label}: '{entity_text}' "
                f"({start}:{end})"
            )

def tokenize_with_spans(text: str) -> list[tuple[str, int, int]]:
    """
    Split text into tokens while keeping each token's
    character start and end positions.
    """

    tokens = []

    for match in re.finditer(r"\w+|[^\w\s]", text):
        tokens.append(
            (
                match.group(),
                match.start(),
                match.end(),
            )
        )

    return tokens

def annotations_to_bio(
    text: str,
    entities: list[dict],
) -> list[tuple[str, str]]:
    """
    Convert character-span annotations into BIO labels.
    """

    tokens = tokenize_with_spans(text)
    results = []

    for token, token_start, token_end in tokens:
        label = "O"

        for entity in entities:
            entity_start = entity["start"]
            entity_end = entity["end"]
            entity_label = entity["label"]

            # Check whether this token belongs to the entity.
            if token_start >= entity_start and token_end <= entity_end:
                if token_start == entity_start:
                    label = f"B-{entity_label}"
                else:
                    label = f"I-{entity_label}"

                break

        results.append((token, label))

    return results