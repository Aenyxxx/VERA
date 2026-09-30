from app.extractors.sections import split_sections


def test_split_sections_separates_references():
    text = (
        "MARIA CRUZ\nWORK EXPERIENCE\nHR Generalist — Megaworld\n"
        "EDUCATIONAL BACKGROUND\nBS in Psychology\n"
        "LICENSES & CERTIFICATIONS\nRegistered Psychometrician\n"
        "CHARACTER REFERENCES\nAtty. Roberto Mendoza\nHR Director, Megaworld"
    )
    sections = split_sections(text)
    assert sections["header"] == "MARIA CRUZ"
    assert sections["experience"] == "HR Generalist — Megaworld"
    assert sections["education"] == "BS in Psychology"
    assert "Mendoza" in sections["references"]
    assert "Mendoza" not in sections["experience"]


def test_headings_with_colons_and_symbols():
    text = "EXPERIENCE:\nDeveloper — ABC\n★ Skills\nPython, SQL"
    sections = split_sections(text)
    assert sections["experience"] == "Developer — ABC"
    assert sections["skills"] == "Python, SQL"


def test_long_sentences_are_not_headings():
    text = "SKILLS\nI have five years of experience in payroll administration and HR."
    sections = split_sections(text)
    assert "payroll" in sections["skills"]
    assert "experience" not in sections