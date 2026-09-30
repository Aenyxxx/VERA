from app.extractors.regex import (
    extract_email, extract_phone_number, extract_birthdate, extract_age,
    extract_gender, extract_height, extract_name, extract_city,
    extract_province, extract_location, extract_regex_entities,
)

def test_extract_email():
    assert extract_email("Contact: john.delacruz@gmail.com") == "john.delacruz@gmail.com"

def test_extract_email_ignores_emails_after_header():
    text = (
        "Juan Cruz\nEmail: juan@example.com\n"
        "Work Experience\nAcme Corp, hr@acme.com\n"
        "References\nMaria Lopez, maria@ref.com"
    )
    assert extract_email(text) == "juan@example.com"

def test_extract_email_missing_is_empty_string():
    assert extract_email("Juan Cruz\nSoftware Engineer") == ""

def test_extract_phone_number():
    assert extract_phone_number("Contact: +63 917 123 4567") == "+63 917 123 4567"

def test_extract_phone_number_with_hyphens():
    assert extract_phone_number("Mobile: 0917-123-4567") == "0917-123-4567"

def test_phone_not_matched_inside_longer_digit_string():
    assert extract_phone_number("Ref no: 1209171234567890") == ""

def test_extract_age():
    assert extract_age("Juan Cruz\nAge: 24") == "24"

def test_age_requires_label():
    assert extract_age("Juan Cruz\nManaged a team of 25 people") == ""

def test_date_without_birthdate_label_is_not_birthdate():
    assert extract_birthdate("Employment Period: 2022 - 2025") == ""

def test_gender_without_field_label_is_not_extracted():
    assert extract_gender("The candidate worked with male and female employees.") == ""

def test_extract_height_centimeters():
    assert extract_height("Height: 175 cm") == "175 cm"

def test_extract_height_feet_inches():
    assert extract_height('Height: 5\'8"') == '5\'8"'

def test_height_without_height_label():
    assert extract_height("The applicant is 5'8\" tall.") == ""

def test_extract_regex_entities_full_resume():
    text = (
        "Juan Dela Cruz Jr.\n"
        "Email: juan@example.com\n"
        "Phone: +63 917 123 4567\n"
        "Date of Birth: July 10, 2002\n"
        "Age: 24\n"
        "Gender: Male\n"
        "Height: 175 cm\n"
        "City: Angeles City\n"
        "Province: Pampanga\n"
        "Experience\n"
        "Software Engineer, 2022 - 2025"
    )
    assert extract_regex_entities(text) == {
        "first_name": "Juan",
        "middle_name": "",
        "last_name": "Dela Cruz",
        "suffix": "Jr.",
        "email": "juan@example.com",
        "phone_number": "+63 917 123 4567",
        "birth_date": "July 10, 2002",
        "age": "24",
        "gender": "Male",
        "height": "175 cm",
        "city": "Angeles City",
        "province": "Pampanga",
    }


def test_extract_regex_entities_empty_text():
    result = extract_regex_entities("")
    assert result == {key: "" for key in result}
    assert len(result) == 12

def test_extract_age_value_on_next_line():
    assert extract_age("MARIA CRUZ\nPERSONAL DETAILS\nAge:\n28 years old") == "28"


def test_extract_age_same_line():
    assert extract_age("Juan Cruz\nAge: 24") == "24"


def test_extract_gender_value_on_next_line():
    assert extract_gender("Gender:\nFemale") == "Female"


def test_extract_location_ignores_leading_emoji():
    text = "MARIA CRUZ\n📍 Mandaluyong City, Metro Manila"
    assert extract_location(text) == {"city": "Mandaluyong City", "province": "Metro Manila"}