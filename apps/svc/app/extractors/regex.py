import re


EMAIL_PATTERN = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
PHONE_PATTERN = r"(?:\+63|0)\s?\d{3}[\s-]?\d{3}[\s-]?\d{4}"
DATE_PATTERN = (
    r"\b(?:"
    
    # Full month + year
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{4}"

    r"|"

    # Abbreviated month + year
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)"
    r"\s+\d{4}"

    r"|"

    # Numeric month/year
    r"\d{1,2}[/-]\d{4}"

    r"|"

    # Year range
    r"(?:19|20)\d{2}\s*[-–]\s*(?:19|20)\d{2}"

    r"|"

    # Standalone year
    r"(?<!\d)(?:19|20)\d{2}(?!\d)"

    r")\b"
)

#Email extractors
def extract_emails(text: str) -> list[str]:
    """
    Extract email addresses from cleaned resume text.
    """

    return re.findall(EMAIL_PATTERN, text)

#Phone number extractors
def extract_phone_numbers(text: str) -> list[str]:
    """
    Extract Philippine phone numbers from cleaned resume text.
    """

    return re.findall(PHONE_PATTERN, text)

#Date Extractors
def extract_dates(text: str) -> list[str]:
    """
    Extract common month/year date formats from resume text.
    """

    return re.findall(DATE_PATTERN, text)

def extract_regex_entities(text: str) -> dict:
    """
    Extract entities that can be identified using rules and regex.
    """

    return {
        "emails": extract_emails(text),
        "phone_numbers": extract_phone_numbers(text),
        "dates": extract_dates(text)
    }