import pytest

from app.extractors.ner_data import annotations_to_bio, validate_annotations


def test_bio_tags_are_correct():
    text = "Human Resources Generalist at Megaworld"
    entities = [
        {"start": 0, "end": 26, "label": "JOB_TITLE"},
        {"start": 30, "end": 39, "label": "COMPANY"},
    ]
    tags = [tag for _, tag in annotations_to_bio(text, entities)]
    assert tags == ["B-JOB_TITLE", "I-JOB_TITLE", "I-JOB_TITLE", "O", "B-COMPANY"]


def test_dotted_words_stay_whole():
    words = [w for w, _ in annotations_to_bio("Node.js developer", [])]
    assert words == ["Node.js", "developer"]


def test_invalid_label_is_rejected():
    data = [{"text": "Hello", "entities": [{"start": 0, "end": 5, "label": "NAME"}]}]
    with pytest.raises(ValueError):
        validate_annotations(data)


def test_overlapping_entities_are_rejected():
    data = [{
        "text": "Human Resources",
        "entities": [
            {"start": 0, "end": 11, "label": "JOB_TITLE"},
            {"start": 6, "end": 15, "label": "FIELD"},
        ],
    }]
    with pytest.raises(ValueError):
        validate_annotations(data)