from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.cleaners.text import normalize_whitespace
from app.standardizers.resume import standardize_text
from app.validators.file_validator import validate_file
from app.validators.pdf import validate_pdf
from app.extractors.regex import extract_regex_entities
from app.extractors.sections import split_sections
from app.extractors.pdf_text import extract_page_text
from app.matchers.matching import matching_details


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the SBERT model once at startup so the first match request isn't slow.
    # If it fails (missing model / no internet) the app still starts; it will retry on the first match.
    try:
        from app.matchers.algorithm import _get_model
        await run_in_threadpool(_get_model)
    except Exception as error:
        print(f"Warning: SBERT model was not preloaded ({error}).")
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/")
def root():
    return {
        "message": "VERA Resume Processing Service"
    }


@app.get("/health")
def health():
    return {
        "Status": "Healthy"
    }


@app.post("/process-resume")
async def process_resume(file: UploadFile = File(...)):

    # --------------------------------
    # FILE READER
    # --------------------------------

    file_data = await file.read()


    # --------------------------------
    # BASIC FILE VALIDATION
    # --------------------------------

    is_valid, message = validate_file(
        file.filename,
        file_data
    )

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=message
        )


    # --------------------------------
    # PDF VALIDATION
    # --------------------------------

    try:
        pdf = validate_pdf(file_data)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


    # --------------------------------
    # TEXT EXTRACTION
    # --------------------------------

    pages = []

    for page in pdf:
        text = extract_page_text(page)   # column-aware: was page.get_text()
        pages.append(text)


    # Merge pages
    raw_text = "\n".join(pages)


    # --------------------------------
    # CONTENT VALIDATION
    # --------------------------------

    if not raw_text.strip():
        pdf.close()

        raise HTTPException(
            status_code=400,
            detail="PDF is readable as a file, but no extractable text was found."
        )


    meaningful_characters = sum(
        character.isalnum()
        for character in raw_text
    )

    if meaningful_characters == 0:
        pdf.close()

        raise HTTPException(
            status_code=400,
            detail="PDF is readable as a file, but no meaningful text was found."
        )


    # --------------------------------
    # CLEANING
    # --------------------------------

    cleaned_text = normalize_whitespace(raw_text)

    # --------------------------------
    # Email, phone, and dates extractors
    # --------------------------------

    regex_entities = extract_regex_entities(cleaned_text)

    # --------------------------------
    # STANDARDIZATION
    # --------------------------------

    standardized_text = standardize_text(cleaned_text)

    # --------------------------------
    # SECTION EXTRACTION
    # --------------------------------

    sections = split_sections(standardized_text)

    experience_section = sections.get("experience", "")
    skills_section = sections.get("skills", "")


    pdf.close()


    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "page_count": len(pages),
        "standardized_text": standardized_text,
        "regex_entities": regex_entities,
        "experience": experience_section,
        "skills": skills_section
    }


@app.post("/match-resume")
async def match_resume(
    file: UploadFile = File(...),
    job_skills: str = Form(...),          # one skill per line (or comma separated)
    job_experience: str = Form(...),      # job title on the first line, then the duties, one per line
    min_years: int = Form(0, ge=0),
    skills_weight: float = Form(0.5, ge=0),
    experience_weight: float = Form(0.5, ge=0),
):
    if not (job_skills.strip() or job_experience.strip()):
        raise HTTPException(
            status_code=400,
            detail="Provide the job's skills and/or experience text."
        )

    # --------------------------------
    # Same pipeline as /process-resume (validation, extraction, cleaning, standardization)
    # --------------------------------

    processed = await process_resume(file)

    # --------------------------------
    # SECTIONS  (his split_sections)
    # --------------------------------

    sections = split_sections(processed["standardized_text"])

    # --------------------------------
    # MATCHING  (SBERT is CPU-heavy, so keep it off the event loop)
    # --------------------------------

    job = {
        "skills": job_skills,
        "experience": job_experience,
        "min_years": min_years,
        "weights": {"skills": skills_weight, "experience": experience_weight},
    }

    details = await run_in_threadpool(matching_details, sections, job)

    return {
        "filename": processed["filename"],
        "match_score": round(details["final"] * 100, 1),                       # 0 - 100
        "scores": {k: round(v * 100, 1) for k, v in details["scores"].items()},
        "years_worked": details["experience"]["years"],
        "warnings": details["warnings"],
        "sections_found": sorted(sections),
        "skill_matches": details["skill_matches"],
        "experience_matches": details["experience"]["matches"],
        "regex_entities": processed["regex_entities"],
    }