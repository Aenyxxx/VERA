from __future__ import annotations

import datetime as dt

from app.matchers.algorithm import run_algorithm


def matching_details(sections: dict, job: dict, today: dt.date | None = None) -> dict:
    """Full breakdown: scores, matched skills, years worked, warnings."""
    return run_algorithm(sections, job, today)


def matching(sections: dict, job: dict, today: dt.date | None = None) -> float:
    """
    Compute a normalized match score between a resume and a job.

    Args:
        sections (dict): The resume sections from the extractors (split_sections output).
        job (dict): Job with "skills" and "experience" text, optional "min_years"
            and "weights" (see algorithm.py).

    Returns:
        float: Normalized score between 0.0 and 1.0.
    """
    score = run_algorithm(sections, job, today)["final"]

    # Safety net: keep output normalized no matter what algorithm.py does
    return max(0.0, min(1.0, float(score)))


if __name__ == "__main__":
    # Quick manual test when running this file directly: raw text -> extractor sections -> match
    from app.extractors.sections import split_sections

    sample_resume = """
    JUAN DELA CRUZ
    Baliuag, Bulacan

    EXPERIENCE
    Cashier — Kabayan Mart
    Baliuag, Bulacan
    March 2022 – Present
    - Processed cash and cashless payments and issued receipts
    - Balanced the cash drawer at end of shift

    EDUCATION
    Baliuag National High School
    High School Graduate

    SKILLS
    Cash handling
    POS system
    Customer service
    """

    sample_job = {
        "skills": "Cash handling\nPOS system operation\nCustomer service\nIssuing receipts",
        "experience": "Cashier\nProcess cash and cashless payments\nBalance the cash drawer at end of shift",
        "min_years": 1,
    }

    result = matching(split_sections(sample_resume), sample_job)
    print(f"Match score: {result:.4f}  ({result * 100:.2f}%)")