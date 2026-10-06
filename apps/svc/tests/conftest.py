import datetime as dt
import os

import numpy as np
import pytest

# Set before app.main is imported so every test has a configured key.
TEST_INTERNAL_KEY = "test-internal-key"
os.environ["SVC_INTERNAL_KEY"] = TEST_INTERNAL_KEY


@pytest.fixture
def auth_headers():
    return {"X-Internal-Key": TEST_INTERNAL_KEY}


# ------------------------------------------------------------------ docs/ALGORITHM.md §6 worked example
# Cashier vacancy vs. an applicant with 6 months of cashier experience (fixed dates, so 'today' does not
# matter). The similarity values are the illustrative ones from §6, injected in place of the SBERT model
# so the math is checked exactly.
WORKED_TODAY = dt.date(2026, 10, 6)

WORKED_SECTIONS = {
    "skills": "Cash handling\nPOS system\nCustomer service",
    "experience": (
        "Cashier — Kabayan Mart\n"
        "Baliuag, Bulacan\n"
        "January 2026 – June 2026\n"
        "- Processed cash and cashless payments and issued receipts\n"
        "- Balanced the cash drawer at end of shift"
    ),
}

WORKED_JOB = {
    "skills": "Cash handling\nPOS system operation\nCustomer service\nIssuing receipts",
    "experience": "Cashier\nProcess cash and cashless payments\nBalance the cash drawer",
    "min_years": 1,
}

_RECEIPTS_BULLET = "Processed cash and cashless payments and issued receipts"

# (requirement, evidence) -> raw cosine. Unlisted pairs are 0 (unrelated).
WORKED_SIMILARITIES = {
    ("Cash handling", "Cash handling"): 0.92,
    ("POS system operation", "POS system"): 0.71,
    ("Customer service", "Customer service"): 0.88,
    # §6 lists 0.50 *after* the 0.90 bullet discount; the code applies the discount itself.
    ("Issuing receipts", _RECEIPTS_BULLET): 0.50 / 0.90,
    ("Cashier", "Cashier"): 0.80,
    ("Process cash and cashless payments", _RECEIPTS_BULLET): 0.66,
    ("Balance the cash drawer", "Balanced the cash drawer at end of shift"): 0.55,
}


@pytest.fixture
def fake_similarity(monkeypatch):
    """Replace SBERT + cosine with the §6 lookup table (no model needed)."""
    from app.matchers import algorithm

    def fake_embed(texts):
        return np.array(list(texts), dtype=object).reshape(-1, 1)      # "vectors" that carry their text

    def fake_cosine(a, b):
        return np.array([[WORKED_SIMILARITIES.get((j[0], e[0]), 0.0) for e in b] for j in a], dtype=float)

    monkeypatch.setattr(algorithm, "embed", fake_embed)
    monkeypatch.setattr(algorithm, "cosine_similarity_matrix", fake_cosine)
    return WORKED_SIMILARITIES
