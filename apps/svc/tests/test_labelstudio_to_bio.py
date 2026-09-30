from training.labelstudio_to_bio import split_resume_ids, task_to_entities, trim_span


def test_trim_span_removes_trailing_separator():
    text = "De La Salle University (DLSU), Manila"
    start, end = trim_span(text, 0, len("De La Salle University (DLSU),"))
    assert text[start:end] == "De La Salle University (DLSU)"


def test_split_is_by_resume_and_deterministic():
    ids = [f"r{i}" for i in range(31)]
    a, b = split_resume_ids(ids), split_resume_ids(ids)
    assert a == b
    everyone = a["train"] + a["validation"] + a["test"]
    assert sorted(everyone) == sorted(ids)      # nothing lost, nothing duplicated
    assert a["validation"] and a["test"]


def test_cancelled_annotation_is_skipped():
    task = {"data": {"text": "Line Cook"},
            "annotations": [{"was_cancelled": True, "result": []}]}
    assert task_to_entities(task) is None


def test_task_to_entities_trims_and_reads_label():
    task = {
        "data": {"text": "Line Cook, Kusina"},
        "annotations": [{
            "updated_at": "2026",
            "result": [{"type": "labels",
                        "value": {"start": 0, "end": 10, "text": "Line Cook,",
                                  "labels": ["JOB_TITLE"]}}],
        }],
    }
    _, entities = task_to_entities(task)
    assert entities == [{"start": 0, "end": 9, "label": "JOB_TITLE"}]