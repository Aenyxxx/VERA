from __future__ import annotations

import datetime as dt

from app.matchers.algorithm import run_algorithm


def matching_details(sections: dict, job: dict, today: dt.date | None = None) -> dict:
    """Full breakdown: scores, matched skills, years worked, education status, warnings."""
    return run_algorithm(sections, job, today)


def matching(sections: dict, job: dict, today: dt.date | None = None) -> float:
    """
    Compute a normalized match score between a resume and a job.

    Args:
        sections (dict): The resume sections from the extractors (split_sections output).
        job (dict): Job with "skills" and "experience" text, optional "min_years",
            "min_education" and "weights" (see algorithm.py).

    Returns:
        float: Normalized score between 0.0 and 1.0.
    """
    score = run_algorithm(sections, job, today)["final"]

    # Safety net: keep output normalized no matter what algorithm.py does
    return max(0.0, min(1.0, float(score)))


def rank_resumes(resumes: dict[str, dict], job: dict, apply_filter: bool = True,
                 today: dt.date | None = None) -> dict:
    """
    resumes: {name or id: sections}.
    Returns {"ranked": [(name, details)] best first, "filtered_out": [(name, details)]}.
    The HR education filter removes only candidates whose detected level is below min_education.
    """
    results = [(name, run_algorithm(sections, job, today)) for name, sections in resumes.items()]
    failed = [r for r in results if apply_filter and r[1]["education"]["status"] == "fail"]
    kept = [r for r in results if r not in failed]
    return {"ranked": sorted(kept, key=lambda r: -r[1]["final"]), "filtered_out": failed}


def print_report(title: str, ranking: dict, details: bool = True) -> None:
    """Readable output. Use it to check the similarity numbers when tuning LOW / HIGH in algorithm.py."""
    print("=" * 78)
    print(title)
    print("=" * 78)
    for i, (name, r) in enumerate(ranking["ranked"], 1):
        s, x, e = r["scores"], r["experience"], r["education"]
        print(f"{i}. {name:<44} FINAL {100 * r['final']:5.1f}   "
              f"skills {s['skills']:.2f} | experience {s['experience']:.2f}")
        if not details:
            continue
        print(f"     years worked: {x['years']} (job wants {x['years_needed']})   "
              f"education: {e['level_name']} ({e['status']})")
        for w in r["warnings"]:
            print(f"     ! {w}")
        for label, rows in (("skill", r["skill_matches"]), ("exp  ", x["matches"])):
            for m in rows:
                mark = "OK " if m["credit"] >= 1 else ("~  " if m["credit"] > 0 else "-- ")
                print(f"     {label} {mark}{m['required'][:30]:<30} <- {m['found'][:40]:<40} {m['similarity']:.2f}")
        print()
    for name, r in ranking["filtered_out"]:
        print(f"-  {name:<44} removed by education filter ({r['education']['level_name']})")
    print()


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
        "min_education": "High School Graduate",
    }

    result = matching(split_sections(sample_resume), sample_job)
    print(f"Match score: {result:.4f}  ({result * 100:.2f}%)")
