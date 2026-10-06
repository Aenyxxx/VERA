"""POST /extract (TRD §8): PDF -> sections, years, auto-filled profile, camelCase."""
import fitz
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

RESUME_LINES = [
    "JUAN DELA CRUZ",
    "Blk 5 Lot 3, Brgy. San Jose, Baliuag, Bulacan",
    "Email: juan@example.com",
    "Mobile: 0917-123-4567",
    "Date of Birth: July 10, 2002",
    "Gender: Male",
    "Height: 5'8\"",
    "EXPERIENCE",
    "Cashier - Kabayan Mart",
    "March 2022 - Present",
    "- Processed cash and cashless payments and issued receipts",
    "EDUCATION",
    "Baliuag National High School",
    "High School Graduate",
    "SKILLS",
    "Cash handling, POS system, MS Office",
]


def make_pdf(lines=RESUME_LINES) -> bytes:
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "\n".join(lines), fontsize=10)
    data = pdf.tobytes()
    pdf.close()
    return data


def post(data: bytes, headers, filename="resume.pdf", content_type="application/pdf"):
    return client.post("/extract", files={"file": (filename, data, content_type)}, headers=headers)


def test_extract_returns_sections_years_and_profile(auth_headers):
    response = post(make_pdf(), auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {
        "pageCount", "rawText", "standardizedText", "sections", "skillsText", "experienceText",
        "yearsExperience", "profile", "warnings", "extractorVersion",
    }
    assert body["pageCount"] == 1
    assert {"experience", "education", "skills"} <= set(body["sections"])
    assert "Cash handling" in body["skillsText"]
    assert "Cashier" in body["experienceText"]
    assert body["yearsExperience"] >= 4                       # March 2022 - Present
    assert body["warnings"] == []

    profile = body["profile"]
    assert profile["lastName"] == "DELA CRUZ"
    assert profile["birthdate"] == "2002-07-10"
    assert profile["gender"] == "male"
    assert profile["heightCm"] == 172.7
    assert profile["addressLine"] == "Blk 5 Lot 3, Brgy. San Jose"
    assert profile["city"] == "Baliuag"
    assert profile["province"] == "Bulacan"
    assert profile["educationLevel"] == "senior_high"          # "MS Office" in skills is not a master's


def test_extract_warns_when_experience_has_no_dates(auth_headers):
    response = post(make_pdf(["ANA REYES", "EXPERIENCE", "Cashier", "SKILLS", "Cash handling"]), auth_headers)
    assert response.json()["warnings"] == ["no dates found in experience (years counted as 0)"]
    assert response.json()["yearsExperience"] == 0


def test_extract_rejects_a_non_pdf(auth_headers):
    response = post(b"just text", auth_headers, filename="resume.txt", content_type="text/plain")
    assert response.status_code == 400


def test_extract_rejects_a_pdf_without_text(auth_headers):
    pdf = fitz.open()
    pdf.new_page()
    response = post(pdf.tobytes(), auth_headers)
    pdf.close()
    assert response.status_code == 400
    assert "text" in response.json()["detail"].lower()


def test_extract_requires_the_internal_key():
    assert post(make_pdf(), {}).status_code == 401
