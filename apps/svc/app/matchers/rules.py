"""Rule-based parts of the matcher (no SBERT): total years worked, and the education level / HR filter."""
from __future__ import annotations

import datetime as dt
import re

LEVEL_NAMES = {0: "unknown", 1: "high school", 2: "vocational", 3: "college level", 4: "bachelor", 5: "master+"}

# ------------------------------------------------------------------ dates -> total years
_MON = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun",
                                    "jul", "aug", "sep", "oct", "nov", "dec"])}
_PRESENT = r"present|current|now|to date|ongoing"
_M = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?"
_PT = rf"(?:{_M}\s+\d{{4}}|\d{{1,2}}\s*/\s*\d{{4}}|\d{{4}})"
DATE_RANGE_RE = re.compile(rf"{_PT}\s*(?:–|—|-|to|until)\s*(?:{_PT}|{_PRESENT})", re.I)


def find_date_ranges(text: str) -> list[str]:
    return [m.group(0) for m in DATE_RANGE_RE.finditer(text)]


def _point(s: str, today: dt.date):
    """One end of a range -> (month_index, 'm' | 'y'). Year-only dates are 'y'."""
    s = s.strip().lower().strip(".,;()")
    if re.fullmatch(_PRESENT, s):
        return today.year * 12 + today.month - 1, "m"
    m = re.fullmatch(r"(\d{1,2})\s*/\s*(\d{4})", s)                 # 06/2021
    if m and 1 <= int(m[1]) <= 12:
        return int(m[2]) * 12 + int(m[1]) - 1, "m"
    m = re.fullmatch(r"([a-z]{3,9})\.?,?\s*(\d{4})", s)             # March 2022 / Mar 2022 / Sept 2022
    if m and m[1][:3] in _MON:
        return int(m[2]) * 12 + _MON[m[1][:3]], "m"
    m = re.fullmatch(r"(\d{4})", s)                                  # 2019
    if m:
        return int(m[1]) * 12, "y"
    return None


def parse_range(s: str, today: dt.date):
    """'March 2022 - Present' -> (start_month, end_month_exclusive), or None."""
    parts = re.split(r"\s*(?:–|—|-|\bto\b|\buntil\b)\s*", s.strip(), maxsplit=1, flags=re.I)
    if len(parts) != 2:
        return None
    a, b = _point(parts[0], today), _point(parts[1], today)
    if not a or not b:
        return None
    start = a[0]
    end = b[0] + 1 if b[1] == "m" else b[0]       # 'Mar 2022 - Jun 2022' counts both months
    if a[1] == "y" and b[1] == "y":
        end = max(end, start + 12)                # '2021 - 2021' counts as one year
    return (start, end) if end > start else None


def total_years(date_strings: list[str], today: dt.date | None = None) -> float:
    """Total years worked. Overlapping or duplicate ranges are merged, never counted twice."""
    today = today or dt.date.today()
    ranges = sorted(r for r in (parse_range(s, today) for s in date_strings) if r)
    merged: list[list[int]] = []
    for s, e in ranges:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return round(sum(e - s for s, e in merged) / 12, 1)


# ------------------------------------------------------------------ education level (HR filter only)
def edu_level(text: str) -> int:
    """1 high school, 2 vocational, 3 college level, 4 bachelor, 5 master+, 0 = nothing found.
    The order matters: 'College Level in Bachelor of Science...' is unfinished (3), not 4.
    Caution: a school NAME like 'X Vocational School' can still trigger a level."""
    best = 0
    for line in str(text or "").lower().split("\n"):
        if re.search(r"high school|alternative learning|\bals\b|\bshs\b", line):     lvl = 1
        elif re.search(r"college level|undergraduate|associate|\b2[- ]?year", line): lvl = 3
        elif re.search(r"master|doctor|ph\.?d", line):                               lvl = 5
        elif re.search(r"bachelor|college graduate|\bb\.?s\.? in\b", line):          lvl = 4
        elif re.search(r"vocational|tesda|\bnc\s?(i{1,3}|iv)\b", line):              lvl = 2
        else:
            continue
        best = max(best, lvl)
    return best


def education_status(edu_text: str, min_education: str = "") -> tuple[int, str]:
    """-> (level, 'pass' | 'fail' | 'unknown'). Only 'fail' is removed by the HR filter."""
    need, level = edu_level(min_education), edu_level(edu_text)
    if need == 0:
        return level, "pass"
    if level == 0:
        return 0, "unknown"          # nothing detected: keep the person and flag it for HR
    return level, ("pass" if level >= need else "fail")
