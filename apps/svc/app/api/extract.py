"""POST /extract — PDF -> text, sections, skills/experience, years, and the auto-filled profile (TRD §8)."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import require_internal_key
from app.cleaners.text import normalize_whitespace
from app.extractors.pdf_text import extract_page_text
from app.extractors.profile import build_profile
from app.extractors.sections import split_sections
from app.matchers.algorithm import prepare_resume
from app.standardizers.resume import standardize_text
from app.validators.file_validator import validate_file
from app.validators.pdf import validate_pdf

EXTRACTOR_VERSION = "1.0.0"

router = APIRouter(dependencies=[Depends(require_internal_key)])


def _read_pdf_text(filename: str, data: bytes) -> tuple[str, int]:
    """EXT-01: validate the upload and extract text page by page. Raises 400 with a readable message."""
    is_valid, message = validate_file(filename, data)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    try:
        pdf = validate_pdf(data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    try:
        pages = [extract_page_text(page) for page in pdf]
    finally:
        pdf.close()

    raw_text = "\n".join(pages)
    if not any(character.isalnum() for character in raw_text):
        raise HTTPException(
            status_code=400,
            detail="This PDF has no selectable text. Upload a text-based PDF (not a scanned image).",
        )
    return raw_text, len(pages)


@router.post("/extract")
async def extract(file: UploadFile = File(...)):
    raw_text, page_count = _read_pdf_text(file.filename, await file.read())

    cleaned = normalize_whitespace(raw_text)                         # EXT-02
    standardized = standardize_text(cleaned)                         # EXT-02
    sections = split_sections(standardized)                          # EXT-03
    prep = prepare_resume(sections)                                  # MAT-01 (no model): years + warnings

    return {
        "pageCount": page_count,
        "rawText": raw_text,
        "standardizedText": standardized,
        "sections": sections,
        "skillsText": sections.get("skills", ""),
        "experienceText": sections.get("experience", ""),
        "yearsExperience": prep["years"],
        "profile": build_profile(cleaned, sections),                # EXT-04
        "warnings": prep["warnings"],
        "extractorVersion": EXTRACTOR_VERSION,
    }
