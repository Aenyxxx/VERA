"""TC-69: docs/ALGORITHM.md §6 worked example (COS-02, MAT-01..05) with injected similarity values.
Decision 27 (Oct 19): credit = raw cosine (LOW, HIGH = 0, 1); missing skills = best similarity <= 0.35 (display only)."""
import pytest

from app.matchers import algorithm
from app.matchers.algorithm import (
    experience_score,
    prepare_resume,
    ramp,
    round2,
    run_algorithm,
    skills_score,
)
from tests.conftest import _RECEIPTS_BULLET, WORKED_JOB, WORKED_SECTIONS, WORKED_TODAY

EXPERIENCED = {"skills": 0.5, "experience": 0.5}
FIRST_TIME = {"skills": 1, "experience": 0}


def run(weights):
    return run_algorithm(WORKED_SECTIONS, {**WORKED_JOB, "weights": weights}, WORKED_TODAY)


# ------------------------------------------------------------------ COS-02 ramp
# Decision 27 (Oct 19): LOW, HIGH = 0, 1 -> the credit is the raw cosine similarity; a negative cosine gives 0.
@pytest.mark.parametrize("similarity, credit", [(-0.20, 0.0), (0.0, 0.0), (0.35, 0.35), (0.50, 0.5), (0.92, 0.92), (1.0, 1.0)])
def test_ramp_credit_is_the_raw_cosine(similarity, credit):
    assert ramp(similarity) == pytest.approx(credit)


# ------------------------------------------------------------------ MAT-01 chunking
def test_skill_evidence_is_the_skills_section_only():                        # decision 26
    prep = prepare_resume(WORKED_SECTIONS, WORKED_TODAY)

    assert prep["skill_lines"] == ["Cash handling", "POS system", "Customer service", "Receipt issuing"]
    assert _RECEIPTS_BULLET not in prep["skill_lines"]                         # duty bullets are not skill evidence
    assert _RECEIPTS_BULLET in prep["exp_lines"]                               # ... they stay experience lines
    assert "January 2026 – June 2026" not in prep["exp_lines"]                 # date lines are dropped
    assert "Cashier" in prep["exp_lines"]                                      # 'Title — Company' is split
    assert prep["years"] == 0.5


def test_a_skill_found_only_in_a_duty_bullet_gets_no_credit(fake_similarity):  # decision 26
    # The bullet scores 0.90 against "Issuing receipts" but is never compared for skills.
    without_receipts = {**WORKED_SECTIONS, "skills": "Cash handling\nPOS system\nCustomer service"}
    score, matches = skills_score(prepare_resume(without_receipts, WORKED_TODAY), WORKED_JOB)
    assert [m["credit"] for m in matches] == [0.92, 0.71, 0.88, 0.0]
    assert matches[3]["found"] != _RECEIPTS_BULLET
    assert score == pytest.approx((0.92 + 0.71 + 0.88 + 0) / 4)

    # With the skill listed, its Skills-section line is the evidence (0.50), not the 0.90 bullet.
    _, matches = skills_score(prepare_resume(WORKED_SECTIONS, WORKED_TODAY), WORKED_JOB)
    assert matches[3] == {"required": "Issuing receipts", "found": "Receipt issuing", "similarity": 0.5, "credit": 0.5}


def test_prepare_resume_drops_duplicates_case_insensitively():
    prep = prepare_resume({"skills": "Customer service, customer SERVICE\nCash handling"})
    assert prep["skill_lines"] == ["Customer service", "Cash handling"]


def test_prepare_resume_warns_about_missing_sections():
    assert prepare_resume({})["warnings"] == [
        "no skills section found: the whole resume was used for skills",
        "no experience section found: the whole resume was used for experience",
    ]


# ------------------------------------------------------------------ MAT-01 fallback per section (decision 12)
_DUTY = "Balanced the cash drawer at end of shift"


def test_detected_sections_are_used_as_is():
    prep = prepare_resume({**WORKED_SECTIONS, "summary": "Forklift operation, welding"}, WORKED_TODAY)
    assert prep["skill_lines"] == ["Cash handling", "POS system", "Customer service", "Receipt issuing"]
    # neither the summary nor the experience bullets are read for skills
    assert prep["exp_lines"] == ["Cashier", "Kabayan Mart", "Baliuag, Bulacan", _RECEIPTS_BULLET, _DUTY]
    assert prep["warnings"] == []


