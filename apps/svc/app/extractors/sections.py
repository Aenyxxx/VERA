"""Split resume text into named sections using heading lines."""
from __future__ import annotations

import re

_HEADINGS = {
    "summary": r"(?:professional\s+|career\s+)?(?:summary|profile|objective)",
    "personal": r"personal\s+(?:details|information|data)|bio-?data",
    "experience": (
        r"(?:(?:work|professional|employment|relevant)\s+)?experience"
        r"|(?:work|employment)\s+history|employment"
    ),
    "education": r"education(?:al)?(?:\s+(?:background|attainment))?",
    "skills": (
        r"(?:(?:technical|key|core|professional)\s+)?skills(?:\s*(?:&|and)\s*\w+)?"
        r"|(?:core\s+)?competencies"
    ),
    "certifications": (
        r"(?:licenses?\s*(?:&|and)\s*)?certifications?(?:\s*(?:&|and)\s*licenses?)?"
        r"|licenses?|licensure"
    ),
    "references": r"(?:character\s+)?references?",
    "other": (
        r"projects?|trainings?(?:\s*(?:&|and)\s*seminars?)?|seminars?|awards?"
        r"|achievements?|interests?|hobbies|languages?|affiliations?|declaration"
    ),
}

_COMPILED = {
    name: re.compile(r"(?i)^(?:" + pattern + r")$") for name, pattern in _HEADINGS.items()
}


def _heading_name(line: str) -> str | None:
    """Return the section name if the line is a heading, else None."""
    stripped = line.strip()
    if not stripped or len(stripped) > 40:
        return None
    # Ignore decorations and colons around the heading ("EXPERIENCE:", "★ Skills").
    core = re.sub(r"^[^\w]+|[^\w]+$", "", stripped)
    for name, pattern in _COMPILED.items():
        if pattern.match(core):
            return name
    return None


def split_sections(text: str) -> dict[str, str]:
    """Map section name -> section text. Text before the first heading is 'header'."""
    sections: dict[str, list[str]] = {"header": []}
    current = "header"
    for line in text.splitlines():
        name = _heading_name(line)
        if name:
            current = name
            sections.setdefault(current, [])
            continue
        sections[current].append(line)

    joined = {name: "\n".join(lines).strip() for name, lines in sections.items()}
    return {name: body for name, body in joined.items() if body}