"""
Regex-based extraction module for personal and profile information.

Responsibility: Extract explicitly stated text from cleaned resume content.
Does NOT perform unit conversion, semantic interpretation, or cross-field inference.

Extracted fields (every field is a plain string, "" when not found):
first_name, middle_name, last_name, suffix, email, phone_number,
birth_date, age, gender, height, city, province
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
# apostrophes. Stops at a comma, semicolon, colon, pipe, digit, or line break.
_PLACE = r"[^\W\d_][^\n\r,;:|\d]*"

EMAIL_PATTERN = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"

# Philippine mobile format. Digit boundaries stop matches inside longer digit
# runs; [ \t] (not \s) stops matches from spanning a line break.
PHONE_PATTERN = r"(?<!\d)(?:\+63|0)[ \t]?\d{3}[ \t-]?\d{3}[ \t-]?\d{4}(?!\d)"

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

# Only a labeled age ("Age: 24", "Age 24"). "manage 25" is excluded by \b.
AGE_PATTERN = r"(?i)\bage\b\s*[:\-]?\s*(\d{2})(?!\d)"

GENDER_PATTERN = (
    r"(?i)\b(?:gender|sex)\b\s*[:\-]?\s*"
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

# Section headings that end the personal/contact header. Must be a heading on its
# own line, so "Experience in sales ..." inside a summary doesn't cut the header.
HEADER_STOP_PATTERN = (
    r"(?i)^(?:work\s+experience|professional\s+experience|experience|employment"
    r"(?:\s+history)?|work\s+certificate|education(?:al\s+background)?"
    r"|(?:technical\s+)?skills|trainings?|seminars?|projects?"
    r"|(?:character\s+)?references?)\s*:?\s*$"
)

REFERENCES_PATTERN = r"(?i)^(?:character\s+)?references?\s*:?\s*$"

ADDRESS_LABEL_PATTERN = (
    r"(?i)^(?:(?:current\s+|permanent\s+|home\s+)?address|location|residence)\s*:\s*"
)

# Segment that is a street/barangay part, not a city.
NON_CITY_START_PATTERN = (
    r"(?i)^(?:\d|(?:brgy|barangay|purok|blk|block|lot|unit|phase|sitio|zone|street|st)\b)"
)

# Splits an address on commas or spaced dashes/pipes ("Quezon City - Metro Manila").
ADDRESS_SPLIT_PATTERN = r"\s*(?:,|\s[-–—|]\s)\s*"

CITY_SUFFIX_PATTERN = r"(?i)(?:\bcity$|^city\s+of\b|\bmunicipality$)"

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
# ("Dela Cruz", "de la Cruz", "San Jose", ...).
SURNAME_PARTICLES = {
    "de", "del", "dela", "delos", "la", "las", "los",
    "san", "santa", "sta", "sto", "van", "von", "da", "di",
}

_COUNTRY_ONLY = {"philippines", "ph"}

_PROVINCES = {
    "abra", "agusan del norte", "agusan del sur", "aklan", "albay", "antique",
    "apayao", "aurora", "basilan", "bataan", "batanes", "batangas", "benguet",
    "biliran", "bohol", "bukidnon", "bulacan", "cagayan", "camarines norte",
    "camarines sur", "camiguin", "capiz", "catanduanes", "cavite", "cebu",
    "cotabato", "davao de oro", "davao del norte", "davao del sur",
    "davao occidental", "davao oriental", "dinagat islands", "eastern samar",
    "guimaras", "ifugao", "ilocos norte", "ilocos sur", "iloilo", "isabela",
    "kalinga", "la union", "laguna", "lanao del norte", "lanao del sur",
    "leyte", "maguindanao del norte", "maguindanao del sur", "marinduque",
    "masbate", "misamis occidental", "misamis oriental", "mountain province",
    "negros occidental", "negros oriental", "northern samar", "nueva ecija",
    "nueva vizcaya", "occidental mindoro", "oriental mindoro", "palawan",
    "pampanga", "pangasinan", "quezon", "quirino", "rizal", "romblon", "samar",
    "sarangani", "siquijor", "sorsogon", "south cotabato", "southern leyte",
    "sultan kudarat", "sulu", "surigao del norte", "surigao del sur", "tarlac",
    "tawi-tawi", "zambales", "zamboanga del norte", "zamboanga del sur",
    "zamboanga sibugay",
    # National Capital Region
    "metro manila", "ncr", "national capital region",
}


# ==============================================================================
# HELPERS
# ==============================================================================

def _header_lines(text: str) -> list[str]:
    """Non-empty lines before the first section heading (Experience, Education, ...)."""
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.match(HEADER_STOP_PATTERN, line):
            break
        lines.append(line)
    return lines


def _before_references(text: str) -> str:
    """Text up to (not including) a References heading."""
    lines: list[str] = []
    for raw in text.splitlines():
        if re.match(REFERENCES_PATTERN, raw.strip()):
            break
        lines.append(raw)
    return "\n".join(lines)


def _first_contact_match(text: str, pattern: str) -> str:
    """
    First match of `pattern` in the personal header. If the header has none
    (contact info placed elsewhere), fall back to the first match before a
    References section. Returns "" when nothing is found.
    """
    match = re.search(pattern, "\n".join(_header_lines(text)))
    if match:
        return match.group(0).strip()

    match = re.search(pattern, _before_references(text))
    return match.group(0).strip() if match else ""


# ==============================================================================
# FIELD EXTRACTORS  (every extractor returns a string, "" when not found)
# ==============================================================================

def extract_email(text: str) -> str:
    """Extract the applicant's email from the header (ignores employer/reference emails)."""
    return _first_contact_match(text, EMAIL_PATTERN)


