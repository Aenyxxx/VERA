from fastapi import FastAPI, UploadFile, File, HTTPException

from app.cleaners.text import normalize_whitespace
from app.standardizers.resume import standardize_text
from app.validators.file_validator import validate_file
from app.validators.pdf import validate_pdf
from app.extractors.regex import extract_regex_entities


app = FastAPI()


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
        text = page.get_text()
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


    pdf.close()


    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "page_count": len(pages),
        "standardized_text": standardized_text,
        "regex_entities": regex_entities,
    }