def test_missing_skills_section_uses_the_whole_resume_for_skills(fake_similarity):
    sections = {"summary": "Cash handling, POS system, Customer service", "experience": WORKED_SECTIONS["experience"]}
    prep = prepare_resume(sections, WORKED_TODAY)

    assert prep["skill_lines"][:3] == ["Cash handling", "POS system", "Customer service"]  # from the summary
    assert _RECEIPTS_BULLET in prep["skill_lines"]                             # every whole-resume line is skill input
    assert prep["exp_lines"] == prepare_resume(WORKED_SECTIONS, WORKED_TODAY)["exp_lines"]  # experience as is
    assert prep["warnings"] == ["no skills section found: the whole resume was used for skills"]

    score, matches = skills_score(prep, WORKED_JOB)
    assert matches[3]["found"] == _RECEIPTS_BULLET                             # the fallback reads the duty line (0.90)
    assert [m["credit"] for m in matches] == [0.92, 0.71, 0.88, 0.9]
    assert score == pytest.approx((0.92 + 0.71 + 0.88 + 0.90) / 4)


def test_missing_experience_section_uses_the_whole_resume_for_experience(fake_similarity):
    sections = {"skills": WORKED_SECTIONS["skills"], "summary": f"Cashier\n{_DUTY}"}
    prep = prepare_resume(sections, WORKED_TODAY)

    assert prep["skill_lines"] == ["Cash handling", "POS system", "Customer service", "Receipt issuing"]  # skills as is
    assert prep["exp_lines"] == ["Cash handling", "POS system", "Customer service", "Receipt issuing", "Cashier", _DUTY]
    assert prep["years"] == 0                                                  # years only from a detected section
    assert prep["warnings"] == ["no experience section found: the whole resume was used for experience"]

    score, info = experience_score(prep, WORKED_JOB)
    assert [m["credit"] for m in info["matches"]] == [0.8, 0.0, 0.55]          # Cashier 0.80, none, drawer 0.55
    assert score == pytest.approx((0.80 + 0 + 0.55) / 3)


def test_both_sections_missing_use_the_whole_resume_for_both(fake_similarity):
    prep = prepare_resume({"summary": f"Cash handling, Customer service\nCashier\n{_DUTY}"}, WORKED_TODAY)
    assert prep["skill_lines"] == ["Cash handling", "Customer service", "Cashier", _DUTY]
    assert prep["exp_lines"] == ["Cash handling, Customer service", "Cashier", _DUTY]
    assert len(prep["warnings"]) == 2

    result = run_algorithm({"summary": f"Cash handling, Customer service\nCashier\n{_DUTY}"},
                           {**WORKED_JOB, "weights": EXPERIENCED}, WORKED_TODAY)
    assert result["scores"]["skills"] == pytest.approx((0.92 + 0 + 0.88 + 0) / 4)  # Cash handling + Customer service
    assert result["scores"]["experience"] == pytest.approx((0.80 + 0 + 0.55) / 3)
    assert result["match_score"] == 45.0                                       # 100 × (0.5 × 0.45 + 0.5 × 0.45)


# ------------------------------------------------------------------ MAT-02 / MAT-03 / MAT-04
def test_skills_score_is_0_7525(fake_similarity):
    score, matches = skills_score(prepare_resume(WORKED_SECTIONS, WORKED_TODAY), WORKED_JOB)
    assert score == pytest.approx(0.7525)                                      # (0.92 + 0.71 + 0.88 + 0.50) / 4
    assert [m["credit"] for m in matches] == [0.92, 0.71, 0.88, 0.5]


def test_experience_score_is_the_relevance_0_67(fake_similarity):
    score, info = experience_score(prepare_resume(WORKED_SECTIONS, WORKED_TODAY), WORKED_JOB)
    assert info["relevance"] == pytest.approx(0.67)
    assert score == info["relevance"]                                          # decision 11: S_exp = R
    assert [m["credit"] for m in info["matches"]] == [0.8, 0.66, 0.55]         # (0.80 + 0.66 + 0.55) / 3
    assert info["years"] == 0.5                                                # shown only
    assert set(info) == {"years", "relevance", "matches"}                      # no years_needed / years_score


