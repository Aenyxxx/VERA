import re


# VERA-ALGO[EXT-02] BEGIN Spelling and abbreviation standardization of skill terms
# Map spelling variants and spelled-out abbreviations to one canonical form (e.g. 'node js' -> 'Node.js',
# 'point-of-sale' -> 'POS'). Applied to resumes and to job requirements, so both sides use the same words.   Ref: docs/ALGORITHM.md §4 EXT-02
def standardize_text(text: str) -> str:
    replacements = {
        "python": "Python",
        "javascript": "JavaScript",
        "node js": "Node.js",
        "nodejs": "Node.js",
        "reactjs": "React.js",
        # SBERT scores 'POS system' vs 'point-of-sale terminal' only ~0.22 but 'POS terminal' ~0.65.
        "point-of-sale": "POS",
        "point of sale": "POS",
    }

    for original, standardized in replacements.items():
        pattern = rf"\b{re.escape(original)}\b"
        text = re.sub(
            pattern,
            standardized,
            text,
            flags=re.IGNORECASE
        )

    return text
# VERA-ALGO[EXT-02] END
