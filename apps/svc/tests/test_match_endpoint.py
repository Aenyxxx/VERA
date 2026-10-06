"""POST /match (TRD §8) with the §6 worked example injected in place of SBERT (TC-69 through the API)."""
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import WORKED_JOB, WORKED_SECTIONS

client = TestClient(app)


def body(weights, job=None):
    job = job or WORKED_JOB
    return {
        "resume": {"sections": WORKED_SECTIONS},
        "job": {"skills": job["skills"], "experience": job["experience"], "minYears": job["min_years"]},
        "weights": weights,
    }


def test_experienced_applicant(auth_headers, fake_similarity, monkeypatch):
    monkeypatch.delenv("SBERT_MODEL", raising=False)
    response = client.post("/match", json=body({"skills": 0.5, "experience": 0.5}), headers=auth_headers)

    assert response.status_code == 200
    result = response.json()
    assert result["matchScore"] == 79.31
    assert result["scores"] == {"skills": 87.5, "experience": 71.11}
    assert result["yearsWorked"] == 0.5
    assert result["matchedSkills"] == ["Cash handling", "POS system operation", "Customer service", "Issuing receipts"]
    assert result["missingSkills"] == []
    assert result["skillMatches"][3] == {
        "required": "Issuing receipts",
        "found": "Processed cash and cashless payments and issued receipts",
        "similarity": 0.5,
        "credit": 0.5,
    }
    assert len(result["experienceMatches"]) == 3
    assert result["modelName"] == "all-MiniLM-L6-v2"


def test_first_time_job_seeker(auth_headers, fake_similarity):
    response = client.post("/match", json=body({"skills": 1, "experience": 0}), headers=auth_headers)
    assert response.json()["matchScore"] == 87.5


def test_missing_skill_is_reported(auth_headers, fake_similarity):
    job = {**WORKED_JOB, "skills": WORKED_JOB["skills"] + "\nForklift operation"}
    response = client.post("/match", json=body({"skills": 1, "experience": 0}, job), headers=auth_headers)
    assert response.json()["missingSkills"] == ["Forklift operation"]


def test_model_name_comes_from_sbert_model_env(auth_headers, fake_similarity, monkeypatch):
    monkeypatch.setenv("SBERT_MODEL", "paraphrase-MiniLM-L3-v2")
    response = client.post("/match", json=body({"skills": 1, "experience": 0}), headers=auth_headers)
    assert response.json()["modelName"] == "paraphrase-MiniLM-L3-v2"


def test_zero_weights_are_rejected(auth_headers):
    response = client.post("/match", json=body({"skills": 0, "experience": 0}), headers=auth_headers)
    assert response.status_code == 422


def test_negative_minimum_years_are_rejected(auth_headers):
    payload = body({"skills": 1, "experience": 0})
    payload["job"]["minYears"] = -1
    assert client.post("/match", json=payload, headers=auth_headers).status_code == 422


def test_job_without_requirements_is_rejected(auth_headers):
    payload = body({"skills": 1, "experience": 0})
    payload["job"] = {"skills": " ", "experience": "", "minYears": 0}
    assert client.post("/match", json=payload, headers=auth_headers).status_code == 422


def test_match_requires_the_internal_key():
    assert client.post("/match", json=body({"skills": 1, "experience": 0})).status_code == 401
