"""
Regex-based extraction module for personal and profile information.

Responsibility: Extract explicitly stated text from cleaned resume content.
Does NOT perform unit conversion, semantic interpretation, or cross-field inference.
"""

from __future__ import annotations

import re

# ==============================================================================
# REGEX PATTERNS
# ==============================================================================

_MONTHS_FULL = (
    r"January|February|March|April|May|June|July|August|September|October|November|December"
)
_MONTHS_ABBR = r"Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec"

# Full names are listed before abbreviations so "January" wins over "Jan".
_MONTH = r"(?:" + _MONTHS_FULL + r"|" + _MONTHS_ABBR + r")\.?"

# A place name: starts with a Unicode letter, then letters/spaces/dots/hyphens/
# apostrophes. Stops at a comma, semicolon, colon, pipe, digit, or line break,
# so a match can never run across lines.
_PLACE = r"[^\W\d_][^\n\r,;:|\d]*"

# Same idea, but lazy and also rejects "@" (used for the "City, Province" line).
_PLACE_STRICT = r"[^\W\d_][^\n\r,;:|\d@]*?"

EMAIL_PATTERN = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"

# Philippine mobile format. Digit boundaries stop matches inside longer digit
# runs; [ \t] (not \s) stops matches from spanning a line break.
PHONE_PATTERN = r"(?<!\d)(?:\+63|0)[ \t]?\d{3}[ \t-]?\d{3}[ \t-]?\d{4}(?!\d)"

DATE_PATTERN = (
    r"(?i)\b(?:"
    # Full month + year
    r"(?:" + _MONTHS_FULL + r")\s+\d{4}"
    r"|"
    # Abbreviated month (optional period) + year
    r"(?:" + _MONTHS_ABBR + r")\.?\s+\d{4}"
    r"|"
    # Numeric month/year (not the tail of a full dd/mm/yyyy date)
    r"(?<![\d/-])\d{1,2}[/-]\d{4}"
    r"|"
    # Year range
    r"(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}"
    r"|"
    # Standalone year
    r"(?<!\d)(?:19|20)\d{2}(?!\d)"
    r")\b"
)

BIRTHDATE_PATTERN = (
    r"(?i)\b(?:date\s+of\s+birth|birth\s*date|birthday|dob)\s*[:\-]?\s*("
    # July 10, 2002
    + _MONTH + r"\s+\d{1,2},?\s+\d{4}"
    # 10 July 2002
    + r"|\d{1,2}\s+" + _MONTH + r",?\s+\d{4}"
    # 07/10/2002
    + r"|\d{1,2}[/-]\d{1,2}[/-]\d{4}"
    + r")\b"
)

GENDER_PATTERN = (
    r"(?i)\b(?:gender|sex)[ \t]*[:\-]?[ \t]*"
    r"(Male|Female)\b"
)

HEIGHT_CM_PATTERN = (
    r"(?i)\bheight\s*[:\-]?\s*"
    r"(\d{2,3}(?:\.\d+)?\s*(?:cm|centimeters?))\b"
)

HEIGHT_IMPERIAL_PATTERN = (
    r"""(?i)\bheight\s*[:\-]?\s*(\d{1,2}\s*'(?:\s*\d{1,2}\s*")?)"""
)

# Jr/Sr/PhD are case-insensitive; roman numerals, MD and Esq. must be as written,
# so a name like "Md" or "Ivy" is never mistaken for a suffix.
SUFFIX_PATTERN = (
    r"\b((?i:jr|sr)\.?|III|II|IV|(?i:ph\.?d)\.?|MD|Esq\.?)(?=[\s,]|$)"
)

# Labeled fields only ("City: Manila"). A colon is required so that text like
# "Quezon City - Metro Manila" is not misread as a label.
CITY_PATTERN = r"(?i)\b(?:city|municipality)[ \t]*:[ \t]*(" + _PLACE + r")"

PROVINCE_PATTERN = r"(?i)\bprovince[ \t]*:[ \t]*(" + _PLACE + r")"

# One line shaped like "City, Province" (optionally labeled, optionally followed
# by the country). Applied line by line with re.match.
CITY_PROVINCE_COMBO_PATTERN = (
    r"(?i)(?:(?:address|location|residence)[ \t]*:[ \t]*)?"
    r"(" + _PLACE_STRICT + r")[ \t]*,[ \t]*(" + _PLACE_STRICT + r")"
    r"(?:[ \t]*,[ \t]*(?:Philippines|PH))?[ \t]*$"
)

# Lines that end the personal/contact header of a resume.
HEADER_STOP_PATTERN = (
    r"(?i)^(?:work\s+experience|experience|employment|work\s+certificate)"
)

# Lines at the top of a resume that are titles, not names.
NAME_SKIP_LINE_PATTERN = (
    r"(?i)^(?:r[eé]sum[eé]|curriculum\s+vitae|cv|profile|summary|objective"
    r"|personal\s+(?:information|details|data)"
    r"|contact(?:\s+(?:information|details))?)\s*:?$"
)

NAME_LABEL_PATTERN = r"(?i)^(?:full\s+)?name\s*[:\-]\s*"

# Unicode letters, with internal hyphens/apostrophes ("Anne-Marie", "O'Brien").
NAME_TOKEN_PATTERN = r"[^\W\d_]+(?:[-'’][^\W\d_]+)*"

# Lowercase particles that belong to the surname that follows them
# ("Dela Cruz", "de la Cruz", "San Jose", "Van Der ..."-style prefixes).
SURNAME_PARTICLES = {
    "de", "del", "dela", "delos", "la", "las", "los",
    "san", "santa", "sta", "sto", "van", "von", "da", "di",
}

