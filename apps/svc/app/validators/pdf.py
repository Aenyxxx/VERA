import fitz


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