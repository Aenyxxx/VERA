"""MAT-03 years worked from merged date ranges (TC-71)."""
import datetime as dt

from app.matchers.rules import find_date_ranges, total_years

TODAY = dt.date(2026, 10, 6)


def test_overlapping_ranges_are_counted_once():                              # TC-71
    assert total_years(["Jan 2021 – Dec 2022", "Jun 2022 – Jun 2023"], TODAY) == 2.5


def test_month_ranges_include_both_end_months():
    assert total_years(["06/2021 - 11/2021"], TODAY) == 0.5


def test_present_runs_until_today():
    # March 2022 .. October 2026 inclusive = 56 months
    assert total_years(["March 2022 - Present"], TODAY) == round(56 / 12, 1)


def test_year_only_ranges():
    assert total_years(["2019 - 2021"], TODAY) == 2.0
    assert total_years(["2021 - 2021"], TODAY) == 1.0


def test_duplicate_ranges_are_counted_once():
    assert total_years(["Jan 2020 - Dec 2020", "January 2020 to December 2020"], TODAY) == 1.0


def test_no_dates_means_zero_years():
    assert total_years([], TODAY) == 0.0
    assert total_years(["sometime last year"], TODAY) == 0.0


def test_find_date_ranges_in_experience_text():
    text = "Cashier — Kabayan Mart\nMarch 2022 – Present\nBagger\n2019 - 2021"
    assert find_date_ranges(text) == ["March 2022 – Present", "2019 - 2021"]
