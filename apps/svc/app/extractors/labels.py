"""Single source of truth for the NER label set."""

ENTITY_TYPES = [
    "JOB_TITLE", "COMPANY", "DATE", "LOCATION",
    "DEGREE", "SCHOOL", "FIELD", "SKILL",
]

# BIO scheme: B- begins an entity, I- continues it, O is outside any entity.
LABELS = ["O"] + [f"{prefix}-{e}" for e in ENTITY_TYPES for prefix in ("B", "I")]
LABEL2ID = {label: i for i, label in enumerate(LABELS)}
ID2LABEL = {i: label for label, i in LABEL2ID.items()}