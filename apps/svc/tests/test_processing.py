from fastapi.testclient import TestClient

from app.cleaners.text import clean_text
from app.standardizers.resume import standardize_text

from app.main import app

import fitz

client = TestClient(app)


def test_clean_text_removes_extra_spaces():
    text = "  Python    Developer  "

    result = clean_text(text)

    assert result == "Python Developer"


def test_clean_text_joins_wrapped_lines():
    text = """creating
reliable and user-friendly systems."""

    result = clean_text(text)

    assert result == "creating reliable and user-friendly systems."


def test_standardize_python_variants():
    text = "python Python PYTHON"

    result = standardize_text(text)

    assert result == "Python Python Python"


def test_standardize_node_variants():
    text = "node js nodejs Node.js"

    result = standardize_text(text)

    assert result == "Node.js Node.js Node.js"

def test_process_resume_valid_pdf():
    pdf = fitz.open()

    page = pdf.new_page()

    page.insert_text(
        (72, 72),
        "John Dela Cruz\nPython Developer\nSkills: Python, JavaScript"
    )

    pdf_bytes = pdf.tobytes()

    pdf.close()

    response = client.post(
        "/process-resume",
        files={
            "file": (
                "resume.pdf",
                pdf_bytes,
                "application/pdf"
            )
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["filename"] == "resume.pdf"
    assert data["page_count"] == 1
    assert "John Dela Cruz" in data["raw_text"]
    assert "Python Developer" in data["cleaned_text"]