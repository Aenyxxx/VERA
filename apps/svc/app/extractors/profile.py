"""
Profile card for the auto-fill (TRD §8 `profile`): turns the raw strings from regex.py into typed,
normalized values — ISO birthdate, lowercase gender, height in cm, and the education level enum.

The applicant reviews and edits every field before it is saved (FR-PROF-04).
None of these fields is ever used in the matching score; age/gender/education/height are only
used by the vacancy prescreen after the applicant confirms them.
"""
from __future__ import annotations

import datetime as dt
import re

from app.extractors.regex import extract_regex_entities

# VERA-ALGO[EXT-04] BEGIN Profile normalization and education level for the auto-filled card
# Raw entities -> profile: birthdate -> YYYY-MM-DD, height -> cm, education keywords -> highest education_level.   Ref: docs/ALGORITHM.md §4 EXT-04

# Lowest -> highest, same order as the SQL enum education_level.
EDUCATION_LEVELS = [
    "elementary", "junior_high", "senior_high", "vocational",
    "college_undergraduate", "college_graduate", "postgraduate",
]

# "MS Office", "MS Excel", ... are software skills, not degrees.
_NOT_SOFTWARE = r"(?!\s*(?i:office|word|excel|powerpoint|access|outlook)\b)"


def _abbr(*abbreviations: str) -> str:
    """Case-sensitive abbreviation with word boundaries, not followed by an Office product name."""
    return r"(?<![\w.])(?:" + "|".join(abbreviations) + r")(?![\w])" + _NOT_SOFTWARE


_I = "(?i)"

# Rules used inside the EDUCATION section (abbreviations and strand names allowed there only).
SECTION_RULES = [
    ("postgraduate", _I + r"\bmaster(?:'?s)?\b|\bdoctor\s+of\b|\bdoctorate\b|\bph\.?\s?d\b|\bm\.\s?[sa]\.|\bm[sa]\s+in\b"),
    ("postgraduate", _abbr("MS", "MA", "MBA", "PhD")),
    ("college_graduate", _I + r"\bbachelor(?:'?s)?\b|\bcollege\s+graduate\b|\bb\.\s?[sa]\.|\bb[sa]\s+in\b"),
    ("college_graduate", _abbr("BS", "BA", "AB", "BSc", r"BS[A-Z]{1,4}")),           # BSIT, BSBA, BSHM, ...
    ("college_undergraduate", _I + r"\bcollege\s+level\b|\bundergrad(?:uate)?\b"),
    ("vocational", _I + r"\btesda\b|\bvocational\b|\btech(?:nical)?[\s-]?voc(?:ational)?\b"),
    ("vocational", r"\bNC\s?(?:I{1,3}|IV|[1-4])\b"),
    ("senior_high", _I + r"\bsenior\s+high\b|\bgrade\s*12\b"),
    ("senior_high", _abbr("SHS", "STEM", "ABM", "HUMSS", "GAS", "TVL")),
    # Old 4-year curriculum "High School" counts as senior high (PRD FR-PROF-02).
    ("senior_high", _I + r"(?<!junior )(?<!senior )\bhigh\s*school\b"),
    ("junior_high", _I + r"\bjunior\s+high\b|\bgrade\s*10\b"),
    ("junior_high", _abbr("JHS")),
    ("elementary", _I + r"\belementary\b|\bprimary\s+(?:school|education)\b"),
]

# Rules for the whole-text fallback (no education section): unambiguous words only.
FALLBACK_RULES = [
    ("postgraduate", _I + r"\bmaster(?:'?s)?\s+(?:of|in|degree)\b|\bdoctorate\b|\bdoctor\s+of\b|\bph\.?\s?d\b"),
    ("college_graduate", _I + r"\bbachelor(?:'?s)?\b"),
    ("vocational", _I + r"\btesda\b|\bvocational\b"),
    ("vocational", r"\bNC\s?(?:I{1,3}|IV|[1-4])\b"),
    ("senior_high", _I + r"\bsenior\s+high\b"),
    ("senior_high", _I + r"(?<!junior )(?<!senior )\bhigh\s*school\b"),
    ("junior_high", _I + r"\bjunior\s+high\b"),
    ("elementary", _I + r"\belementary\b"),
]

