from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, HTTPException
import fitz

from app.cleaners.text import clean_text

from app.standardizers.resume import standardize_text

app = FastAPI()


@app.get("/")
def root():
    return {
        "message":"VERA Resume Processing Service"
    }

@app.get("/health")
def health():
    return{
        "Status": "Healthy"
    }

@app.post("/process-resume")
async def process_resume(file: UploadFile = File(...)):

    #File Reader
    file_data = await file.read()

    #File Checker if it is an actual PDF
    if not file_data.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is not a valid PDF."
        )

    try:
        pdf = fitz.open(stream=file_data, filetype="pdf")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Unable to read the uploaded PDF."
        )

    pages = []

    for page in pdf:
        text = page.get_text()
        pages.append(text)

    # Merge of pages
    raw_text = "\n".join(pages)

    #Cleaning the raw text the code is in the cleaners
    cleaned_text = clean_text(raw_text)

    #Standardized the Cleaned text the code is in the standardizers
    standardized_text = standardize_text(cleaned_text)

    pdf.close()

    #Checker if the resume is readable
    if not raw_text.strip():
        raise HTTPException(
            status_code=400,
            detail="PDF is readable as a file, but no extractable text was found."
        )

    meaningful_characters = sum(
        character.isalnum()
        for character in raw_text
    )

    if meaningful_characters == 0:
        raise HTTPException(
            status_code=400,
            detail="PDF is readable as a file, but no meaningful text was found."
        )
    return {
        "filename":file.filename,
        "content_type":file.content_type,
        "page_count":len(pages),
        "raw_text":raw_text,
        "cleaned_text": cleaned_text,
        "standardized_text":standardized_text
    }