def extract_phone_number(text: str) -> str:
    """Extract the applicant's Philippine phone number from the header."""
    return _first_contact_match(text, PHONE_PATTERN)


def extract_birthdate(text: str) -> str:
    """Extract the birthdate when explicitly associated with a label."""
    match = re.search(BIRTHDATE_PATTERN, text)
    return match.group(1).strip() if match else ""


def extract_age(text: str) -> str:
    """Extract the age when explicitly labeled (e.g. "Age: 24"). Not computed from birthdate."""
    match = re.search(AGE_PATTERN, "\n".join(_header_lines(text)))
    return match.group(1) if match else ""


def extract_gender(text: str) -> str:
    """Extract gender when explicitly associated with a gender/sex label."""
    match = re.search(GENDER_PATTERN, text)
    return match.group(1) if match else ""


def extract_height(text: str) -> str:
    """Extract height (cm or feet/inches) when associated with a height label."""
    cm_match = re.search(HEIGHT_CM_PATTERN, text)
    if cm_match:
        return cm_match.group(1).strip()

    imperial_match = re.search(HEIGHT_IMPERIAL_PATTERN, text)
    if imperial_match:
        return imperial_match.group(1).strip()

    return ""


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
        candidate_line = candidate_line[:suffix_match.start()] + candidate_line[suffix_match.end():]

    # 2. Tokenize remaining words (Unicode-aware, so "Muñoz" / "Peña" survive)
    tokens = re.findall(NAME_TOKEN_PATTERN, candidate_line)

    if not tokens:
        return _name_result(suffix=suffix)

    first, middle, last = _split_name_tokens(tokens)
    return _name_result(first, middle, last, suffix)


def extract_city(text: str) -> str:
    """Extract city/municipality name when explicitly labeled (e.g. "City: Manila")."""
    match = re.search(CITY_PATTERN, text)
    return match.group(1).strip() if match else ""


def extract_province(text: str) -> str:
    """Extract province name when explicitly labeled (e.g. "Province: Pampanga")."""
    match = re.search(PROVINCE_PATTERN, text)
    return match.group(1).strip() if match else ""


def _normalize_province(segment: str) -> str:
    """Return the province name if the segment is a known province, else ''."""
    cleaned = re.sub(
        r"(?i)^province\s+of\s+|\s+province$|\s*\(ncr\)$", "", segment.strip()
    ).strip(" .")
    return cleaned if cleaned.lower() in _PROVINCES else ""


def _parse_address_line(line: str) -> tuple[str, str] | None:
    """Pull (city, province) out of one address-like line, or None if it isn't one."""
    if "@" in line or re.search(PHONE_PATTERN, line):
        return None

    labeled = bool(re.match(ADDRESS_LABEL_PATTERN, line))
    line = re.sub(ADDRESS_LABEL_PATTERN, "", line)

    segments = [
        re.sub(r"^[^\w]+", "", s.strip(" .;"))  # drop leading emoji/symbols like "📍"
        for s in re.split(ADDRESS_SPLIT_PATTERN, line)
    ]
    segments = [s for s in segments if s]

    # Drop a trailing country and/or zip code.
    while segments and (
        segments[-1].lower() in _COUNTRY_ONLY or re.fullmatch(r"\d{4}", segments[-1])
    ):
        segments.pop()
    if not segments:
        return None

    # The province is the last segment that is a known province; the city is
    # the segment right before it (street/barangay parts are not cities).
    for i in range(len(segments) - 1, -1, -1):
        province = _normalize_province(segments[i])
        if not province:
            continue
        if i == 0 and not labeled:
            return None  # a bare province name on its own line isn't an address
        city = segments[i - 1] if i > 0 else ""
        if re.match(NON_CITY_START_PATTERN, city):
            city = ""
        return city, province

    # No known province: on an explicitly labeled address, accept a trailing city.
    if labeled and re.search(CITY_SUFFIX_PATTERN, segments[-1]):
        return segments[-1], ""

    return None


def extract_location(text: str) -> dict:
    """
    Extract the candidate's personal city and province from the header section only,
    so company/school locations in later sections are never used.

    Labeled fields ("City: ...", "Province: ...") win; otherwise an address line
    is parsed and validated against a list of Philippine provinces.
    """
    header_lines = _header_lines(text)
    header_text = "\n".join(header_lines)

    city = extract_city(header_text)
    province = extract_province(header_text)

    if not city or not province:
        for line in header_lines:
            parsed = _parse_address_line(line)
            if not parsed:
                continue
            city = city or parsed[0]
            province = province or parsed[1]
            break

    return {"city": city or "", "province": province or ""}


# ==============================================================================
# MAIN REGEX AGGREGATOR
# ==============================================================================

# VERA-ALGO[EXT-04] BEGIN Profile entity extraction for the auto-filled card
# Rule-based extraction of name, contact, birthdate, gender, height, city, province (never used in scoring).   Ref: docs/ALGORITHM.md §4 EXT-04
def extract_regex_entities(text: str) -> dict:
    """Combine all extractions into one flat payload. Missing values are ""."""
    name = extract_name(text)
    location = extract_location(text)

    return {
        "first_name": name["first_name"],
        "middle_name": name["middle_name"],
        "last_name": name["last_name"],
        "suffix": name["suffix"],
        "email": extract_email(text),
        "phone_number": extract_phone_number(text),
        "birth_date": extract_birthdate(text),
        "age": extract_age(text),
        "gender": extract_gender(text),
        "height": extract_height(text),
        "city": location["city"],
        "province": location["province"],
    }
# VERA-ALGO[EXT-04] END