# A degree still in progress: "BSIT (3rd year)", "Bachelor of ... — undergraduate", "2022 – Present".
_IN_PROGRESS = _I + r"\bundergrad(?:uate)?\b|\bunits?\b|\bon-?going\b|\b\d(?:st|nd|rd|th)\s+year\b|\bpresent\b|\bexpected\b"


def _highest_level(text: str, rules: list[tuple[str, str]]) -> str:
    best = -1
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for i, line in enumerate(lines):
        for level, pattern in rules:
            if not re.search(pattern, line):
                continue
            # A degree with an in-progress hint on its line or the next one counts one level lower:
            # unfinished bachelor's -> undergraduate; master's units -> college graduate.
            if level in ("college_graduate", "postgraduate"):
                entry = line + " " + (lines[i + 1] if i + 1 < len(lines) else "")
                if re.search(_IN_PROGRESS, entry):
                    level = "college_undergraduate" if level == "college_graduate" else "college_graduate"
            best = max(best, EDUCATION_LEVELS.index(level))
    return EDUCATION_LEVELS[best] if best >= 0 else ""


def extract_education_level(sections: dict, text: str) -> str:
    """Highest education level stated. Abbreviations/strands count only in the education section."""
    education = sections.get("education", "")
    if education:
        return _highest_level(education, SECTION_RULES)
    return _highest_level(text, FALLBACK_RULES)


_MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def normalize_birthdate(raw: str) -> str:
    """'July 10, 2002' / '10 July 2002' / '07/10/2002' (MM/DD/YYYY, PH convention) -> '2002-07-10'; else ''."""
    s = raw.strip().lower().replace(",", " ")
    year = month = day = None
    if m := re.fullmatch(r"([a-z]+)\.?\s+(\d{1,2})\s+(\d{4})", s):
        month, day, year = _MONTHS.get(m[1][:3]), int(m[2]), int(m[3])
    elif m := re.fullmatch(r"(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})", s):
        day, month, year = int(m[1]), _MONTHS.get(m[2][:3]), int(m[3])
    elif m := re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s):
        month, day, year = int(m[1]), int(m[2]), int(m[3])
    try:
        return dt.date(year, month, day).isoformat() if year and month and day else ""
    except ValueError:
        return ""


def height_to_cm(raw: str) -> float | None:
    """'175 cm' -> 175.0; 5'8" -> 172.7 (1 ft = 30.48 cm, 1 in = 2.54 cm); outside 100-250 cm -> None."""
    if m := re.search(r"(\d{2,3}(?:\.\d+)?)\s*(?:cm|centimeters?)", raw, re.I):
        cm = float(m[1])
    elif m := re.search(r"(\d{1,2})\s*'\s*(?:(\d{1,2})\s*\")?", raw):
        cm = int(m[1]) * 30.48 + int(m[2] or 0) * 2.54
    else:
        return None
    return round(cm, 1) if 100 <= cm <= 250 else None


def build_profile(text: str, sections: dict) -> dict:
    """The auto-filled profile card (TRD §8). Missing values are "" (or None for height)."""
    raw = extract_regex_entities(text)
    gender = raw["gender"].lower()
    return {
        "firstName": raw["first_name"],
        "middleName": raw["middle_name"],
        "lastName": raw["last_name"],
        "suffix": raw["suffix"],
        "email": raw["email"],
        "contactNumber": raw["phone_number"],
        "birthdate": normalize_birthdate(raw["birth_date"]),
        "gender": gender if gender in ("male", "female") else "",
        "heightCm": height_to_cm(raw["height"]),
        "addressLine": raw["address_line"],
        "city": raw["city"],
        "province": raw["province"],
        "educationLevel": extract_education_level(sections, text),
    }
# VERA-ALGO[EXT-04] END
