from app.extractors.regex import (
    extract_emails,
    extract_phone_numbers,
    extract_dates,
    extract_birthdate,
    extract_gender,
    extract_height,
    extract_name,
    extract_city,
    extract_province,
    extract_location,
    extract_regex_entities,
)


# ------------------------------------------------------------------ email

def test_extract_email():
    text = "Contact: john.delacruz@gmail.com"

    result = extract_emails(text)

    assert result == ["john.delacruz@gmail.com"]


# ------------------------------------------------------------------ phone

def test_extract_phone_number():
    text = "Contact: +63 917 123 4567"

    result = extract_phone_numbers(text)

    assert result == ["+63 917 123 4567"]


def test_extract_phone_number_with_hyphens():
    assert extract_phone_numbers("Mobile: 0917-123-4567") == ["0917-123-4567"]


def test_phone_not_matched_inside_longer_digit_string():
    assert extract_phone_numbers("Ref no: 1209171234567890") == []


# ------------------------------------------------------------------ dates

def test_extract_dates():
    text = "Software Engineer, 2022 - 2025"

    result = extract_dates(text)

    assert "2022 - 2025" in result


def test_extract_dates_case_insensitive_and_abbreviated():
    result = extract_dates("Jan. 2020 - sept 2021")

    assert result == ["Jan. 2020", "sept 2021"]


def test_numeric_month_year_not_taken_from_full_date():
    result = extract_dates("Born 07/10/2002")

    assert "10/2002" not in result


# ------------------------------------------------------------------ birthdate

def test_extract_birthdate():
    text = "Date of Birth: July 10, 2002"

    result = extract_birthdate(text)

    assert result == "July 10, 2002"


def test_extract_birthdate_with_dob():
    text = "DOB: 07/10/2002"

    result = extract_birthdate(text)

    assert result == "07/10/2002"


def test_extract_birthdate_day_first():
    assert extract_birthdate("Birthday: 10 July 2002") == "10 July 2002"


def test_date_without_birthdate_label_is_not_birthdate():
    text = "Employment Period: 2022 - 2025"

    result = extract_birthdate(text)

    assert result is None


# ------------------------------------------------------------------ gender

def test_extract_gender():
    text = "Gender: Male"

    result = extract_gender(text)

    assert result == "Male"


def test_extract_female_gender():
    text = "Sex: Female"

    result = extract_gender(text)

    assert result == "Female"


def test_gender_without_field_label_is_not_extracted():
    text = "The candidate worked with male and female employees."

    result = extract_gender(text)

    assert result is None


# ------------------------------------------------------------------ height

def test_extract_height_centimeters():
    text = "Height: 175 cm"

    result = extract_height(text)

    assert result == ["175 cm"]


def test_extract_height_without_space():
    text = "Height: 175cm"

    result = extract_height(text)

    assert result == ["175cm"]


def test_extract_height_feet_inches():
    text = 'Height: 5\'8"'

    result = extract_height(text)

    assert result == ['5\'8"']


def test_extract_height_feet_only():
    text = "Height: 5'"

    result = extract_height(text)

    assert result == ["5'"]


def test_height_without_height_label():
    text = "The applicant is 5'8\" tall."

    result = extract_height(text)

    assert result == []


# ------------------------------------------------------------------ name

def test_extract_name_first_last():
    text = "John Doe\njohn.doe@email.com\n09171234567"
    assert extract_name(text) == {
        "first_name": "John",
        "middle_name": "",
        "last_name": "Doe",
        "suffix": ""
    }


def test_extract_name_first_middle_last():
    text = "John Robert Smith\nEmail: john@example.com"
    assert extract_name(text) == {
        "first_name": "John",
        "middle_name": "Robert",
        "last_name": "Smith",
        "suffix": ""
    }


def test_extract_name_with_suffix_and_compound_surname():
    # "Dela Cruz" is a compound surname, so it is kept together as the last name.
    text = "Juan Dela Cruz Jr.\nPhone: 09171234567"
    assert extract_name(text) == {
        "first_name": "Juan",
        "middle_name": "",
        "last_name": "Dela Cruz",
        "suffix": "Jr."
    }


def test_extract_name_multi_word_particle_surname():
    text = "Juan de la Cruz\nSoftware Engineer"
    assert extract_name(text) == {
        "first_name": "Juan",
        "middle_name": "",
        "last_name": "de la Cruz",
        "suffix": ""
    }