def test_experienced_applicant_scores_71_13(fake_similarity):
    result = run(EXPERIENCED)
    assert 100 * result["final"] == 71.125                                     # 100 × (0.5 × 0.7525 + 0.5 × 0.67): an exact tie
    assert result["match_score"] == 71.13                                      # half-up, like the API (not 71.12, ties to even)
    assert result["scores_100"] == {"skills": 75.25, "experience": 67.0}


# ------------------------------------------------------------------ MAT-04 rounding: half-up like the API (domain/round.js)
@pytest.mark.parametrize("value, rounded", [(71.125, 71.13), (39.995, 40.0), (0.005, 0.01), (75.25, 75.25), (64.875, 64.88), (99.994, 99.99)])
def test_round2_is_half_up_on_the_decimal_value(value, rounded):
    assert round2(value) == rounded


def test_round2_fixes_the_ties_python_round_gets_wrong():
    assert (round(71.125, 2), round2(71.125)) == (71.12, 71.13)               # ties to even vs half-up
    assert (round(39.995, 2), round2(39.995)) == (39.99, 40.0)                # binary 39.99499… vs the decimal 39.995


def test_first_time_job_seeker_scores_75_25_skills_only(fake_similarity):
    result = run(FIRST_TIME)
    assert result["match_score"] == 75.25
    assert result["weights"] == {"skills": 1.0, "experience": 0.0}


def test_years_worked_never_change_the_score(fake_similarity):
    longer = {**WORKED_SECTIONS, "experience": WORKED_SECTIONS["experience"].replace("January 2026", "January 2020")}
    short_score, short_info = experience_score(prepare_resume(WORKED_SECTIONS, WORKED_TODAY), WORKED_JOB)
    long_score, long_info = experience_score(prepare_resume(longer, WORKED_TODAY), WORKED_JOB)
    assert (short_info["years"], long_info["years"]) == (0.5, 6.5)
    assert long_score == short_score == pytest.approx(0.67)


def test_a_min_years_key_from_an_old_caller_is_ignored(fake_similarity):
    plain = run_algorithm(WORKED_SECTIONS, {**WORKED_JOB, "weights": EXPERIENCED}, WORKED_TODAY)
    old = run_algorithm(WORKED_SECTIONS, {**WORKED_JOB, "min_years": 3, "weights": EXPERIENCED}, WORKED_TODAY)
    assert plain["match_score"] == old["match_score"] == 71.13


# ------------------------------------------------------------------ MAT-05 explainability
def test_matched_and_missing_skills(fake_similarity):
    job = {**WORKED_JOB, "skills": WORKED_JOB["skills"] + "\nForklift operation", "weights": EXPERIENCED}
    result = run_algorithm(WORKED_SECTIONS, job, WORKED_TODAY)

    assert result["matched_skills"] == ["Cash handling", "POS system operation", "Customer service", "Issuing receipts"]
    assert result["missing_skills"] == ["Forklift operation"]


def test_explain_splits_on_the_shown_similarity_at_0_35():                   # decision 27: display only
    matches = [
        {"required": "A", "similarity": 0.351, "credit": 0.351},
        {"required": "B", "similarity": 0.35, "credit": 0.35},
        {"required": "C", "similarity": 0.0, "credit": 0.0},
    ]
    assert algorithm.MISSING_SIMILARITY == 0.35
    assert algorithm.explain(matches) == {"matched": ["A"], "missing": ["B", "C"]}


def test_a_missing_skill_still_earns_its_credit(fake_similarity, monkeypatch):  # decision 27: never in the score
    monkeypatch.setitem(fake_similarity, ("Forklift operation", "Cash handling"), 0.30)
    job = {**WORKED_JOB, "skills": WORKED_JOB["skills"] + "\nForklift operation", "weights": FIRST_TIME}
    result = run_algorithm(WORKED_SECTIONS, job, WORKED_TODAY)

    assert result["skill_matches"][4] == {"required": "Forklift operation", "found": "Cash handling", "similarity": 0.3, "credit": 0.3}
    assert result["missing_skills"] == ["Forklift operation"]                  # listed as missing (0.30 <= 0.35) ...
    assert result["scores"]["skills"] == pytest.approx((0.92 + 0.71 + 0.88 + 0.50 + 0.30) / 5)  # ... and still scored
