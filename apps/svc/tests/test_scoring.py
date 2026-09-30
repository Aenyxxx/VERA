from training.scoring import classification_report, get_entities, overall_scores


def test_get_entities_reads_bio_spans():
    tags = ["B-JOB_TITLE", "I-JOB_TITLE", "O", "B-DATE", "I-DATE", "I-DATE"]
    assert get_entities(tags) == [("JOB_TITLE", 0, 2), ("DATE", 3, 6)]


def test_get_entities_splits_adjacent_entities():
    tags = ["B-COMPANY", "B-COMPANY", "I-COMPANY"]
    assert get_entities(tags) == [("COMPANY", 0, 1), ("COMPANY", 1, 3)]


def test_exact_span_match_is_required():
    y_true = [["B-SKILL", "I-SKILL", "O"]]
    y_pred = [["B-SKILL", "O", "O"]]          # right label, wrong span
    assert overall_scores(y_true, y_pred) == (0.0, 0.0, 0.0)


def test_perfect_prediction_scores_one():
    y = [["B-SKILL", "I-SKILL", "O", "B-DATE"]]
    assert overall_scores(y, y) == (1.0, 1.0, 1.0)
    assert "micro avg" in classification_report(y, y)