def test_extract_name_skips_header_title():
    text = "CURRICULUM VITAE\nJane Mary Doe\nEmail: jane@example.com"
    assert extract_name(text) == {
        "first_name": "Jane",
        "middle_name": "Mary",
        "last_name": "Doe",
        "suffix": ""
    }


def test_extract_name_multiple_middle_names():
    text = "Maria Luisa Santos Rodriguez\nSoftware Engineer"
    assert extract_name(text) == {
        "first_name": "Maria",
        "middle_name": "Luisa Santos",
        "last_name": "Rodriguez",
        "suffix": ""
    }


def test_extract_name_with_accented_characters():
    text = "José Muñoz Peña\nEmail: jose@example.com"
    assert extract_name(text) == {
        "first_name": "José",
        "middle_name": "Muñoz",
        "last_name": "Peña",
        "suffix": ""
    }


def test_extract_name_with_label():
    text = "Name: John Doe\nEmail: john@example.com"
    assert extract_name(text) == {
        "first_name": "John",
        "middle_name": "",
        "last_name": "Doe",
        "suffix": ""
    }


def test_extract_name_suffix_after_comma():
    assert extract_name("Juan Cruz, Jr.")["suffix"] == "Jr."
    assert extract_name("Juan Cruz, Jr.")["last_name"] == "Cruz"


def test_extract_name_roman_numeral_suffix():
    result = extract_name("John Smith III")
    assert result["suffix"] == "III"
    assert result["last_name"] == "Smith"


# ------------------------------------------------------------------ location

def test_extract_city_does_not_cross_lines():
    assert extract_city("City: Manila\nProvince: Metro Manila") == "Manila"


def test_extract_province_does_not_cross_lines():
    text = "Province: Pampanga\nEmail: juan@example.com"
    assert extract_province(text) == "Pampanga"


def test_extract_location_labeled_fields():
    text = "John Doe\nCity: Manila\nProvince: Metro Manila\n"
    assert extract_location(text) == {"city": "Manila", "province": "Metro Manila"}


def test_extract_location_city_province_line_ignores_name_line():
    text = "Juan Dela Cruz\nAngeles City, Pampanga\nExperience\nAcme Corp, Makati City"
    assert extract_location(text) == {"city": "Angeles City", "province": "Pampanga"}


def test_extract_location_labeled_address_line():
    text = "Address: Angeles City, Pampanga"
    assert extract_location(text) == {"city": "Angeles City", "province": "Pampanga"}


def test_extract_location_with_country_suffix():
    text = "Quezon City, Metro Manila, Philippines"
    assert extract_location(text) == {"city": "Quezon City", "province": "Metro Manila"}


def test_extract_location_ignores_company_locations_after_experience():
    text = "Experience\nAcme Corp, Makati City"
    assert extract_location(text) == {"city": "", "province": ""}


# ------------------------------------------------------------------ aggregator

def test_extract_regex_entities_full_resume():
    text = (
        "Juan Dela Cruz Jr.\n"
        "Email: juan@example.com\n"
        "Phone: +63 917 123 4567\n"
        "Date of Birth: July 10, 2002\n"
        "Gender: Male\n"
        "Height: 175 cm\n"
        "City: Angeles City\n"
        "Province: Pampanga\n"
        "Experience\n"
        "Software Engineer, 2022 - 2025"
    )

    result = extract_regex_entities(text)

    assert result["name"] == {
        "first_name": "Juan",
        "middle_name": "",
        "last_name": "Dela Cruz",
        "suffix": "Jr.",
    }
    assert result["emails"] == ["juan@example.com"]
    assert result["phone_numbers"] == ["+63 917 123 4567"]
    assert "2022 - 2025" in result["dates"]
    assert result["birth_date"] == "July 10, 2002"
    assert result["gender"] == "Male"
    assert result["height"] == ["175 cm"]
    assert result["city"] == "Angeles City"
    assert result["province"] == "Pampanga"


def test_extract_regex_entities_empty_text():
    result = extract_regex_entities("")

    assert result["name"] == {
        "first_name": "",
        "middle_name": "",
        "last_name": "",
        "suffix": "",
    }
    assert result["emails"] == []
    assert result["birth_date"] is None
    assert result["city"] == ""
    assert result["province"] == ""