_COUNTRY_ONLY = {"philippines", "ph"}


# ==============================================================================
# FIELD EXTRACTORS
# ==============================================================================

def extract_emails(text: str) -> list[str]:
    """Extract email addresses from cleaned resume text."""
    return re.findall(EMAIL_PATTERN, text)


def extract_phone_numbers(text: str) -> list[str]:
    """Extract Philippine phone numbers from cleaned resume text."""
    return re.findall(PHONE_PATTERN, text)


def extract_dates(text: str) -> list[str]:
    """Extract common month/year and year formats from resume text."""
    return re.findall(DATE_PATTERN, text)


def extract_birthdate(text: str) -> str | None:
    """Extract the candidate's birthdate when explicitly associated with a label."""
    match = re.search(BIRTHDATE_PATTERN, text)
    return match.group(1) if match else None


def extract_gender(text: str) -> str | None:
    """Extract gender when explicitly associated with a gender/sex label."""
    match = re.search(GENDER_PATTERN, text)
    return match.group(1) if match else None


def extract_height(text: str) -> list[str]:
    """Extract height measurements (cm or feet/inches) when associated with a height label."""
    cm_match = re.search(HEIGHT_CM_PATTERN, text)
    if cm_match:
        return [cm_match.group(1).strip()]

    imperial_match = re.search(HEIGHT_IMPERIAL_PATTERN, text)
    if imperial_match:
        return [imperial_match.group(1).strip()]

    return []


def _name_result(
    first: str = "", middle: str = "", last: str = "", suffix: str = ""
) -> dict:
    return {
        "first_name": first,
        "middle_name": middle,
        "last_name": last,
        "suffix": suffix,
    }


def _split_name_tokens(tokens: list[str]) -> tuple[str, str, str]:
    """Split name tokens into (first, middle, last), keeping surname particles together."""
    if len(tokens) == 1:
        return tokens[0], "", ""

    last_idx = len(tokens) - 1
    # Walk back over particles, but always leave at least one token for the first name.
    while last_idx > 1 and tokens[last_idx - 1].lower() in SURNAME_PARTICLES:
        last_idx -= 1

    return (
        tokens[0],
        " ".join(tokens[1:last_idx]),
        " ".join(tokens[last_idx:]),
    )


def extract_name(text: str) -> dict:
    """
    Extract first_name, middle_name, last_name, and suffix from the top lines of a resume.

    Inspects up to the first 5 non-empty lines while skipping lines containing email addresses,
    phone numbers, URLs, or generic resume section headers.
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    candidate_line = ""
    for line in lines[:5]:
        # Ignore contact information or generic document titles
        if re.search(r"@|http|www|\d{5,}", line, re.IGNORECASE):
            continue
        if re.match(NAME_SKIP_LINE_PATTERN, line):
            continue

        # Allow an explicit "Name: John Doe" label
        candidate_line = re.sub(NAME_LABEL_PATTERN, "", line)
        break

    if not candidate_line:
        return _name_result()

    # 1. Extract suffix preserving exact match string
    suffix = ""
    suffix_match = re.search(SUFFIX_PATTERN, candidate_line)
    if suffix_match:
        suffix = suffix_match.group(1).strip()
        # Remove suffix from candidate line for token processing
        candidate_line = candidate_line[:suffix_match.start()] + candidate_line[suffix_match.end():]

    # 2. Tokenize remaining words (Unicode-aware, so "Muñoz" / "Peña" survive)
    tokens = re.findall(NAME_TOKEN_PATTERN, candidate_line)

    if not tokens:
        return _name_result(suffix=suffix)

    first, middle, last = _split_name_tokens(tokens)
    return _name_result(first, middle, last, suffix)


def extract_city(text: str) -> str | None:
    """Extract city/municipality name when explicitly labeled (e.g. "City: Manila")."""
    match = re.search(CITY_PATTERN, text)
    if match:
        return match.group(1).strip()
    return None


def extract_province(text: str) -> str | None:
    """Extract province name when explicitly labeled (e.g. "Province: Pampanga")."""
    match = re.search(PROVINCE_PATTERN, text)
    if match:
        return match.group(1).strip()
    return None


def extract_location(text: str) -> dict:
    """
    Extract candidate personal city and province from the header/contact section only.
    Stops processing when reaching Work Experience or Employment sections to avoid
    extracting company locations.
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # Collect only header/personal info lines (before work experience)
    header_lines = []
    for line in lines:
        if re.match(HEADER_STOP_PATTERN, line):
            break
        header_lines.append(line)

    header_text = "\n".join(header_lines)

    city = extract_city(header_text)
    province = extract_province(header_text)

    # If missing, try a "City, Province" line in the header only
    if not city or not province:
        for line in header_lines:
            combo_match = re.match(CITY_PROVINCE_COMBO_PATTERN, line)
            if not combo_match:
                continue

            combo_city = combo_match.group(1).strip()
            combo_province = combo_match.group(2).strip()
            if combo_province.lower() in _COUNTRY_ONLY:
                continue

            city = city or combo_city
            province = province or combo_province
            break

    return {
        "city": city or "",
        "province": province or "",
    }


# ==============================================================================
# MAIN REGEX AGGREGATOR
# ==============================================================================

def extract_regex_entities(text: str) -> dict:
    """Combine all rule- and regex-based entity extractions into a single payload."""
    location = extract_location(text)

    return {
        "name": extract_name(text),
        "emails": extract_emails(text),
        "phone_numbers": extract_phone_numbers(text),
        "dates": extract_dates(text),
        "birth_date": extract_birthdate(text),
        "gender": extract_gender(text),
        "height": extract_height(text),
        "city": location["city"],
        "province": location["province"],
    }