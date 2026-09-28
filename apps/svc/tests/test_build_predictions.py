from training.build_prediction import find_entity_spans


def test_finds_simple_span():
    result = find_entity_spans(
        "Software Developer at Acme",
        [{"text": "Software Developer", "label": "JOB_TITLE"}]
    )

    assert len(result) == 1

    assert result[0]["value"] == {
        "start": 0,
        "end": 18,
        "text": "Software Developer",
        "labels": ["JOB_TITLE"]
    }


def test_repeated_text_matches_next_occurrence():
    text = "Quezon City job one. Later, Quezon City job two."

    entities = [
        {"text": "Quezon City", "label": "LOCATION"},
        {"text": "Quezon City", "label": "LOCATION"},
    ]

    result = find_entity_spans(text, entities)

    assert [r["value"]["start"] for r in result] == [0, 28]


def test_missing_text_is_skipped_not_crashed():
    result = find_entity_spans(
        "Some text here",
        [{"text": "NOT PRESENT", "label": "SKILL"}]
    )

    assert result == []