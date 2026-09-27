import re

"""First phase of cleaning"""


def normalize_whitespace(text: str) -> str:

    # Replace tabs with spaces
    text = text.replace("\t", " ")

    # Replace multiple spaces with a single space
    text = re.sub(r"[ ]{2,}", " ", text)

    # Remove spaces at the beginning and end of lines
    text = "\n".join(line.strip() for line in text.splitlines())

    # Remove excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()

