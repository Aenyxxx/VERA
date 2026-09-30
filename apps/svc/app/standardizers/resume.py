import re


def standardize_text(text: str) -> str:
    replacements = {
        "python": "Python",
        "javascript": "JavaScript",
        "node js": "Node.js",
        "nodejs": "Node.js",
        "reactjs": "React.js",
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