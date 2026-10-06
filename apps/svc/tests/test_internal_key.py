import fitz
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def make_pdf() -> bytes:
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "Juan Santos\nCashier\nSkills: Customer service")
    data = pdf.tobytes()
    pdf.close()
    return data


def post_resume(headers=None):
    return client.post(
        "/extract",
        files={"file": ("resume.pdf", make_pdf(), "application/pdf")},
        headers=headers or {},
    )


def test_health_is_open():
    response = client.get("/health")

    assert response.status_code == 200


def test_missing_key_is_rejected():
    response = post_resume()

    assert response.status_code == 401


def test_wrong_key_is_rejected():
    response = post_resume({"X-Internal-Key": "wrong-key"})

    assert response.status_code == 401


def test_correct_key_is_accepted(auth_headers):
    response = post_resume(auth_headers)

    assert response.status_code == 200


def test_match_requires_key():
    response = client.post(
        "/match",
        json={
            "resume": {"sections": {"skills": "Customer service"}},
            "job": {"skills": "Customer service", "experience": "Cashier", "minYears": 0},
            "weights": {"skills": 1, "experience": 0},
        },
    )

    assert response.status_code == 401


def test_unconfigured_key_fails_closed(monkeypatch, auth_headers):
    monkeypatch.delenv("SVC_INTERNAL_KEY", raising=False)

    response = post_resume(auth_headers)

    assert response.status_code == 503
