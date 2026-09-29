"""Entity-level precision/recall/F1 for BIO tag sequences.

Plain Python only (no torch/numpy), so it can be unit-tested locally.
An entity counts as correct only if its label AND exact span both match,
which is the same rule seqeval uses.
"""
from collections import defaultdict

from app.extractors.labels import ENTITY_TYPES

def get_entities(tags: list[str]) -> list[tuple[str, int, int]]:
    """Return (label, start, end) spans found in one BIO tag sequence."""
    entities = []
    current_label, start = None, 0
    for i, tag in enumerate(list(tags) + ["O"]):      # sentinel closes the last entity
        prefix, _, label = tag.partition("-")
        continues = prefix == "I" and label == current_label
        if current_label is not None and not continues:
            entities.append((current_label, start, i))
            current_label = None
        if prefix == "B" or (prefix == "I" and current_label is None):
            current_label, start = label, i
    return entities


def entity_counts(y_true, y_pred) -> dict[str, dict[str, int]]:
    """Per label: true positives, false positives, false negatives."""
    counts = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    for true_seq, pred_seq in zip(y_true, y_pred):
        true_ents, pred_ents = set(get_entities(true_seq)), set(get_entities(pred_seq))
        for ent in true_ents & pred_ents:
            counts[ent[0]]["tp"] += 1
        for ent in pred_ents - true_ents:
            counts[ent[0]]["fp"] += 1
        for ent in true_ents - pred_ents:
            counts[ent[0]]["fn"] += 1
    return counts


def prf(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def overall_scores(y_true, y_pred) -> tuple[float, float, float]:
    counts = entity_counts(y_true, y_pred)
    return prf(
        sum(c["tp"] for c in counts.values()),
        sum(c["fp"] for c in counts.values()),
        sum(c["fn"] for c in counts.values()),
    )


def classification_report(y_true, y_pred) -> str:
    counts = entity_counts(y_true, y_pred)
    lines = [f"{'':<12}{'precision':>10}{'recall':>10}{'f1':>10}{'support':>10}"]
    for label in ENTITY_TYPES:
        c = counts[label]
        p, r, f = prf(c["tp"], c["fp"], c["fn"])
        lines.append(f"{label:<12}{p:>10.3f}{r:>10.3f}{f:>10.3f}{c['tp'] + c['fn']:>10}")
    p, r, f = overall_scores(y_true, y_pred)
    support = sum(c["tp"] + c["fn"] for c in counts.values())
    lines.append(f"{'micro avg':<12}{p:>10.3f}{r:>10.3f}{f:>10.3f}{support:>10}")
    return "\n".join(lines)