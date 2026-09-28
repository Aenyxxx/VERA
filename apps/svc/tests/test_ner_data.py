from app.extractors.ner_data import (
    load_annotations,
    validate_annotations,
)

from app.extractors.ner_data import (
    annotations_to_bio,
    load_annotations,
    validate_annotations,
)


def test_train_annotations():
    data = load_annotations("data/ner/train/train.json")

    validate_annotations(data)


def test_annotations_to_bio():
    data = load_annotations("data/ner/train/train.json")

    example = data[0]

    result = annotations_to_bio(
        example["text"],
        example["entities"],
    )

    expected = [
        ("John", "B-NAME"),
        ("Dela", "I-NAME"),
        ("Cruz", "I-NAME"),
        ("is", "O"),
        ("a", "O"),
        ("Software", "B-JOB_TITLE"),
        ("Engineer", "I-JOB_TITLE"),
        ("at", "O"),
        ("ABC", "B-COMPANY"),
        ("Technologies", "I-COMPANY"),
        (".", "O"),
    ]

    assert result == expected