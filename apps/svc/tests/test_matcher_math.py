"""TC-69: docs/ALGORITHM.md §6 worked example (COS-02, MAT-01..05) with injected similarity values."""
import pytest

from app.matchers import algorithm
from app.matchers.algorithm import (
    BULLET_DISCOUNT,
    experience_score,
    prepare_resume,
    ramp,
    run_algorithm,
    skills_score,
)
from tests.conftest import WORKED_JOB, WORKED_SECTIONS, WORKED_TODAY

EXPERIENCED = {"skills": 0.5, "experience": 0.5}
FIRST_TIME = {"skills": 1, "experience": 0}


def run(weights):
    return run_algorithm(WORKED_SECTIONS, {**WORKED_JOB, "weights": weights}, WORKED_TODAY)


# ------------------------------------------------------------------ COS-02 ramp
@pytest.mark.parametrize("similarity, credit", [(0.20, 0.0), (0.35, 0.0), (0.50, 0.5), (0.65, 1.0), (0.92, 1.0)])
def test_ramp_maps_similarity_to_credit(similarity, credit):
    assert ramp(similarity) == pytest.approx(credit)


# ------------------------------------------------------------------ MAT-01 chunking
def test_prepare_resume_weights_skills_and_duty_bullets():
    prep = prepare_resume(WORKED_SECTIONS, WORKED_TODAY)
    evidence = dict(prep["skill_evidence"])

    assert evidence["Cash handling"] == 1.0                                    # skills section
    assert evidence["Processed cash and cashless payments and issued receipts"] == BULLET_DISCOUNT
    assert "January 2026 – June 2026" not in prep["exp_lines"]                 # date lines are dropped
    assert "Cashier" in prep["exp_lines"]                                      # 'Title — Company' is split
    assert prep["years"] == 0.5


def test_prepare_resume_drops_duplicates_case_insensitively():
    prep = prepare_resume({"skills": "Customer service, customer SERVICE\nCash handling"})
    assert [text for text, _ in prep["skill_evidence"]] == ["Customer service", "Cash handling"]


def test_prepare_resume_warns_about_missing_sections():
    assert prepare_resume({})["warnings"] == ["no skills section found", "no experience section found"]


# ------------------------------------------------------------------ MAT-02 / MAT-03 / MAT-04
def test_skills_score_is_0_875(fake_similarity):
    score, matches = skills_score(prepare_resume(WORKED_SECTIONS, WORKED_TODAY), WORKED_JOB)
    assert score == pytest.approx(0.875)
    assert [m["credit"] for m in matches] == [1.0, 1.0, 1.0, 0.5]


def test_experience_score_is_0_7111(fake_similarity):
    score, info = experience_score(prepare_resume(WORKED_SECTIONS, WORKED_TODAY), WORKED_JOB)
    assert info["relevance"] == pytest.approx(0.8889, abs=1e-4)
    assert info["years"] == 0.5 and info["years_score"] == 0.5
    assert score == pytest.approx(0.7111, abs=1e-4)


def test_experienced_applicant_scores_79_31(fake_similarity):
    result = run(EXPERIENCED)
    assert result["match_score"] == 79.31
    assert result["scores_100"] == {"skills": 87.5, "experience": 71.11}


def test_first_time_job_seeker_scores_87_50_skills_only(fake_similarity):
    result = run(FIRST_TIME)
    assert result["match_score"] == 87.50
    assert result["weights"] == {"skills": 1.0, "experience": 0.0}


def test_no_minimum_years_uses_relevance_only(fake_similarity):
    _, info = experience_score(prepare_resume(WORKED_SECTIONS, WORKED_TODAY), {**WORKED_JOB, "min_years": 0})
    assert info["years_score"] is None


# ------------------------------------------------------------------ MAT-05 explainability
def test_matched_and_missing_skills(fake_similarity):
    job = {**WORKED_JOB, "skills": WORKED_JOB["skills"] + "\nForklift operation", "weights": EXPERIENCED}
    result = run_algorithm(WORKED_SECTIONS, job, WORKED_TODAY)

    assert result["matched_skills"] == ["Cash handling", "POS system operation", "Customer service", "Issuing receipts"]
    assert result["missing_skills"] == ["Forklift operation"]


def test_explain_splits_on_credit():
    matches = [{"required": "A", "credit": 0.4}, {"required": "B", "credit": 0.0}]
    assert algorithm.explain(matches) == {"matched": ["A"], "missing": ["B"]}
