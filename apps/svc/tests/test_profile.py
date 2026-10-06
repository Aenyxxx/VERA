"""EXT-04 profile normalization: education level, height, birthdate, gender, address line."""
import pytest

from app.extractors.profile import build_profile, extract_education_level, height_to_cm, normalize_birthdate
from app.extractors.sections import split_sections


def level(education: str = "", **other_sections) -> str:
    sections = {"education": education, **other_sections} if education else dict(other_sections)
    text = "\n".join(sections.values())
    return extract_education_level(sections, text)


# ------------------------------------------------------------------ education level (education section)
@pytest.mark.parametrize(
    "education, expected",
    [
        ("Master of Arts in Education\nBulacan State University", "postgraduate"),
        ("MBA, Ateneo Graduate School of Business", "postgraduate"),
        ("M.S. Computer Science", "postgraduate"),
        ("Doctor of Philosophy", "postgraduate"),
        ("MA units in Educational Management\nBachelor of Secondary Education", "college_graduate"),
        ("Bachelor of Science in Information Technology\n2016 - 2020", "college_graduate"),
        ("BSIT, Bulacan State University", "college_graduate"),
        ("BS in Accountancy", "college_graduate"),
        ("Bachelor of Science in Accountancy (3rd year)", "college_undergraduate"),
        ("BS Hospitality Management\n2023 - Present", "college_undergraduate"),
        ("College Level, AMA Computer College", "college_undergraduate"),
        ("TESDA Bread and Pastry Production NC II", "vocational"),
        ("Senior High School - STEM Strand", "senior_high"),
        ("Baliuag National High School\nHigh School Graduate", "senior_high"),      # old curriculum (PRD FR-PROF-02)
        ("Grade 12 - ABM", "senior_high"),
        ("Junior High School\nSta. Rita Elementary School", "junior_high"),
        ("Sta. Rita Elementary School", "elementary"),
        ("Some school with no level words", ""),
    ],
)
def test_education_section_levels(education, expected):
    assert level(education) == expected


def test_highest_level_wins():
    assert level("Bachelor of Science in Nursing\nSenior High School\nElementary") == "college_graduate"


def test_ms_office_skills_are_not_a_masters_degree():
    sections = {"skills": "MS Office, MS Excel, MS PowerPoint", "education": "High School"}
    assert extract_education_level(sections, "\n".join(sections.values())) == "senior_high"


def test_ms_office_inside_education_section_is_ignored():
    assert level("High School Graduate\nTraining: MS Word and MS Excel") == "senior_high"


def test_doctors_clinic_is_not_postgraduate():
    sections = {"experience": "Assistant at a doctor's clinic\n2021 - 2023", "education": "Senior High School"}
    assert extract_education_level(sections, "\n".join(sections.values())) == "senior_high"


def test_doctors_clinic_without_education_section_is_not_postgraduate():
    text = "Juan Cruz\nEXPERIENCE\nAssistant at a doctor's clinic"
    assert extract_education_level({"experience": "Assistant at a doctor's clinic"}, text) == ""


def test_strand_outside_education_section_is_ignored():
    sections = {"skills": "STEM tutoring, GAS station attendant"}
    assert extract_education_level(sections, "STEM tutoring, GAS station attendant") == ""


def test_fallback_uses_unambiguous_words_only():
    text = "Juan Cruz\nGraduated Bachelor of Science in Marketing, 2019\nMS Office"
    assert extract_education_level({}, text) == "college_graduate"
    assert extract_education_level({}, "Juan Cruz\nBS Marketing\nMS Office") == ""


# ------------------------------------------------------------------ height, birthdate
@pytest.mark.parametrize("raw, cm", [("175 cm", 175.0), ("162.5 centimeters", 162.5), ("5'8\"", 172.7), ("5'", 152.4), ("", None), ("12 cm", None)])
def test_height_to_cm(raw, cm):
    assert height_to_cm(raw) == cm


@pytest.mark.parametrize(
    "raw, iso",
    [
        ("July 10, 2002", "2002-07-10"),
        ("10 July 2002", "2002-07-10"),
        ("Sept. 3, 1999", "1999-09-03"),
        ("07/10/2002", "2002-07-10"),           # MM/DD/YYYY
        ("02/30/2002", ""),                     # not a real date
        ("", ""),
    ],
)
def test_normalize_birthdate(raw, iso):
    assert normalize_birthdate(raw) == iso


# ------------------------------------------------------------------ whole profile
def test_build_profile_from_resume_text():
    text = (
        "JUAN DELA CRUZ\n"
        "Blk 5 Lot 3, Brgy. San Jose, Baliuag, Bulacan\n"
        "Email: juan@example.com\n"
        "Mobile: 0917-123-4567\n"
        "Date of Birth: July 10, 2002\n"
        "Gender: Male\n"
        "Height: 5'8\"\n"
        "EDUCATION\n"
        "Baliuag National High School\n"
        "SKILLS\n"
        "Cash handling, MS Office"
    )
    assert build_profile(text, split_sections(text)) == {
        "firstName": "JUAN",
        "middleName": "",
        "lastName": "DELA CRUZ",
        "suffix": "",
        "email": "juan@example.com",
        "contactNumber": "0917-123-4567",
        "birthdate": "2002-07-10",
        "gender": "male",
        "heightCm": 172.7,
        "addressLine": "Blk 5 Lot 3, Brgy. San Jose",
        "city": "Baliuag",
        "province": "Bulacan",
        "educationLevel": "senior_high",
    }
