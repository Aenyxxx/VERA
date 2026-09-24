import re

def clean_text(text: str) -> str:
    # space and tabs remover from the beggining upto  the end of each line
    lines = [
        line.strip()
        for line in text.splitlines()
    ]

    # Empty lines remover
    lines = [
        line
        for line in lines
        if line
    ]

    # Normalization of multiple spaces inside a line
    lines = [
        re.sub(r"[ \t]+", " ", line)
        for line in lines
    ]

    cleaned_lines = []

    i = 0

    while i < len(lines):
        current_line = lines[i]

        if i + 1 < len(lines):
            next_line = lines[i + 1]

            if (
                current_line 
                and next_line
                and next_line[0].islower()
                and not current_line.endswith((".", "!", "?", ":", ";"))
            ):
                current_line = current_line + " " + next_line
                i += 1
        
        cleaned_lines.append(current_line)
        i += 1

    return "\n".join(cleaned_lines)