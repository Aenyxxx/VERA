import fitz


# VERA-ALGO[EXT-01] BEGIN PDF validation (signature + readable document)
# Reject files that do not start with %PDF- or cannot be opened by PyMuPDF.   Ref: docs/ALGORITHM.md §4 EXT-01
def validate_pdf(file_data: bytes):
    """
    Validate that the uploaded file is a readable PDF.

    Returns:
        pdf: Opened PyMuPDF document

    Raises:
        ValueError: If the file is not a valid or readable PDF.
    """
    
    # Check the PDF file signature
    if not file_data.startswith(b"%PDF-"):
        raise ValueError("Uploaded file is not a valid PDF.")

    # Try opening the PDF
    try:
        pdf = fitz.open(stream=file_data, filetype="pdf")
    except Exception:
        raise ValueError("Unable to read the uploaded PDF.")

    return pdf
# VERA-ALGO[EXT-01] END
